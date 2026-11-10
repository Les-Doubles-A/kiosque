import { vi } from "vitest";

/** Zone de stockage en mémoire, à l'image de chrome.storage.local (API à promesses). */
export function createStorageArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    async set(obj) {
      Object.assign(data, structuredClone(obj));
    },
  };
}

/** Faux objet `chrome` minimal pour les tests. */
export function createChromeMock({ permissionGranted = true } = {}) {
  const clickListeners = [];
  return {
    clickListeners,
    action: { onClicked: { addListener: (fn) => clickListeners.push(fn) } },
    tabs: { create: vi.fn() },
    runtime: { getURL: (path) => `chrome-extension://test-id/${path}` },
    permissions: { request: vi.fn(async () => permissionGranted) },
    storage: { local: createStorageArea() },
  };
}
