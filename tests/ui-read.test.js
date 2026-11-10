import { describe, it, expect, vi } from "vitest";
import { startApp, $, titles } from "./ui-helpers.js";
import { createStore } from "../src/lib/store.js";
import { initApp } from "../src/ui.js";
import { createChromeMock, createStorageArea } from "./chrome-mock.js";
import { loadPage } from "./ui-helpers.js";

const seed = async (store) => {
  const s = await store.addSource({ url: "https://a.example/rss", origin: "https://a.example", title: "Source A" });
  await store.upsertItems(s.id, [
    { guid: "1", title: "Article 1", link: "https://a.example/1", publishedAt: 3, excerpt: "" },
    { guid: "2", title: "Article 2", link: "https://a.example/2", publishedAt: 2, excerpt: "" },
    { guid: "3", title: "Article 3", link: "https://a.example/3", publishedAt: 1, excerpt: "" },
  ]);
  await store.setLastRefresh(1_760_000_000_000);
};
const li = (n) => document.querySelector(`#feed li:nth-child(${n})`);
const counter = () => $("unread-count").textContent;

describe("marquer lu à l'ouverture (AC-F4-1)", () => {
  it("passe l'article en « Lu », avec un texte en plus du style", async () => {
    const { store } = await startApp({ seed });
    expect(li(1).classList.contains("read")).toBe(false);
    expect(li(1).querySelector(".badge")).toBeNull();
    li(1).querySelector("h3 a").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(li(1).classList.contains("read")).toBe(true));
    expect(li(1).querySelector(".badge").textContent).toBe("Lu");
    const stored = Object.values((await store.getState()).items).find((i) => i.title === "Article 1");
    expect(stored.read).toBe(true);
  });

  it("réagit aussi au clic du milieu mais pas aux autres boutons", async () => {
    await startApp({ seed });
    li(2).querySelector("h3 a").dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(li(2).classList.contains("read")).toBe(false);
    li(2).querySelector("h3 a").dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    await vi.waitFor(() => expect(li(2).classList.contains("read")).toBe(true));
  });
});

describe("compteur et filtre (AC-F4-2)", () => {
  it("affiche le nombre de non lus et le met à jour", async () => {
    await startApp({ seed });
    expect(counter()).toBe("3 non lus");
    li(1).querySelector("h3 a").click();
    await vi.waitFor(() => expect(counter()).toBe("2 non lus"));
    li(2).querySelector("h3 a").click();
    await vi.waitFor(() => expect(counter()).toBe("1 non lu"));
  });

  it("n'affiche aucun article lu avec « Non lus seulement »", async () => {
    await startApp({ seed });
    li(1).querySelector("h3 a").click();
    await vi.waitFor(() => expect(li(1).classList.contains("read")).toBe(true));
    $("unread-only").checked = true;
    $("unread-only").dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(titles()).toEqual(["Article 2", "Article 3"]));
    expect(document.querySelectorAll("#feed li.read")).toHaveLength(0);
    expect(counter()).toBe("2 non lus");
  });

  it("retire de la liste un article qu'on vient de lire quand le filtre est actif", async () => {
    await startApp({ seed });
    $("unread-only").checked = true;
    $("unread-only").dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(titles()).toHaveLength(3));
    li(1).querySelector("h3 a").click();
    await vi.waitFor(() => expect(titles()).toEqual(["Article 2", "Article 3"]));
    expect(document.activeElement).toBe($("feed-title"));
  });

  it("compte les non lus de la source filtrée", async () => {
    await startApp({
      seed: async (store) => {
        await seed(store);
        const b = await store.addSource({ url: "https://b.example/rss", origin: "https://b.example", title: "Source B" });
        await store.upsertItems(b.id, [{ guid: "b", title: "Article B", link: "https://b.example/1", publishedAt: 9, excerpt: "" }]);
      },
    });
    expect(counter()).toBe("4 non lus");
    const optionA = Array.from($("source-filter").options).find((o) => o.textContent === "Source A");
    $("source-filter").value = optionA.value;
    $("source-filter").dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(counter()).toBe("3 non lus"));
  });

  it("affiche un message quand il n'y a plus d'article non lu", async () => {
    await startApp({ seed });
    for (const n of [1, 2, 3]) li(n).querySelector("button.toggle-read").click();
    await vi.waitFor(() => expect(counter()).toBe("0 non lus"));
    $("unread-only").checked = true;
    $("unread-only").dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect($("empty-text").textContent).toBe("Aucun article non lu."));
    expect($("empty-add").hidden).toBe(true);
  });
});

describe("persistance (AC-F4-3)", () => {
  it("retrouve l'état lu quand la page est rouverte sur le même stockage", async () => {
    const { store } = await startApp({ seed });
    li(1).querySelector("h3 a").click();
    await vi.waitFor(() => expect(li(1).classList.contains("read")).toBe(true));
    // « redémarrage » : nouvelle page, nouvelle instance du stockage sur les mêmes données
    loadPage();
    const reopenedStore = createStore(createStorageArea(await dumpArea(store)));
    const app = initApp({ document, store: reopenedStore, chromeApi: createChromeMock(), fetchImpl: async () => { throw new Error("hors ligne"); }, now: () => 1_760_000_000_000, confirmFn: () => true });
    await app.ready;
    expect(li(1).classList.contains("read")).toBe(true);
    expect(li(1).querySelector(".badge").textContent).toBe("Lu");
    expect(li(2).classList.contains("read")).toBe(false);
    expect(counter()).toBe("2 non lus");
  });
});
async function dumpArea(store) {
  const s = await store.getState();
  return { schemaVersion: s.schemaVersion, sources: s.sources, items: s.items, meta: s.meta };
}

describe("bascule manuelle (AC-F4-4)", () => {
  it("remet un article lu en non lu avec un bouton nommé, et met le compteur à jour", async () => {
    await startApp({ seed });
    const btn = () => li(1).querySelector("button.toggle-read");
    expect(btn().getAttribute("aria-label")).toBe("Marquer comme lu : Article 1");
    btn().click();
    await vi.waitFor(() => expect(li(1).classList.contains("read")).toBe(true));
    expect(counter()).toBe("2 non lus");
    expect(btn().textContent).toBe("Marquer comme non lu");
    expect(btn().getAttribute("aria-label")).toBe("Marquer comme non lu : Article 1");
    btn().click();
    await vi.waitFor(() => expect(li(1).classList.contains("read")).toBe(false));
    expect(counter()).toBe("3 non lus");
    expect(li(1).querySelector(".badge")).toBeNull();
  });

  it("est un vrai <button> : atteignable et activable au clavier", async () => {
    await startApp({ seed });
    const btn = li(1).querySelector("button.toggle-read");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.type).toBe("button");
    expect(btn.tabIndex).toBe(0);
  });
});
