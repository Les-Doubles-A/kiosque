import { describe, it, expect, vi } from "vitest";
import { startApp, $, titles } from "./ui-helpers.js";
import { RSS, fakeResponse } from "./fixtures.js";

const T0 = 1_760_000_000_000;
const MIN = 60_000;
const seed = (lastRefreshAt, n = 2) => async (store) => {
  for (let i = 1; i <= n; i++) {
    const s = await store.addSource({ url: `https://s${i}.example/rss`, origin: `https://s${i}.example`, title: `Source ${i}` });
    await store.upsertItems(s.id, [{ guid: `old${i}`, title: `Ancien ${i}`, link: `https://s${i}.example/old`, publishedAt: 1, excerpt: "" }]);
  }
  if (lastRefreshAt !== null) await store.setLastRefresh(lastRefreshAt);
};
const deferred = () => { let resolve; const promise = new Promise((r) => (resolve = r)); return { promise, resolve }; };

describe("actualisation automatique à l'ouverture (AC-F3-1)", () => {
  it("démarre seule quand l'actualisation date de plus de 30 minutes, avec « Actualisation… » et l'ancien fil visible", async () => {
    const gate = deferred();
    const fetchImpl = vi.fn(async () => { await gate.promise; return fakeResponse(RSS); });
    const { app } = await startApp({ seed: seed(T0 - 31 * MIN), fetchImpl, now: () => T0 });
    await vi.waitFor(() => expect($("refresh-status").textContent).toBe("Actualisation…"));
    expect(titles()).toEqual(expect.arrayContaining(["Ancien 1", "Ancien 2"])); // l'ancien fil reste affiché
    gate.resolve();
    await app.autoRefresh;
    expect($("refresh-status").textContent).toBe("");
    expect(titles()).toContain("Second article");
  });

  it("démarre aussi quand aucune actualisation n'a jamais eu lieu", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    const { app } = await startApp({ seed: seed(null), fetchImpl, now: () => T0 });
    await app.autoRefresh;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("ne démarre pas dans les 30 minutes", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    const { app } = await startApp({ seed: seed(T0 - 29 * MIN), fetchImpl, now: () => T0 });
    await app.autoRefresh;
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("ne démarre pas sans aucune source", async () => {
    const fetchImpl = vi.fn();
    const { app } = await startApp({ fetchImpl, now: () => T0 });
    await app.autoRefresh;
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("affiche la date de dernière actualisation", async () => {
    const { app } = await startApp({ seed: seed(T0 - 31 * MIN), fetchImpl: async () => fakeResponse(RSS), now: () => T0 });
    await app.autoRefresh;
    expect($("last-refresh").textContent).toMatch(/^Dernière actualisation : .*2025|2026/);
  });
});

describe("bouton Actualiser (AC-F3-2)", () => {
  it("lance l'actualisation à tout moment", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    const { app } = await startApp({ seed: seed(T0), fetchImpl, now: () => T0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    $("refresh-button").click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    await app.refresh();
  });

  it("est désactivé pendant l'actualisation : un second clic ne relance rien", async () => {
    const gate = deferred();
    const fetchImpl = vi.fn(async () => { await gate.promise; return fakeResponse(RSS); });
    const { app } = await startApp({ seed: seed(T0, 1), fetchImpl, now: () => T0 });
    $("refresh-button").click();
    await vi.waitFor(() => expect($("refresh-button").disabled).toBe(true));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1)); // la récupération est bien en cours
    $("refresh-button").click();
    $("refresh-button").click();
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchImpl).toHaveBeenCalledTimes(1); // aucun nouveau lancement
    gate.resolve();
    await app.refresh();
    await vi.waitFor(() => expect($("refresh-button").disabled).toBe(false));
  });

  it("est désactivé quand il n'y a aucune source", async () => {
    await startApp();
    expect($("refresh-button").disabled).toBe(true);
  });
});

describe("erreurs par source (AC-F3-3)", () => {
  it("affiche l'erreur à côté de la source en panne, met à jour les autres et garde les articles de la source en panne", async () => {
    const fetchImpl = async (url) => (url.includes("s2.example") ? fakeResponse("", { status: 503 }) : fakeResponse(RSS));
    const { app } = await startApp({ seed: seed(T0 - 31 * MIN), fetchImpl, now: () => T0 });
    await app.autoRefresh;
    const items = Array.from(document.querySelectorAll("#sources-list li"));
    expect(items[0].querySelector(".source-error")).toBeNull();
    expect(items[1].querySelector(".source-error").textContent).toBe("Erreur : La source a répondu par une erreur (code 503).");
    expect(items[1].querySelector(".source-error").getAttribute("role")).toBe("alert");
    expect(titles()).toContain("Second article"); // source 1 à jour
    expect(titles()).toContain("Ancien 2"); // article conservé de la source en panne
    expect($("offline-banner").hidden).toBe(true);
  });

  it("efface l'erreur quand la source répond de nouveau", async () => {
    let fail = true;
    const fetchImpl = async () => (fail ? fakeResponse("", { status: 500 }) : fakeResponse(RSS));
    const { app } = await startApp({ seed: seed(T0 - 31 * MIN, 1), fetchImpl, now: () => T0 });
    await app.autoRefresh;
    expect(document.querySelector(".source-error")).not.toBeNull();
    fail = false;
    await app.refresh();
    expect(document.querySelector(".source-error")).toBeNull();
  });
});

describe("hors connexion (AC-F3-6)", () => {
  it("affiche « Hors connexion ? » et garde le fil enregistré lisible", async () => {
    const offline = async () => { throw new TypeError("Failed to fetch"); };
    const { app } = await startApp({ seed: seed(T0 - 31 * MIN), fetchImpl: offline, now: () => T0 });
    await app.autoRefresh;
    expect($("offline-banner").hidden).toBe(false);
    expect($("offline-banner").textContent).toMatch(/^Hors connexion \?/);
    expect(titles()).toEqual(expect.arrayContaining(["Ancien 1", "Ancien 2"]));
    expect(document.querySelectorAll(".source-error")).toHaveLength(2);
  });

  it("masque le bandeau dès qu'une actualisation réussit", async () => {
    let online = false;
    const fetchImpl = async () => { if (!online) throw new TypeError("Failed to fetch"); return fakeResponse(RSS); };
    const { app } = await startApp({ seed: seed(T0 - 31 * MIN), fetchImpl, now: () => T0 });
    await app.autoRefresh;
    expect($("offline-banner").hidden).toBe(false);
    online = true;
    await app.refresh();
    expect($("offline-banner").hidden).toBe(true);
  });
});

describe("pas de doublon ni de perte de l'état lu à l'actualisation (AC-F3-4)", () => {
  it("actualiser deux fois un flux inchangé ne duplique rien et garde l'état lu", async () => {
    const fetchImpl = async () => fakeResponse(RSS);
    const { app } = await startApp({ seed: seed(T0, 1), fetchImpl, now: () => T0 });
    await app.refresh();
    document.querySelector("#feed li button.toggle-read").click(); // marque le premier article lu
    await vi.waitFor(() => expect(document.querySelectorAll("#feed li.read")).toHaveLength(1));
    await app.refresh();
    expect(titles().filter((t) => t === "Second article")).toHaveLength(1);
    expect(document.querySelectorAll("#feed li.read")).toHaveLength(1);
  });
});
