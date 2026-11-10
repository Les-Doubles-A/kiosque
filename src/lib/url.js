import { MSG } from "./messages.js";

/**
 * Valide et normalise l'adresse d'un flux saisie par l'utilisateur.
 * - https uniquement ; hôte en minuscules ; fragment (#…) retiré ;
 * - la chaîne de requête (?…) est conservée telle quelle (flux Google News).
 * @returns {{ok: true, url: string, origin: string, host: string} | {ok: false, error: string}}
 */
export function validateFeedUrl(text) {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return { ok: false, error: MSG.INVALID_URL };
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: MSG.INVALID_URL };
  }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password) {
    return { ok: false, error: MSG.INVALID_URL };
  }
  u.hash = "";
  return { ok: true, url: u.href, origin: u.origin, host: u.hostname };
}

/** Vrai si l'adresse est un lien http(s) exploitable pour un article. */
export function isHttpLink(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
