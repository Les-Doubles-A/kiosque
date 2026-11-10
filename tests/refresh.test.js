import { describe, it, expect, vi, afterEach } from "vitest";
import { validateFeedUrl, fetchFeedText, needsRefresh, refreshAll, refreshSource, RefreshError } from "../src/lib/refresh.js";
import { createStore } from "../src/lib/store.js";
import { createStorageArea } from "./chrome-mock.js";
import { RSS, HTML_PAGE, fakeResponse } from "./fixtures.js";

afterEach(() => vi.useRealTimers());

describe("validateFeedUrl (AC-F1-3)", () => {
  it.each(["", "   ", "pas une url", "http://exemple.fr/rss", "ftp://exemple.fr/rss", "https://", "javascript:alert(1)"])(
    "rejette %j avec le message du critère", (input) => {
      expect(validateFeedUrl(input)).toEqual({ ok: false, error: "Saisis une adresse https:// valide." });
    });

  it("accepte et normalise une adresse https (hôte en minuscules, fragment retiré)", () => {
    const r = validateFeedUrl("  HTTPS://Exemple.FR/rss.xml#haut ");
    expect(r).toMatchObject({ ok: true, url: "https://exemple.fr/rss.xml", origin: "https://exemple.fr", host: "exemple.fr" });
  });

  it("conserve la chaîne de requête des flux Google News", () => {
    const gn = "https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US";
    expect(validateFeedUrl(gn)).toMatchObject({ ok: true, url: gn, origin: "https://news.google.com" });
  });
});

describe("fetchFeedText", () => {
  it("renvoie le texte d'une réponse correcte et transmet l'URL intacte", async () => {
    const gn = "https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US";
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    expect(await fetchFeedText(gn, { fetchImpl })).toBe(RSS);
    expect(fetchImpl.mock.calls[0][0]).toBe(gn);
  });

  it("refuse une adresse non https sans appeler le réseau", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchFeedText("http://exemple.fr/rss", { fetchImpl })).rejects.toMatchObject({ code: "NETWORK" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("signale une erreur HTTP", async () => {
    const fetchImpl = async () => fakeResponse("", { status: 500 });
    await expect(fetchFeedText("https://e.fr/rss", { fetchImpl })).rejects.toMatchObject({ code: "HTTP", message: "La source a répondu par une erreur (code 500)." });
  });

  it("signale un réseau coupé (AC-F3-6)", async () => {
    const fetchImpl = async () => { throw new TypeError("Failed to fetch"); };
    await expect(fetchFeedText("https://e.fr/rss", { fetchImpl })).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("interrompt après 10 secondes (AC-F3-3)", async () => {
    vi.useFakeTimers();
    const fetchImpl = (url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    const promise = fetchFeedText("https://e.fr/rss", { fetchImpl });
    const assertion = expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("refuse une réponse de plus de 2 Mo, annoncée ou constatée", async () => {
    await expect(fetchFeedText("https://e.fr/rss", { fetchImpl: async () => fakeResponse("x", { headers: { "content-length": "3000000" } }) }))
      .rejects.toMatchObject({ code: "TOO_LARGE" });
    await expect(fetchFeedText("https://e.fr/rss", { fetchImpl: async () => fakeResponse("x".repeat(2_000_001)) }))
      .rejects.toMatchObject({ code: "TOO_LARGE" });
  });
});

describe("needsRefresh (AC-F3-1)", () => {
  const now = 10_000_000;
  it("est vrai si jamais actualisé", () => expect(needsRefresh({ lastRefreshAt: null }, now)).toBe(true));
  it("est faux dans les 30 minutes", () => expect(needsRefresh({ lastRefreshAt: now - 29 * 60_000 }, now)).toBe(false));
  it("est vrai au-delà de 30 minutes", () => expect(needsRefresh({ lastRefreshAt: now - 31 * 60_000 }, now)).toBe(true));
});

describe("refreshAll — pannes isolées par source", () => {
  async function setup(urls) {
    let n = 0;
    const store = createStore(createStorageArea(), { makeId: () => `s${++n}` });
    for (const url of urls) await store.addSource({ url, origin: new URL(url).origin, title: url });
    return store;
  }

  it("met à jour les sources saines et marque la source en échec, sans effacer ses articles (AC-F3-3)", async () => {
    const store = await setup(["https://ok.fr/rss", "https://ko.fr/rss"]);
    await refreshAll(store, { fetchImpl: async () => fakeResponse(RSS), now: () => 1 });
    const fetchImpl = async (url) => (url.includes("ko.fr") ? fakeResponse("", { status: 503 }) : fakeResponse(RSS));
    const { results, allFailed } = await refreshAll(store, { fetchImpl, now: () => 2 });
    expect(allFailed).toBe(false);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    const state = await store.getState();
    expect(state.sources[0].lastError).toBeNull();
    expect(state.sources[1].lastError).toBe("La source a répondu par une erreur (code 503).");
    expect((await store.getFeed()).filter((i) => i.sourceId === "s2")).toHaveLength(2);
  });

  it("hors connexion : toutes les sources échouent, le fil stocké reste lisible (AC-F3-6)", async () => {
    const store = await setup(["https://a.fr/rss", "https://b.fr/rss"]);
    await refreshAll(store, { fetchImpl: async () => fakeResponse(RSS) });
    const offline = async () => { throw new TypeError("Failed to fetch"); };
    const { allFailed } = await refreshAll(store, { fetchImpl: offline });
    expect(allFailed).toBe(true);
    expect(await store.getFeed()).toHaveLength(4);
  });

  it("n'insère aucun doublon quand le flux est inchangé (AC-F3-4)", async () => {
    const store = await setup(["https://a.fr/rss"]);
    const fetchImpl = async () => fakeResponse(RSS);
    await refreshAll(store, { fetchImpl });
    await refreshAll(store, { fetchImpl });
    expect(await store.getFeed()).toHaveLength(2);
  });

  it("traite une page HTML comme une erreur de source (AC-F1-4)", async () => {
    const store = await setup(["https://a.fr/rss"]);
    const [source] = (await store.getState()).sources;
    const r = await refreshSource(store, source, { fetchImpl: async () => fakeResponse(HTML_PAGE) });
    expect(r).toMatchObject({ ok: false, error: "Ce n'est pas un flux RSS ou Atom." });
  });

  it("lance au plus 5 récupérations en parallèle", async () => {
    const store = await setup(Array.from({ length: 12 }, (_, i) => `https://s${i}.fr/rss`));
    let active = 0, peak = 0;
    const fetchImpl = async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return fakeResponse(RSS);
    };
    await refreshAll(store, { fetchImpl });
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it("actualise 10 sources de 1 s en moins de 5 s (horloge simulée)", async () => {
    vi.useFakeTimers();
    const store = await setup(Array.from({ length: 10 }, (_, i) => `https://s${i}.fr/rss`));
    const fetchImpl = () => new Promise((resolve) => setTimeout(() => resolve(fakeResponse(RSS)), 1000));
    const started = Date.now();
    const run = refreshAll(store, { fetchImpl });
    await vi.advanceTimersByTimeAsync(2000);
    await run;
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("enregistre la date de dernière actualisation", async () => {
    const store = await setup(["https://a.fr/rss"]);
    await refreshAll(store, { fetchImpl: async () => fakeResponse(RSS), now: () => 777 });
    expect((await store.getState()).meta.lastRefreshAt).toBe(777);
  });
});
