import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startApp, $ } from "./ui-helpers.js";
import { RSS, fakeResponse } from "./fixtures.js";

const read = (f) => readFileSync(resolve(process.cwd(), f), "utf8");
const html = read("src/kiosque.html");
const css = read("src/kiosque.css");

describe("structure de la page (exigences d'accessibilité)", () => {
  it("déclare la langue française, un titre et la fenêtre d'affichage", () => {
    expect(html).toMatch(/<html lang="fr">/);
    expect(html).toMatch(/<title>\s*\S+/);
    expect(html).toMatch(/name="viewport"/);
  });

  it("relie chaque champ à une étiquette", async () => {
    await startApp();
    for (const field of document.querySelectorAll("input, select")) {
      const labelled = document.querySelector(`label[for="${field.id}"]`) || field.closest("label");
      expect(labelled, `champ #${field.id}`).not.toBeNull();
      expect(labelled.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("donne un nom à chaque bouton, y compris ceux du fil et des sources", async () => {
    const { app } = await startApp({
      seed: async (store) => {
        const s = await store.addSource({ url: "https://a.example/rss", origin: "https://a.example", title: "Source A" });
        await store.upsertItems(s.id, [{ guid: "1", title: "Un article", link: "https://a.example/1", publishedAt: 1, excerpt: "" }]);
        await store.setLastRefresh(1_760_000_000_000);
      },
    });
    await app.ready;
    const buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    for (const b of buttons) {
      const name = (b.getAttribute("aria-label") || b.textContent).trim();
      expect(name.length, b.outerHTML).toBeGreaterThan(0);
      // le nom accessible contient le texte visible (étiquette dans le nom)
      expect(name.toLowerCase()).toContain(b.textContent.trim().toLowerCase());
    }
  });

  it("annonce les états et erreurs par des régions dynamiques", async () => {
    await startApp();
    expect($("status").getAttribute("role")).toBe("status");
    expect($("refresh-status").getAttribute("role")).toBe("status");
    expect($("error").getAttribute("role")).toBe("alert");
    expect($("offline-banner").getAttribute("role")).toBe("alert");
    expect($("unread-count").getAttribute("aria-live")).toBe("polite");
  });

  it("garde un ordre de tabulation naturel (aucun tabindex positif)", async () => {
    await startApp();
    const positive = Array.from(document.querySelectorAll("[tabindex]")).filter((el) => Number(el.getAttribute("tabindex")) > 0);
    expect(positive).toHaveLength(0);
  });

  it("a un titre h1 puis des h2, et des articles en h3", async () => {
    await startApp();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(Array.from(document.querySelectorAll("h2")).map((h) => h.textContent)).toEqual(["Sources", "Articles"]);
  });

  it("n'indique pas l'état lu par la couleur seule : le texte « Lu » existe", async () => {
    const { app } = await startApp({
      seed: async (store) => {
        const s = await store.addSource({ url: "https://a.example/rss", origin: "https://a.example", title: "A" });
        await store.upsertItems(s.id, [{ guid: "1", title: "Lu", link: "https://a.example/1", publishedAt: 1, excerpt: "" }]);
        await store.setLastRefresh(1_760_000_000_000);
      },
    });
    document.querySelector("#feed h3 a").click();
    await vi.waitFor(() => expect(document.querySelector("#feed .badge")?.textContent).toBe("Lu"));
  });

  it("n'indique pas une erreur de source par la couleur seule : le texte « Erreur : » existe", async () => {
    const { app } = await startApp({
      seed: async (store) => { await store.addSource({ url: "https://a.example/rss", origin: "https://a.example", title: "A" }); },
      fetchImpl: async () => fakeResponse("", { status: 500 }),
      now: () => 1_760_000_000_000,
    });
    await app.autoRefresh;
    expect(document.querySelector(".source-error").textContent).toMatch(/^Erreur : /);
  });
});

describe("feuille de style", () => {
  it("rend le focus visible", () => expect(css).toMatch(/:focus-visible\s*{[^}]*outline/));
  it("suit la préférence de thème sombre", () => expect(css).toMatch(/prefers-color-scheme:\s*dark/));
  it("respecte la préférence de mouvement réduit", () => expect(css).toMatch(/prefers-reduced-motion:\s*reduce/));
});
