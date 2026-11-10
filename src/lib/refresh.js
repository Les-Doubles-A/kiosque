import { MSG } from "./messages.js";
import { parseFeed, NotAFeedError } from "./feed-parser.js";
export { validateFeedUrl } from "./url.js";

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 2_000_000;
export const REFRESH_MAX_AGE_MS = 30 * 60 * 1000;
export const CONCURRENCY = 5;

export class RefreshError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RefreshError";
    this.code = code; // NETWORK | TIMEOUT | HTTP | TOO_LARGE
  }
}

/** Récupère le texte d'un flux : https, délai de 10 s, 2 Mo au plus, statut contrôlé. */
export async function fetchFeedText(url, { fetchImpl = globalThis.fetch, timeoutMs = FETCH_TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  if (!/^https:\/\//i.test(url)) throw new RefreshError("NETWORK", MSG.network);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, { signal: controller.signal, credentials: "omit", redirect: "follow" });
    } catch (err) {
      if (controller.signal.aborted) throw new RefreshError("TIMEOUT", MSG.timeout);
      throw new RefreshError("NETWORK", MSG.network);
    }
    if (!response.ok) throw new RefreshError("HTTP", MSG.http(response.status));
    const declared = Number(response.headers?.get?.("content-length"));
    if (declared > maxBytes) throw new RefreshError("TOO_LARGE", MSG.tooLarge);
    let text;
    try {
      text = await response.text();
    } catch {
      if (controller.signal.aborted) throw new RefreshError("TIMEOUT", MSG.timeout);
      throw new RefreshError("NETWORK", MSG.network);
    }
    if (text.length > maxBytes) throw new RefreshError("TOO_LARGE", MSG.tooLarge);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Message lisible pour une erreur de récupération ou d'analyse. */
export function messageFor(err) {
  if (err instanceof NotAFeedError || err instanceof RefreshError) return err.message;
  if (err && err.name === "StoreError") return err.message;
  console.error("Kiosque : erreur inattendue", err);
  return "Erreur inattendue pendant la récupération de la source.";
}

/** Vrai si aucune actualisation n'a eu lieu ou si la dernière date de plus de 30 minutes. */
export function needsRefresh(meta, now = Date.now(), maxAgeMs = REFRESH_MAX_AGE_MS) {
  const last = meta?.lastRefreshAt;
  return last == null || now - last > maxAgeMs;
}

/** Actualise une source ; une erreur est enregistrée sur la source, jamais propagée. */
export async function refreshSource(store, source, { fetchImpl, now = () => Date.now(), parse = parseFeed } = {}) {
  try {
    const text = await fetchFeedText(source.url, { fetchImpl });
    const parsed = parse(text);
    await store.upsertItems(source.id, parsed.items, now());
    await store.setSourceStatus(source.id, { lastFetchedAt: now(), lastError: null });
    return { sourceId: source.id, ok: true };
  } catch (err) {
    const error = messageFor(err);
    try {
      await store.setSourceStatus(source.id, { lastError: error });
    } catch (storeErr) {
      console.error("Kiosque : état de la source non enregistré", storeErr);
    }
    return { sourceId: source.id, ok: false, error };
  }
}

/** Actualise toutes les sources, 5 en parallèle au plus. */
export async function refreshAll(store, { concurrency = CONCURRENCY, fetchImpl, now = () => Date.now(), parse } = {}) {
  const { sources } = await store.getState();
  const results = new Array(sources.length);
  let next = 0;
  async function worker() {
    while (next < sources.length) {
      const i = next++;
      results[i] = await refreshSource(store, sources[i], { fetchImpl, now, parse });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  await store.setLastRefresh(now());
  return { results, allFailed: results.length > 0 && results.every((r) => !r.ok) };
}
