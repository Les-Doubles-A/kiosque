import { createStore } from "./lib/store.js";
import { initApp } from "./ui.js";

const store = createStore(chrome.storage.local);
initApp({ document, store, chromeApi: chrome, fetchImpl: (...args) => fetch(...args) });
