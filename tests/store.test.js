import { describe, it, expect } from "vitest";
import { createStore, MAX_SOURCES, MAX_ITEMS_PER_SOURCE, StoreError } from "../src/lib/store.js";
import { createStorageArea } from "./chrome-mock.js";

function make(initial) {
  let n = 0;
  const area = createStorageArea(initial);
  const store = createStore(area, { now: () => 1_000, makeId: () => `s${++n}` });
  return { area, store };
}
const src = (i) => ({ url: `https://site${i}.example/rss`, origin: `https://site${i}.example`, title: `Site ${i}` });
const item = (guid, publishedAt, title = guid) => ({ guid, title, link: `https://x.example/${guid}`, publishedAt, excerpt: "" });

describe("sources", () => {
  it("ajoute une source avec un identifiant et l'écrit au format versionné", async () => {
    const { store, area } = make();
    const s = await store.addSource(src(1));
    expect(s).toMatchObject({ id: "s1", title: "Site 1", lastError: null });
    expect(area.data.schemaVersion).toBe(1);
  });

  it("refuse un doublon (AC-F1-3)", async () => {
    const { store } = make();
    await store.addSource(src(1));
    await expect(store.addSource(src(1))).rejects.toMatchObject({ code: "DUPLICATE", message: "Source déjà ajoutée." });
  });

  it("refuse la 31e source (AC-F1-6)", async () => {
    const { store } = make();
    for (let i = 1; i <= MAX_SOURCES; i++) await store.addSource(src(i));
    await expect(store.addSource(src(99))).rejects.toMatchObject({ code: "LIMIT", message: "Limite de 30 sources atteinte." });
    expect((await store.getState()).sources).toHaveLength(30);
  });

  it("supprime la source et tous ses articles (AC-F1-5)", async () => {
    const { store } = make();
    const a = await store.addSource(src(1));
    const b = await store.addSource(src(2));
    await store.upsertItems(a.id, [item("a1", 10)]);
    await store.upsertItems(b.id, [item("b1", 20)]);
    await store.removeSource(a.id);
    const state = await store.getState();
    expect(state.sources.map((s) => s.id)).toEqual([b.id]);
    expect(Object.keys(state.items)).toEqual([`${b.id}:b1`]);
  });
});

describe("articles", () => {
  it("n'ajoute aucun doublon quand on fusionne deux fois le même flux (AC-F3-4)", async () => {
    const { store } = make();
    const s = await store.addSource(src(1));
    await store.upsertItems(s.id, [item("a", 10), item("b", 20)]);
    await store.upsertItems(s.id, [item("a", 10), item("b", 20)]);
    expect(await store.getFeed()).toHaveLength(2);
  });

  it("conserve l'état lu à la fusion suivante (AC-F3-4)", async () => {
    const { store } = make();
    const s = await store.addSource(src(1));
    await store.upsertItems(s.id, [item("a", 10)]);
    await store.setRead(`${s.id}:a`, true);
    await store.upsertItems(s.id, [item("a", 10, "Titre corrigé")]);
    const [a] = await store.getFeed();
    expect(a.read).toBe(true);
    expect(a.title).toBe("Titre corrigé");
  });

  it("garde les 100 articles les plus récents d'une source (AC-F3-5)", async () => {
    const { store } = make();
    const s = await store.addSource(src(1));
    const all = Array.from({ length: MAX_ITEMS_PER_SOURCE + 1 }, (_, i) => item(`g${i}`, 1000 + i));
    await store.upsertItems(s.id, all);
    const feed = await store.getFeed();
    expect(feed).toHaveLength(100);
    expect(feed.some((i) => i.id === `${s.id}:g0`)).toBe(false); // le plus ancien est parti
    expect(feed.some((i) => i.id === `${s.id}:g100`)).toBe(true);
  });

  it("applique la rétention par source, sans toucher aux autres", async () => {
    const { store } = make();
    const a = await store.addSource(src(1));
    const b = await store.addSource(src(2));
    await store.upsertItems(b.id, [item("keep", 5)]);
    await store.upsertItems(a.id, Array.from({ length: 120 }, (_, i) => item(`g${i}`, 100 + i)));
    const feed = await store.getFeed();
    expect(feed.filter((i) => i.sourceId === b.id)).toHaveLength(1);
    expect(feed.filter((i) => i.sourceId === a.id)).toHaveLength(100);
  });

  it("trie du plus récent au plus ancien, avec repli sur la date de récupération", async () => {
    const { store } = make();
    const s = await store.addSource(src(1));
    await store.upsertItems(s.id, [item("vieux", 100), item("recent", 500), item("sansdate", null)], 300);
    const order = (await store.getFeed()).map((i) => i.id.split(":")[1]);
    expect(order).toEqual(["recent", "sansdate", "vieux"]);
  });

  it("filtre par source et par non lu", async () => {
    const { store } = make();
    const a = await store.addSource(src(1));
    const b = await store.addSource(src(2));
    await store.upsertItems(a.id, [item("a1", 1)]);
    await store.upsertItems(b.id, [item("b1", 2)]);
    await store.setRead(`${a.id}:a1`, true);
    expect((await store.getFeed({ sourceId: b.id })).map((i) => i.id)).toEqual([`${b.id}:b1`]);
    expect((await store.getFeed({ unreadOnly: true })).map((i) => i.id)).toEqual([`${b.id}:b1`]);
  });

  it("persiste l'état lu : une nouvelle instance relit les mêmes données (AC-F4-3)", async () => {
    const { store, area } = make();
    const s = await store.addSource(src(1));
    await store.upsertItems(s.id, [item("a", 10)]);
    await store.setRead(`${s.id}:a`, true);
    const reopened = createStore(area);
    expect((await reopened.getFeed())[0].read).toBe(true);
  });

  it("plafonne l'extrait stocké à 300 caractères", async () => {
    const { store } = make();
    const s = await store.addSource(src(1));
    await store.upsertItems(s.id, [{ ...item("a", 1), excerpt: "x".repeat(900) }]);
    expect((await store.getFeed())[0].excerpt).toHaveLength(300);
  });
});

describe("erreurs d'écriture", () => {
  it("signale un échec d'écriture sans corrompre les données déjà stockées", async () => {
    const { store, area } = make();
    await store.addSource(src(1));
    const before = structuredClone(area.data);
    area.set = async () => { throw new Error("QUOTA_BYTES quota exceeded"); };
    await expect(store.addSource(src(2))).rejects.toBeInstanceOf(StoreError);
    expect(area.data).toEqual(before);
  });

  it("sérialise les écritures parallèles sans en perdre", async () => {
    const { store } = make();
    await Promise.all([1, 2, 3, 4, 5].map((i) => store.addSource(src(i))));
    expect((await store.getState()).sources).toHaveLength(5);
  });
});
