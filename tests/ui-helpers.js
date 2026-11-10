import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStore } from "../src/lib/store.js";
import { createStorageArea, createChromeMock } from "./chrome-mock.js";
import { initApp } from "../src/ui.js";

/** Charge le corps de la vraie page kiosque.html dans le DOM de test. */
export function loadPage() {
  const html = readFileSync(resolve(process.cwd(), "src/kiosque.html"), "utf8");
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
}

export async function startApp({ fetchImpl, permissionGranted = true, initial, seed, now = () => 1_760_000_000_000, confirmFn = () => true } = {}) {
  loadPage();
  let n = 0;
  const store = createStore(createStorageArea(initial), { makeId: () => `s${++n}` });
  const chromeApi = createChromeMock({ permissionGranted });
  if (seed) await seed(store);
  const app = initApp({ document, store, chromeApi, confirmFn, now, fetchImpl: fetchImpl ?? (async () => { throw new Error("réseau interdit"); }) });
  await app.ready;
  return { app, store, chromeApi };
}

export const $ = (id) => document.getElementById(id);
export const titles = () => Array.from(document.querySelectorAll("#feed h3")).map((h) => h.textContent);
