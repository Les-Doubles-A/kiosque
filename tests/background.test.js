import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createChromeMock } from "./chrome-mock.js";
import { defaultHosts } from "../src/lib/default-sources.js";

describe("service worker (AC-F2-1)", () => {
  beforeEach(() => vi.resetModules());

  it("ouvre la page Actualités dans un nouvel onglet au clic sur l'icône", async () => {
    const chrome = createChromeMock();
    globalThis.chrome = chrome;
    await import("../src/background.js");
    expect(chrome.clickListeners).toHaveLength(1);
    chrome.clickListeners[0]();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: "chrome-extension://test-id/src/news.html" });
  });
});

describe("manifeste", () => {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf8"));

  it("est en Manifest V3", () => expect(manifest.manifest_version).toBe(3));
  it("ne demande que la permission storage, plus l'accès aux seuls sites des sources par défaut", () => {
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(defaultHosts().map((h) => `https://${h}/*`));
    expect(manifest.host_permissions.every((p) => p.startsWith("https://") && !p.includes("*."))).toBe(true);
  });
  it("limite les permissions d'hôte optionnelles à https", () => {
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
  });
  it("déclare le service worker et les icônes", () => {
    expect(manifest.background.service_worker).toBe("src/background.js");
    expect(Object.keys(manifest.icons)).toEqual(["16", "48", "128"]);
  });
});
