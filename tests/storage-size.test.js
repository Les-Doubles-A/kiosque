import { describe, it, expect } from "vitest";
import { createStore, MAX_SOURCES, MAX_ITEMS_PER_SOURCE } from "../src/lib/store.js";
import { createStorageArea } from "./chrome-mock.js";
import { TITLE_MAX, LINK_MAX, GUID_MAX, EXCERPT_STORE_MAX } from "../src/lib/feed-parser.js";

// Limite de chrome.storage.local : 10 Mio (référence du skill, à revérifier dans la documentation Chrome avant publication).
const QUOTA = 10 * 1024 * 1024;
const bytes = (area) => Object.entries(area.data).reduce((n, [k, v]) => n + Buffer.byteLength(k) + Buffer.byteLength(JSON.stringify(v)), 0);

async function fill(makeItem) {
  const area = createStorageArea();
  let n = 0;
  const store = createStore(area, { makeId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
  for (let s = 1; s <= MAX_SOURCES; s++) {
    const src = await store.addSource({ url: `https://s${s}.example/rss`, origin: `https://s${s}.example`, title: `Source ${s}` });
    await store.upsertItems(src.id, Array.from({ length: MAX_ITEMS_PER_SOURCE }, (_, i) => makeItem(s, i)), 1_760_000_000_000);
  }
  return { area, store };
}

describe("charge maximale : 30 sources × 100 articles (H5)", () => {
  it("cas réaliste (titre 90, lien 120, extrait 250) : bien en dessous du quota", async () => {
    const { area, store } = await fill((s, i) => ({
      guid: `https://s${s}.example/article/${i}`, title: "T".repeat(90), link: `https://s${s}.example/article/${i}${"x".repeat(80)}`,
      publishedAt: 1_760_000_000_000 - i * 1000, excerpt: "e".repeat(250),
    }));
    expect(await store.getFeed()).toHaveLength(MAX_SOURCES * MAX_ITEMS_PER_SOURCE);
    const size = bytes(area);
    console.log(`Taille réaliste : ${(size / 1024 / 1024).toFixed(2)} Mio`);
    expect(size).toBeLessThan(QUOTA * 0.4);
  });

  it("pire cas permis par les bornes (titre 300, lien 1000, identifiant 200, extrait 300) : sous le quota", async () => {
    const { area } = await fill((s, i) => ({
      guid: `${"g".repeat(GUID_MAX - 12)}${String(s).padStart(3, "0")}-${String(i).padStart(4, "0")}`,
      title: "T".repeat(TITLE_MAX), link: `https://s${s}.example/${"a".repeat(LINK_MAX - 30)}${i}`,
      publishedAt: 1_760_000_000_000 - i, excerpt: "e".repeat(EXCERPT_STORE_MAX),
    }));
    const size = bytes(area);
    console.log(`Taille pire cas : ${(size / 1024 / 1024).toFixed(2)} Mio`);
    expect(size).toBeLessThan(QUOTA * 0.85);
  });
});
