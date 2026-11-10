import { MSG } from "./messages.js";

export const SCHEMA_VERSION = 1;
export const MAX_SOURCES = 30;
export const MAX_ITEMS_PER_SOURCE = 100;
const EXCERPT_MAX = 300;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

const sortDate = (item) => item.publishedAt ?? item.fetchedAt;

/**
 * Seul module qui lit et écrit le stockage. Les opérations sont sérialisées
 * (actualisations parallèles sans écritures concurrentes).
 * @param area  zone de stockage de type chrome.storage.local (API à promesses)
 */
export function createStore(area, { now = () => Date.now(), makeId = () => crypto.randomUUID() } = {}) {
  let queue = Promise.resolve();

  async function load() {
    const data = await area.get(["schemaVersion", "sources", "items", "meta"]);
    return {
      schemaVersion: data.schemaVersion ?? SCHEMA_VERSION,
      sources: data.sources ?? [],
      items: data.items ?? {},
      meta: data.meta ?? { lastRefreshAt: null },
    };
  }

  async function save(state) {
    try {
      await area.set(state);
    } catch (err) {
      console.error("Kiosque : écriture impossible", err);
      throw new StoreError("WRITE", MSG.storage);
    }
  }

  /** Exécute fn(state) à son tour, puis enregistre l'état modifié. */
  function mutate(fn) {
    const run = queue.then(async () => {
      const state = await load();
      const result = await fn(state);
      await save(state);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  return {
    getState: () => queue.then(load),

    addSource({ url, origin, title }) {
      return mutate((s) => {
        if (s.sources.some((x) => x.url === url)) throw new StoreError("DUPLICATE", MSG.DUPLICATE);
        if (s.sources.length >= MAX_SOURCES) throw new StoreError("LIMIT", MSG.LIMIT);
        const source = {
          id: makeId(), url, origin, title: title || new URL(url).hostname,
          addedAt: now(), lastFetchedAt: null, lastError: null,
        };
        s.sources.push(source);
        return source;
      });
    },

    removeSource(id) {
      return mutate((s) => {
        s.sources = s.sources.filter((x) => x.id !== id);
        for (const key of Object.keys(s.items)) {
          if (s.items[key].sourceId === id) delete s.items[key];
        }
      });
    },

    /** Fusionne les articles d'une source : sans doublon, état lu conservé, 100 articles au plus. */
    upsertItems(sourceId, parsedItems, fetchedAt = now()) {
      return mutate((s) => {
        for (const p of parsedItems) {
          const id = `${sourceId}:${p.guid}`;
          const old = s.items[id];
          s.items[id] = {
            id, sourceId,
            title: p.title, link: p.link, publishedAt: p.publishedAt,
            fetchedAt: old ? old.fetchedAt : fetchedAt,
            excerpt: (p.excerpt || "").slice(0, EXCERPT_MAX),
            read: old ? old.read : false,
          };
        }
        const mine = Object.values(s.items).filter((i) => i.sourceId === sourceId);
        mine.sort((a, b) => sortDate(b) - sortDate(a));
        for (const extra of mine.slice(MAX_ITEMS_PER_SOURCE)) delete s.items[extra.id];
      });
    },

    setSourceStatus(id, { lastFetchedAt, lastError, title }) {
      return mutate((s) => {
        const src = s.sources.find((x) => x.id === id);
        if (!src) return;
        if (lastFetchedAt !== undefined) src.lastFetchedAt = lastFetchedAt;
        if (lastError !== undefined) src.lastError = lastError;
        if (title) src.title = title;
      });
    },

    setRead(itemId, read) {
      return mutate((s) => {
        if (s.items[itemId]) s.items[itemId].read = Boolean(read);
      });
    },

    setLastRefresh(ts) {
      return mutate((s) => {
        s.meta.lastRefreshAt = ts;
      });
    },

    /** Articles triés du plus récent au plus ancien, avec le titre de leur source. */
    async getFeed({ sourceId = null, unreadOnly = false } = {}) {
      const s = await queue.then(load);
      const titles = new Map(s.sources.map((x) => [x.id, x.title]));
      return Object.values(s.items)
        .filter((i) => titles.has(i.sourceId))
        .filter((i) => !sourceId || i.sourceId === sourceId)
        .filter((i) => !unreadOnly || !i.read)
        .sort((a, b) => sortDate(b) - sortDate(a))
        .map((i) => ({ ...i, sourceTitle: titles.get(i.sourceId) }));
    },
  };
}
