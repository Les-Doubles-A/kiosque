import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStore } from "../src/lib/store.js";
import { createStorageArea } from "./chrome-mock.js";
import { initNews, MAX_DISPLAY } from "../src/news.js";
import { DEFAULT_SOURCES } from "../src/lib/default-sources.js";
import { RSS, HOSTILE, fakeResponse } from "./fixtures.js";

const T0 = 1_760_000_000_000;
const MIN = 60_000;
const $ = (id) => document.getElementById(id);
const headlines = () => Array.from(document.querySelectorAll("#news h2")).map((h) => h.textContent);

function loadPage() {
  const html = readFileSync(resolve(process.cwd(), "src/news.html"), "utf8");
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
}
async function start({ fetchImpl = async () => fakeResponse(RSS), now = () => T0, prepare, area = createStorageArea() } = {}) {
  loadPage();
  let n = 0;
  const store = createStore(area, { makeId: () => `s${++n}` });
  if (prepare) await prepare(store);
  const app = initNews({ document, store, fetchImpl, now });
  await app.ready;
  return { app, store, area };
}

describe("contenu de la page : seulement les actualités et le bouton", () => {
  it("n'affiche ni titre « Kiosque », ni panneau Sources, ni champ d'ajout", async () => {
    await start({ fetchImpl: async () => fakeResponse(RSS) });
    const text = document.body.textContent;
    expect(text).not.toContain("Kiosque");
    expect(text).not.toContain("Sources");
    expect(text).not.toContain("Adresse du flux");
    expect(text).not.toContain("Ajouter");
    expect(document.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
    expect(document.querySelectorAll("button")).toHaveLength(1);
    expect($("refresh-button").textContent).toBe("Actualiser");
  });

  it("garde un titre de page pour les lecteurs d'écran, invisible à l'écran", async () => {
    await start();
    expect(document.querySelector("h1").textContent).toBe("Actualités");
    expect(document.querySelector("h1").className).toBe("visually-hidden");
    expect(readFileSync(resolve(process.cwd(), "src/news.css"), "utf8")).toMatch(/\.visually-hidden/);
    expect(readFileSync(resolve(process.cwd(), "src/news.html"), "utf8")).toMatch(/<html lang="fr">[\s\S]*<title>Actualités<\/title>/);
  });
});

describe("sources par défaut", () => {
  it("charge les 16 sources au premier lancement", async () => {
    const { store } = await start();
    const { sources } = await store.getState();
    expect(sources).toHaveLength(16);
    expect(sources.map((s) => s.url)).toEqual(DEFAULT_SOURCES.map((d) => d.url));
  });

  it("ne les ajoute pas une seconde fois à la réouverture", async () => {
    const area = createStorageArea();
    await start({ area });
    const { store } = await start({ area });
    expect((await store.getState()).sources).toHaveLength(16);
  });

  it("n'utilise que des adresses https", () => {
    expect(DEFAULT_SOURCES.every((d) => d.url.startsWith("https://"))).toBe(true);
  });
});

describe("articles affichés", () => {
  it("actualise à la première ouverture et affiche titre, source, date et extrait, du plus récent au plus ancien", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    const { app } = await start({ fetchImpl });
    await app.autoRefresh;
    expect(fetchImpl).toHaveBeenCalledTimes(16);
    const first = document.querySelector("#news li");
    expect(first.querySelector("h2 a").textContent).toBe("Second article");
    expect(first.querySelector(".meta").textContent).toMatch(/^BBC · .*2026/);
    expect(first.querySelector(".excerpt").textContent).toBe("Texte simple.");
    expect(headlines().slice(0, 2)).toEqual(["Second article", "Second article"]);
  });

  it("ouvre les articles dans un nouvel onglet, sans transmettre la page d'origine", async () => {
    const { app } = await start();
    await app.autoRefresh;
    const a = document.querySelector("#news h2 a");
    expect(a.getAttribute("href")).toBe("https://exemple.fr/a2");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });

  it("n'affiche que les 200 articles les plus récents", async () => {
    const { store } = await start({
      now: () => T0 - 5 * MIN,
      prepare: async (s) => {
        await s.addSource({ url: DEFAULT_SOURCES[0].url, origin: "https://feeds.bbci.co.uk", title: "BBC" });
        await s.upsertItems("s1", Array.from({ length: 100 }, (_, i) => ({ guid: `g${i}`, title: `Article ${i}`, link: `https://e.fr/${i}`, publishedAt: 1000 + i, excerpt: "" })));
        await s.setLastRefresh(T0 - 5 * MIN);
      },
    });
    await store.upsertItems("s2", Array.from({ length: 150 }, (_, i) => ({ guid: `h${i}`, title: `Autre ${i}`, link: `https://e.fr/h${i}`, publishedAt: 5000 + i, excerpt: "" })));
    loadPage();
    const app = initNews({ document, store, fetchImpl: async () => fakeResponse(RSS), now: () => T0 - 5 * MIN });
    await app.ready;
    expect(document.querySelectorAll("#news li")).toHaveLength(MAX_DISPLAY);
    expect(headlines()[0]).toBe("Autre 149");
  });

  it("affiche le contenu hostile comme du texte inerte", async () => {
    const { app } = await start({ fetchImpl: async () => fakeResponse(HOSTILE) });
    await app.autoRefresh;
    expect(headlines()).toContain("<script>alert(1)</script>Titre piégé");
    expect(headlines()).not.toContain("Lien dangereux");
    const all = Array.from(document.querySelectorAll("#news *"));
    expect(all.some((el) => ["SCRIPT", "IMG", "IFRAME"].includes(el.tagName))).toBe(false);
    expect(all.some((el) => Array.from(el.attributes).some((a) => /^on/i.test(a.name)))).toBe(false);
    expect(document.querySelector("#news").textContent).not.toContain("tracker.example");
  });
});

describe("actualisation", () => {
  it("n'actualise pas à l'ouverture dans les 30 minutes", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    const { app } = await start({ fetchImpl, prepare: (s) => s.setLastRefresh(T0 - 29 * MIN) });
    await app.autoRefresh;
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("actualise à l'ouverture au-delà de 30 minutes", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(RSS));
    const { app } = await start({ fetchImpl, prepare: (s) => s.setLastRefresh(T0 - 31 * MIN) });
    await app.autoRefresh;
    expect(fetchImpl).toHaveBeenCalledTimes(16);
  });

  it("le bouton relance l'actualisation, affiche « Actualisation… » et se désactive pendant l'opération", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const fetchImpl = vi.fn(async () => { await gate; return fakeResponse(RSS); });
    const { app } = await start({ fetchImpl, prepare: (s) => s.setLastRefresh(T0) });
    $("refresh-button").click();
    await vi.waitFor(() => expect($("refresh-status").textContent).toBe("Actualisation…"));
    expect($("refresh-button").disabled).toBe(true);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const calls = fetchImpl.mock.calls.length;
    $("refresh-button").click();
    $("refresh-button").click();
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchImpl.mock.calls.length).toBe(calls); // aucun relancement
    release();
    await app.refresh();
    await vi.waitFor(() => expect($("refresh-button").disabled).toBe(false));
    expect($("refresh-status").textContent).toBe("");
    expect(headlines().length).toBeGreaterThan(0);
  });

  it("n'ajoute aucun doublon quand on actualise deux fois", async () => {
    const { app } = await start({ prepare: (s) => s.setLastRefresh(T0) });
    await app.refresh();
    const first = headlines().length;
    await app.refresh();
    expect(headlines().length).toBe(first);
  });

  it("affiche la date de dernière actualisation", async () => {
    const { app } = await start();
    await app.autoRefresh;
    expect($("last-refresh").textContent).toMatch(/^Dernière actualisation : /);
  });
});

describe("sources qui ne répondent pas", () => {
  it("garde les articles des autres sources et liste les sources en panne dans un bloc repliable", async () => {
    const fetchImpl = async (url) => (url.includes("france24") ? fakeResponse("", { status: 404 }) : fakeResponse(RSS));
    const { app } = await start({ fetchImpl });
    await app.autoRefresh;
    expect(headlines().length).toBeGreaterThan(0);
    expect($("problems").hidden).toBe(false);
    expect($("problems-summary").textContent).toBe("1 source n'a pas répondu");
    expect($("problems-list").textContent).toBe("France 24 : La source a répondu par une erreur (code 404).");
    expect($("problems").tagName).toBe("DETAILS");
    expect($("problems").open).toBe(false);
    expect($("offline-banner").hidden).toBe(true);
  });

  it("accorde le pluriel et masque le bloc quand tout va bien", async () => {
    const fetchImpl = async (url) => (/france24|rfi/.test(url) ? fakeResponse("", { status: 500 }) : fakeResponse(RSS));
    const { app } = await start({ fetchImpl });
    await app.autoRefresh;
    expect($("problems-summary").textContent).toBe("2 sources n'ont pas répondu");
    const ok = await start();
    await ok.app.autoRefresh;
    expect($("problems").hidden).toBe(true);
  });

  it("hors connexion : bandeau « Hors connexion ? » et articles déjà enregistrés conservés", async () => {
    const area = createStorageArea();
    const first = await start({ area });
    await first.app.autoRefresh;
    const before = headlines();
    expect(before.length).toBeGreaterThan(0);
    const offline = async () => { throw new TypeError("Failed to fetch"); };
    loadPage();
    const store = createStore(area);
    const app = initNews({ document, store, fetchImpl: offline, now: () => T0 + 40 * MIN });
    await app.ready;
    await app.autoRefresh;
    expect($("offline-banner").hidden).toBe(false);
    expect($("offline-banner").textContent).toMatch(/^Hors connexion \?/);
    expect(headlines()).toEqual(before);
  });
});

describe("accessibilité de la page Actualités", () => {
  it("annonce l'actualisation et les erreurs, et nomme son seul bouton", async () => {
    await start();
    expect($("refresh-status").getAttribute("role")).toBe("status");
    expect($("offline-banner").getAttribute("role")).toBe("alert");
    expect($("refresh-button").textContent.trim()).toBe("Actualiser");
    expect(Array.from(document.querySelectorAll("[tabindex]")).filter((e) => Number(e.getAttribute("tabindex")) > 0)).toHaveLength(0);
  });

  it("affiche un message quand il n'y a aucun article", async () => {
    const offline = async () => { throw new TypeError("Failed to fetch"); };
    const { app } = await start({ fetchImpl: offline });
    await app.autoRefresh;
    expect($("empty").hidden).toBe(false);
    expect($("empty").textContent).toBe("Aucune actualité pour l'instant. Clique sur « Actualiser ».");
  });
});
