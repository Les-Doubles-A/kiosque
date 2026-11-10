import { MSG } from "./lib/messages.js";
import { DEFAULT_SOURCES } from "./lib/default-sources.js";
import { refreshAll, needsRefresh } from "./lib/refresh.js";
import { parseFeed } from "./lib/feed-parser.js";
import { isHttpLink } from "./lib/url.js";
import { truncate, formatDate } from "./ui.js";

/** Nombre maximal d'articles affichés (les plus récents) ; le stockage en garde davantage. */
export const MAX_DISPLAY = 200;

/** Ajoute les sources par défaut qui manquent (sans doublon). */
export async function ensureDefaultSources(store) {
  const { sources } = await store.getState();
  const known = new Set(sources.map((s) => s.url));
  for (const d of DEFAULT_SOURCES) {
    if (known.has(d.url)) continue;
    await store.addSource({ url: d.url, origin: new URL(d.url).origin, title: d.title });
  }
}

/** Liste d'articles : titre (lien), source et date, extrait. Tout texte passe par textContent. */
export function renderNews(document, listEl, items) {
  listEl.replaceChildren();
  for (const item of items) {
    if (!isHttpLink(item.link)) continue;
    const li = document.createElement("li");
    const h2 = document.createElement("h2");
    h2.className = "headline";
    const a = document.createElement("a");
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = item.title;
    h2.append(a);

    const meta = document.createElement("p");
    meta.className = "meta";
    const date = formatDate(item.publishedAt ?? item.fetchedAt);
    meta.textContent = date ? `${item.sourceTitle} · ${date}` : item.sourceTitle;

    li.append(h2, meta);
    if (item.excerpt) {
      const ex = document.createElement("p");
      ex.className = "excerpt";
      ex.textContent = truncate(item.excerpt);
      li.append(ex);
    }
    listEl.append(li);
  }
}

export function initNews({ document, store, fetchImpl, now = () => Date.now(), parse = parseFeed }) {
  const $ = (id) => document.getElementById(id);
  const els = {
    refresh: $("refresh-button"), status: $("refresh-status"), last: $("last-refresh"),
    offline: $("offline-banner"), problems: $("problems"), summary: $("problems-summary"),
    problemsList: $("problems-list"), empty: $("empty"), news: $("news"),
  };
  let refreshing = null;

  async function render() {
    const state = await store.getState();
    const items = (await store.getFeed()).slice(0, MAX_DISPLAY);
    renderNews(document, els.news, items);

    els.empty.hidden = items.length > 0 || Boolean(refreshing);
    els.empty.textContent = items.length === 0 ? "Aucune actualité pour l'instant. Clique sur « Actualiser »." : "";
    els.last.textContent = state.meta.lastRefreshAt ? `Dernière actualisation : ${formatDate(state.meta.lastRefreshAt)}` : "";

    const failing = state.sources.filter((s) => s.lastError);
    els.problems.hidden = failing.length === 0;
    els.summary.textContent = failing.length === 1 ? "1 source n'a pas répondu" : `${failing.length} sources n'ont pas répondu`;
    els.problemsList.replaceChildren();
    for (const s of failing) {
      const li = document.createElement("li");
      li.textContent = `${s.title} : ${s.lastError}`;
      els.problemsList.append(li);
    }
    els.refresh.disabled = Boolean(refreshing);
  }

  function refresh() {
    if (refreshing) return refreshing;
    els.refresh.disabled = true;
    els.status.textContent = MSG.REFRESHING;
    refreshing = (async () => {
      try {
        const { allFailed } = await refreshAll(store, { fetchImpl, now, parse });
        els.offline.hidden = !allFailed;
        els.offline.textContent = allFailed ? MSG.OFFLINE : "";
      } catch (err) {
        console.error("Kiosque : actualisation impossible", err);
        els.offline.hidden = false;
        els.offline.textContent = "L'actualisation a échoué. Réessaie dans un instant.";
      } finally {
        refreshing = null;
        els.status.textContent = "";
        await render();
      }
    })();
    return refreshing;
  }

  els.refresh.addEventListener("click", () => { refresh(); });

  const ready = (async () => {
    await ensureDefaultSources(store);
    await render();
  })();
  // À l'ouverture : actualisation automatique si jamais faite ou vieille de plus de 30 minutes.
  const autoRefresh = ready.then(async () => {
    const { meta } = await store.getState();
    if (needsRefresh(meta, now())) return refresh();
  });

  return { ready, autoRefresh, refresh, render };
}
