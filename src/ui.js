import { MSG } from "./lib/messages.js";
import { validateFeedUrl, isHttpLink } from "./lib/url.js";
import { fetchFeedText, messageFor, refreshAll, needsRefresh } from "./lib/refresh.js";
import { parseFeed } from "./lib/feed-parser.js";
import { MAX_SOURCES } from "./lib/store.js";

export const EXCERPT_DISPLAY_MAX = 200;

export function truncate(text, max = EXCERPT_DISPLAY_MAX) {
  const t = text || "";
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export function formatDate(ms, locale = "fr-FR") {
  if (ms == null) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}

export function unreadLabel(n) {
  return n === 1 ? "1 non lu" : `${n} non lus`;
}

/** Met à jour l'aspect « lu » d'un article : style, texte « Lu » et bouton de bascule. */
export function paintRead(document, li, item) {
  li.classList.toggle("read", item.read);
  const meta = li.querySelector(".meta");
  const oldBadge = meta.querySelector(".badge");
  if (oldBadge) oldBadge.remove();
  if (item.read) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Lu";
    meta.append(badge);
  }
  const btn = li.querySelector("button.toggle-read");
  const label = item.read ? "Marquer comme non lu" : "Marquer comme lu";
  btn.textContent = label;
  btn.setAttribute("aria-label", `${label} : ${item.title}`);
}

/**
 * Construit le fil. Tout texte issu d'un flux passe par textContent, jamais par innerHTML.
 * handlers (facultatif) : { onOpen(item, li), onToggleRead(item, li) }
 */
export function renderFeed(document, listEl, items, handlers = {}) {
  listEl.replaceChildren();
  for (const item of items) {
    if (!isHttpLink(item.link)) continue; // défense en profondeur (AC-F2-3)
    const li = document.createElement("li");
    li.dataset.itemId = item.id ?? "";

    const h3 = document.createElement("h3");
    const a = document.createElement("a");
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = item.title;
    if (handlers.onOpen) {
      a.addEventListener("click", () => handlers.onOpen(item, li)); // clic et touche Entrée
      a.addEventListener("auxclick", (e) => { if (e.button === 1) handlers.onOpen(item, li); });
    }
    h3.append(a);

    const meta = document.createElement("p");
    meta.className = "meta";
    const date = formatDate(item.publishedAt ?? item.fetchedAt);
    meta.textContent = date ? `${item.sourceTitle} · ${date}` : item.sourceTitle;

    li.append(h3, meta);
    if (item.excerpt) {
      const ex = document.createElement("p");
      ex.className = "excerpt";
      ex.textContent = truncate(item.excerpt);
      li.append(ex);
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toggle-read secondary";
    if (handlers.onToggleRead) toggle.addEventListener("click", () => handlers.onToggleRead(item, li));
    actions.append(toggle);
    li.append(actions);

    paintRead(document, li, item);
    listEl.append(li);
  }
}

export function renderSources(document, listEl, sources, { onRemove } = {}) {
  listEl.replaceChildren();
  for (const s of sources) {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("strong");
    name.textContent = s.title;
    const url = document.createElement("div");
    url.className = "url";
    url.textContent = s.url;
    info.append(name, url);
    if (s.lastError) {
      const err = document.createElement("div");
      err.className = "source-error";
      err.setAttribute("role", "alert");
      err.textContent = `Erreur : ${s.lastError}`;
      info.append(err);
    }
    const del = document.createElement("button");
    del.type = "button";
    del.className = "remove secondary";
    del.textContent = "Supprimer";
    del.setAttribute("aria-label", `Supprimer : ${s.title}`);
    if (onRemove) del.addEventListener("click", () => onRemove(s));
    li.append(info, del);
    listEl.append(li);
  }
}

export function initApp({
  document, store, chromeApi, fetchImpl,
  now = () => Date.now(), parse = parseFeed,
  confirmFn = (message) => globalThis.confirm(message),
}) {
  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("add-form"), input: $("feed-url"), button: $("add-button"),
    status: $("status"), error: $("error"), sources: $("sources-list"), sourcesTitle: $("sources-title"),
    feed: $("feed"), feedTitle: $("feed-title"), empty: $("empty"), emptyText: $("empty-text"), emptyAdd: $("empty-add"),
    refresh: $("refresh-button"), refreshStatus: $("refresh-status"), lastRefresh: $("last-refresh"),
    offline: $("offline-banner"), filter: $("source-filter"), unreadOnly: $("unread-only"), unreadCount: $("unread-count"),
  };
  let cachedSources = []; // lu de façon synchrone pour ne pas perdre le geste de l'utilisateur avant la demande de permission
  let cachedMeta = { lastRefreshAt: null };
  let refreshing = null;
  const filter = { sourceId: null, unreadOnly: false };

  const setStatus = (text) => { els.status.textContent = text || ""; };
  const setError = (text) => { els.error.textContent = text || ""; };

  function fillFilter(sources) {
    if (filter.sourceId && !sources.some((s) => s.id === filter.sourceId)) filter.sourceId = null;
    els.filter.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Toutes les sources";
    els.filter.append(all);
    for (const s of sources) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.title;
      els.filter.append(o);
    }
    els.filter.value = filter.sourceId ?? "";
  }

  function updateCounter() {
    const n = els.feed.querySelectorAll("li:not(.read)").length;
    els.unreadCount.textContent = unreadLabel(n);
  }

  async function render() {
    const state = await store.getState();
    cachedSources = state.sources;
    cachedMeta = state.meta;
    renderSources(document, els.sources, state.sources, { onRemove: removeSource });
    fillFilter(state.sources);

    const all = await store.getFeed({ sourceId: filter.sourceId });
    const items = filter.unreadOnly ? all.filter((i) => !i.read) : all;
    renderFeed(document, els.feed, items, { onOpen: openItem, onToggleRead: toggleRead });
    updateCounter();

    const noSource = state.sources.length === 0;
    els.empty.hidden = !(noSource || items.length === 0);
    els.emptyText.textContent = noSource ? MSG.EMPTY_NO_SOURCE : filter.unreadOnly ? MSG.EMPTY_NO_UNREAD : MSG.EMPTY_NO_ITEM;
    els.emptyAdd.hidden = !noSource;
    els.refresh.disabled = noSource || Boolean(refreshing);
    els.lastRefresh.textContent = state.meta.lastRefreshAt
      ? `Dernière actualisation : ${formatDate(state.meta.lastRefreshAt)}`
      : "";
  }

  // ----- F3 : actualisation -----
  function refresh() {
    if (refreshing) return refreshing;
    if (cachedSources.length === 0) return Promise.resolve();
    els.refresh.disabled = true;
    els.refreshStatus.textContent = MSG.REFRESHING;
    refreshing = (async () => {
      try {
        const { allFailed } = await refreshAll(store, { fetchImpl, now, parse });
        els.offline.hidden = !allFailed;
        els.offline.textContent = allFailed ? MSG.OFFLINE : "";
      } catch (err) {
        setError(messageFor(err));
      } finally {
        refreshing = null;
        els.refreshStatus.textContent = "";
        await render();
      }
    })();
    return refreshing;
  }

  // ----- F4 : lu / non lu -----
  async function setRead(item, li, read) {
    try {
      await store.setRead(item.id, read);
    } catch (err) {
      return setError(messageFor(err));
    }
    item.read = read;
    if (filter.unreadOnly) {
      await render(); // l'article lu quitte la liste
      els.feedTitle.focus();
    } else {
      paintRead(document, li, item);
      updateCounter();
    }
  }
  const openItem = (item, li) => { if (!item.read) return setRead(item, li, true); };
  const toggleRead = (item, li) => setRead(item, li, !item.read);

  // ----- F1 : sources -----
  async function removeSource(source) {
    if (!confirmFn(MSG.confirmDelete(source.title))) return;
    try {
      await store.removeSource(source.id);
    } catch (err) {
      return setError(messageFor(err));
    }
    if (filter.sourceId === source.id) filter.sourceId = null;
    await render();
    els.sourcesTitle.focus();
  }

  async function addSource(text) {
    setError("");
    setStatus("");
    const v = validateFeedUrl(text);
    if (!v.ok) return setError(v.error);
    if (cachedSources.some((s) => s.url === v.url)) return setError(MSG.DUPLICATE);
    if (cachedSources.length >= MAX_SOURCES) return setError(MSG.LIMIT);

    // Appelée aussitôt après le geste de l'utilisateur (clic sur « Ajouter »).
    let granted = false;
    try {
      granted = await chromeApi.permissions.request({ origins: [`${v.origin}/*`] });
    } catch (err) {
      console.error("Kiosque : demande de permission impossible", err);
    }
    if (!granted) return setError(MSG.denied(v.host));

    els.button.disabled = true;
    setStatus(MSG.ADDING);
    try {
      const xml = await fetchFeedText(v.url, { fetchImpl });
      const parsed = parse(xml);
      const source = await store.addSource({ url: v.url, origin: v.origin, title: parsed.title || v.host });
      await store.upsertItems(source.id, parsed.items, now());
      await store.setSourceStatus(source.id, { lastFetchedAt: now(), lastError: null });
      els.input.value = "";
      setStatus("");
      await render();
    } catch (err) {
      setStatus("");
      setError(messageFor(err));
    } finally {
      els.button.disabled = false;
    }
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    addSource(els.input.value);
  });
  els.emptyAdd.addEventListener("click", () => els.input.focus());
  els.refresh.addEventListener("click", () => { refresh(); });
  els.filter.addEventListener("change", () => { filter.sourceId = els.filter.value || null; render(); });
  els.unreadOnly.addEventListener("change", () => { filter.unreadOnly = els.unreadOnly.checked; render(); });

  const ready = render();
  // AC-F3-1 : à l'ouverture, actualisation automatique si la dernière date de plus de 30 minutes.
  const autoRefresh = ready.then(() => (cachedSources.length > 0 && needsRefresh(cachedMeta, now()) ? refresh() : undefined));

  return { render, addSource, refresh, ready, autoRefresh };
}
