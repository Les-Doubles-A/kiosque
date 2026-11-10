import { isHttpLink } from "./url.js";
import { MSG } from "./messages.js";

export const EXCERPT_STORE_MAX = 300;
export const TITLE_MAX = 300;
export const LINK_MAX = 1000;
export const GUID_MAX = 200;

/** Empreinte courte et stable pour les identifiants démesurés (garde le stockage borné). */
function shortHash(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return `h${h.toString(36)}-${s.length.toString(36)}`;
}

export class NotAFeedError extends Error {
  constructor() {
    super(MSG.NOT_A_FEED);
    this.name = "NotAFeedError";
  }
}

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

/** Enfants directs portant ce nom local (indépendant des espaces de noms). */
function children(el, localName) {
  return Array.from(el.children).filter((c) => c.localName === localName);
}
function childText(el, ...names) {
  for (const n of names) {
    const c = children(el, n)[0];
    if (c && clean(c.textContent)) return clean(c.textContent);
  }
  return "";
}

/** Retire le HTML d'un texte : balises supprimées, script et style jetés, aucune ressource chargée. */
function htmlToText(html, DOMParserImpl) {
  if (!html) return "";
  const doc = new DOMParserImpl().parseFromString(String(html), "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  return clean(doc.body ? doc.body.textContent : "");
}

function parseDate(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function atomLink(entry) {
  const links = children(entry, "link");
  const alt = links.find((l) => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate");
  return alt ? (alt.getAttribute("href") || "").trim() : "";
}

function normalizeItem(raw, DOMParserImpl) {
  const title = clean(raw.title).slice(0, TITLE_MAX);
  if (!title || !isHttpLink(raw.link) || raw.link.length > LINK_MAX) return null;
  const id = raw.guid || raw.link;
  return {
    guid: id.length > GUID_MAX ? shortHash(id) : id,
    title,
    link: raw.link,
    publishedAt: parseDate(raw.date),
    excerpt: htmlToText(raw.summary, DOMParserImpl).slice(0, EXCERPT_STORE_MAX),
  };
}

/**
 * Analyse un flux RSS 2.0 ou Atom 1.0.
 * @returns {{title: string, items: Array}} ; lève NotAFeedError sinon.
 */
export function parseFeed(xmlText, DOMParserImpl = globalThis.DOMParser) {
  let doc;
  try {
    doc = new DOMParserImpl().parseFromString(String(xmlText), "application/xml");
  } catch {
    throw new NotAFeedError();
  }
  if (!doc || !doc.documentElement || doc.getElementsByTagName("parsererror").length) {
    throw new NotAFeedError();
  }
  const root = doc.documentElement;
  let title = "";
  let raws = [];

  if (root.localName === "rss") {
    const channel = children(root, "channel")[0];
    if (!channel) throw new NotAFeedError();
    title = childText(channel, "title");
    raws = children(channel, "item").map((it) => ({
      title: childText(it, "title"),
      link: childText(it, "link"),
      guid: childText(it, "guid"),
      date: childText(it, "pubDate", "date"),
      summary: childText(it, "description", "encoded"),
    }));
  } else if (root.localName === "feed") {
    title = childText(root, "title");
    raws = children(root, "entry").map((en) => ({
      title: childText(en, "title"),
      link: atomLink(en),
      guid: childText(en, "id"),
      date: childText(en, "published", "updated"),
      summary: childText(en, "summary", "content"),
    }));
  } else {
    throw new NotAFeedError(); // dont RSS 1.0 (RDF), non pris en charge dans le MVP
  }

  const items = raws.map((r) => normalizeItem(r, DOMParserImpl)).filter(Boolean);
  return { title, items };
}
