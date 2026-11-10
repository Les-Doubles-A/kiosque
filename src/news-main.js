import { createStore } from "./lib/store.js";
import { initNews } from "./news.js";

const store = createStore(chrome.storage.local);
initNews({ document, store, fetchImpl: (...args) => fetch(...args) });
