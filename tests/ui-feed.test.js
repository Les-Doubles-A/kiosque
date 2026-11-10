import { describe, it, expect } from "vitest";
import { startApp, $, titles } from "./ui-helpers.js";
import { renderFeed, truncate } from "../src/ui.js";
import { RSS, HOSTILE, fakeResponse } from "./fixtures.js";

const feedResponse = (xml) => async () => fakeResponse(xml);

async function withFeed(xml) {
  const ctx = await startApp({ fetchImpl: feedResponse(xml) });
  $("feed-url").value = "https://exemple.fr/rss.xml";
  await ctx.app.addSource("https://exemple.fr/rss.xml");
  return ctx;
}

describe("état vide (AC-F2-4)", () => {
  it("affiche le message et le bouton quand il n'y a aucune source", async () => {
    await startApp();
    expect($("empty").hidden).toBe(false);
    expect($("empty-text").textContent).toBe("Aucune source. Ajoute un flux RSS pour commencer.");
    expect($("empty-add").hidden).toBe(false);
  });

  it("place le focus sur le champ d'ajout au clic sur « Ajouter une source »", async () => {
    await startApp();
    $("empty-add").click();
    expect(document.activeElement).toBe($("feed-url"));
  });

  it("n'affiche pas ce bouton quand des sources existent", async () => {
    await withFeed(RSS);
    expect($("empty").hidden).toBe(true);
  });
});

describe("fil (AC-F2-2)", () => {
  it("trie du plus récent au plus ancien et affiche titre, source, date et extrait", async () => {
    await withFeed(RSS);
    expect(titles()).toEqual(["Second article", "Premier article"]);
    const first = document.querySelector("#feed li");
    expect(first.querySelector(".meta").textContent).toContain("Flux de test");
    expect(first.querySelector(".meta").textContent).toMatch(/2026/);
    expect(first.querySelector(".excerpt").textContent).toBe("Texte simple.");
  });

  it("limite l'extrait à 200 caractères", () => {
    expect(truncate("a".repeat(500))).toHaveLength(200);
    expect(truncate("court")).toBe("court");
  });
});

describe("liens (AC-F2-3)", () => {
  it("ouvre chaque titre dans un nouvel onglet avec rel noopener noreferrer", async () => {
    await withFeed(RSS);
    const a = document.querySelector("#feed h3 a");
    expect(a.getAttribute("href")).toBe("https://exemple.fr/a2");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });

  it("n'affiche pas un article dont le lien n'est pas http(s), même s'il arrive jusqu'au rendu", () => {
    document.body.innerHTML = '<ol id="l"></ol>';
    renderFeed(document, $("l"), [
      { title: "dangereux", link: "javascript:alert(1)", sourceTitle: "S", fetchedAt: 1 },
      { title: "sain", link: "https://ok.fr/a", sourceTitle: "S", fetchedAt: 1 },
    ]);
    expect(Array.from(document.querySelectorAll("#l h3")).map((h) => h.textContent)).toEqual(["sain"]);
  });

  it("ignore à l'ajout l'article au lien javascript: d'un flux réel", async () => {
    await withFeed(HOSTILE);
    expect(titles()).not.toContain("Lien dangereux");
  });
});

describe("contenu hostile (AC-F2-5)", () => {
  it("affiche le HTML du titre comme texte inerte : aucun script, aucune image", async () => {
    await withFeed(HOSTILE);
    expect(titles()).toContain("<script>alert(1)</script>Titre piégé");
    expect(document.querySelectorAll("#feed script").length).toBe(0);
    expect(document.querySelectorAll("#feed img").length).toBe(0);
    // Aucun élément dangereux, aucun gestionnaire d'événement en attribut : le HTML du titre n'existe que comme texte.
    const all = Array.from(document.querySelectorAll("#feed *"));
    expect(all.some((el) => ["SCRIPT", "IMG", "IFRAME", "OBJECT"].includes(el.tagName))).toBe(false);
    expect(all.some((el) => Array.from(el.attributes).some((a) => /^on/i.test(a.name)))).toBe(false);
  });

  it("affiche l'extrait sans balise ni code", async () => {
    await withFeed(HOSTILE);
    const text = document.querySelector("#feed").textContent;
    expect(text).toContain("Extrait piégé");
    expect(text).not.toContain("tracker.example");
    expect(text).not.toContain("alert(2)");
    expect(text).not.toContain("alert(3)");
  });
});

// ---------------- T6 : filtre par source ----------------
import { vi } from "vitest";

describe("filtre par source (AC-F2-6)", () => {
  async function twoFeeds() {
    return startApp({
      seed: async (store) => {
        const a = await store.addSource({ url: "https://a.example/rss", origin: "https://a.example", title: "Source A" });
        const b = await store.addSource({ url: "https://b.example/rss", origin: "https://b.example", title: "Source B" });
        await store.upsertItems(a.id, [{ guid: "a1", title: "Article A", link: "https://a.example/1", publishedAt: 3, excerpt: "" }]);
        await store.upsertItems(b.id, [{ guid: "b1", title: "Article B", link: "https://b.example/1", publishedAt: 2, excerpt: "" }, { guid: "b2", title: "Autre B", link: "https://b.example/2", publishedAt: 1, excerpt: "" }]);
        await store.setLastRefresh(1_760_000_000_000);
      },
    });
  }
  const choose = async (value) => { $("source-filter").value = value; $("source-filter").dispatchEvent(new Event("change")); await vi.waitFor(() => {}); await new Promise((r) => setTimeout(r, 20)); };

  it("n'affiche que les articles de la source choisie, puis rétablit tout avec « Toutes les sources »", async () => {
    await twoFeeds();
    expect(titles()).toEqual(["Article A", "Article B", "Autre B"]);
    const optionB = Array.from($("source-filter").options).find((o) => o.textContent === "Source B");
    await choose(optionB.value);
    expect(titles()).toEqual(["Article B", "Autre B"]);
    await choose("");
    expect(titles()).toEqual(["Article A", "Article B", "Autre B"]);
  });

  it("propose « Toutes les sources » en premier, puis chaque source", async () => {
    await twoFeeds();
    expect(Array.from($("source-filter").options).map((o) => o.textContent)).toEqual(["Toutes les sources", "Source A", "Source B"]);
  });
});
