import { describe, it, expect, vi } from "vitest";
import { startApp, $, titles } from "./ui-helpers.js";
import { RSS, HTML_PAGE, fakeResponse } from "./fixtures.js";

const ok = (xml = RSS) => vi.fn(async () => fakeResponse(xml));

describe("ajout d'une source (AC-F1-1)", () => {
  it("demande l'autorisation de l'origine, ajoute la source avec le titre du flux et affiche ses articles", async () => {
    const fetchImpl = ok();
    const { app, chromeApi, store } = await startApp({ fetchImpl });
    await app.addSource("https://exemple.fr/rss.xml");
    expect(chromeApi.permissions.request).toHaveBeenCalledWith({ origins: ["https://exemple.fr/*"] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await store.getState()).sources[0].title).toBe("Flux de test");
    expect($("sources-list").textContent).toContain("Flux de test");
    expect(titles()).toEqual(["Second article", "Premier article"]);
    expect($("error").textContent).toBe("");
    expect($("feed-url").value).toBe("");
  });

  it("utilise le nom d'hôte quand le flux n'a pas de titre", async () => {
    const xml = RSS.replace("<title>Flux de test</title>", "");
    const { app, store } = await startApp({ fetchImpl: ok(xml) });
    await app.addSource("https://exemple.fr/rss.xml");
    expect((await store.getState()).sources[0].title).toBe("exemple.fr");
  });

  it("passe par le formulaire : la validation déclenche l'ajout", async () => {
    const { chromeApi } = await startApp({ fetchImpl: ok() });
    $("feed-url").value = "https://exemple.fr/rss.xml";
    $("add-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(titles().length).toBe(2));
    expect(chromeApi.permissions.request).toHaveBeenCalledTimes(1);
  });
});

describe("autorisation refusée (AC-F1-2)", () => {
  it("n'ajoute rien et affiche le message exact", async () => {
    const fetchImpl = ok();
    const { app, store } = await startApp({ fetchImpl, permissionGranted: false });
    await app.addSource("https://exemple.fr/rss.xml");
    expect($("error").textContent).toBe("Autorisation refusée pour exemple.fr : la source n'a pas été ajoutée.");
    expect((await store.getState()).sources).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("saisies invalides (AC-F1-3)", () => {
  it.each(["", "n'importe quoi", "http://exemple.fr/rss.xml"])("refuse %j sans demander de permission", async (input) => {
    const { app, chromeApi, store } = await startApp({ fetchImpl: ok() });
    await app.addSource(input);
    expect($("error").textContent).toBe("Saisis une adresse https:// valide.");
    expect(chromeApi.permissions.request).not.toHaveBeenCalled();
    expect((await store.getState()).sources).toHaveLength(0);
  });

  it("refuse une source déjà présente, même écrite autrement, sans redemander de permission", async () => {
    const { app, chromeApi, store } = await startApp({ fetchImpl: ok() });
    await app.addSource("https://exemple.fr/rss.xml");
    chromeApi.permissions.request.mockClear();
    await app.addSource("HTTPS://EXEMPLE.FR/rss.xml#haut");
    expect($("error").textContent).toBe("Source déjà ajoutée.");
    expect(chromeApi.permissions.request).not.toHaveBeenCalled();
    expect((await store.getState()).sources).toHaveLength(1);
  });

  it("accepte une adresse Google News avec sa chaîne de requête intacte", async () => {
    const gn = "https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US";
    const fetchImpl = ok();
    const { app, chromeApi } = await startApp({ fetchImpl });
    await app.addSource(gn);
    expect(chromeApi.permissions.request).toHaveBeenCalledWith({ origins: ["https://news.google.com/*"] });
    expect(fetchImpl.mock.calls[0][0]).toBe(gn);
  });
});

describe("contenu qui n'est pas un flux (AC-F1-4)", () => {
  it("n'ajoute rien et affiche le message exact", async () => {
    const { app, store } = await startApp({ fetchImpl: ok(HTML_PAGE) });
    await app.addSource("https://exemple.fr/page.html");
    expect($("error").textContent).toBe("Ce n'est pas un flux RSS ou Atom.");
    expect((await store.getState()).sources).toHaveLength(0);
    expect($("add-button").disabled).toBe(false);
  });

  it("explique l'échec réseau sans rien enregistrer", async () => {
    const { app, store } = await startApp({ fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
    await app.addSource("https://exemple.fr/rss.xml");
    expect($("error").textContent).toMatch(/Impossible de joindre la source/);
    expect((await store.getState()).sources).toHaveLength(0);
  });
});

// ---------------- T6 ----------------
import { MAX_SOURCES } from "../src/lib/store.js";

const seedSources = (n) => async (store) => {
  for (let i = 1; i <= n; i++) await store.addSource({ url: `https://s${i}.example/rss`, origin: `https://s${i}.example`, title: `Source ${i}` });
};

describe("suppression d'une source (AC-F1-5)", () => {
  async function twoSources(confirmFn) {
    const ctx = await startApp({
      confirmFn,
      seed: async (store) => {
        const a = await store.addSource({ url: "https://a.example/rss", origin: "https://a.example", title: "Source A" });
        const b = await store.addSource({ url: "https://b.example/rss", origin: "https://b.example", title: "Source B" });
        await store.upsertItems(a.id, [{ guid: "a1", title: "Article A", link: "https://a.example/1", publishedAt: 2, excerpt: "" }]);
        await store.upsertItems(b.id, [{ guid: "b1", title: "Article B", link: "https://b.example/1", publishedAt: 1, excerpt: "" }]);
        await store.setLastRefresh(1_760_000_000_000); // évite l'actualisation automatique
      },
    });
    return ctx;
  }
  const removeButtons = () => Array.from(document.querySelectorAll("#sources-list button.remove"));

  it("demande confirmation avec le nom de la source", async () => {
    const confirmFn = vi.fn(() => true);
    await twoSources(confirmFn);
    removeButtons()[0].click();
    expect(confirmFn).toHaveBeenCalledWith("Supprimer la source « Source A » et tous ses articles ?");
  });

  it("supprime la source et ses articles du fil et du stockage quand on confirme", async () => {
    const { store } = await twoSources(() => true);
    removeButtons()[0].click();
    await vi.waitFor(() => expect(titles()).toEqual(["Article B"]));
    const state = await store.getState();
    expect(state.sources.map((s) => s.title)).toEqual(["Source B"]);
    expect(Object.values(state.items).map((i) => i.title)).toEqual(["Article B"]);
    expect(document.activeElement).toBe($("sources-title"));
  });

  it("ne change rien quand on annule", async () => {
    const { store } = await twoSources(() => false);
    removeButtons()[0].click();
    await new Promise((r) => setTimeout(r, 20));
    expect((await store.getState()).sources).toHaveLength(2);
    expect(titles()).toHaveLength(2);
  });

  it("donne à chaque bouton un nom accessible précis", async () => {
    await twoSources(() => true);
    expect(removeButtons().map((b) => b.getAttribute("aria-label"))).toEqual(["Supprimer : Source A", "Supprimer : Source B"]);
  });
});

describe("limite de 30 sources (AC-F1-6)", () => {
  it("refuse la 31e source sans demander de permission", async () => {
    const { app, chromeApi, store } = await startApp({ seed: seedSources(MAX_SOURCES), fetchImpl: ok(), now: () => 1 });
    await app.autoRefresh;
    await app.addSource("https://trente-et-un.example/rss");
    expect($("error").textContent).toBe("Limite de 30 sources atteinte.");
    expect(chromeApi.permissions.request).not.toHaveBeenCalled();
    expect((await store.getState()).sources).toHaveLength(30);
  });
});
