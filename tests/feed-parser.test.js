import { describe, it, expect } from "vitest";
import { parseFeed, NotAFeedError } from "../src/lib/feed-parser.js";
import { RSS, ATOM, HTML_PAGE, RDF, HOSTILE } from "./fixtures.js";

describe("parseFeed — flux valides", () => {
  it("lit un flux RSS 2.0", () => {
    const { title, items } = parseFeed(RSS);
    expect(title).toBe("Flux de test");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ guid: "guid-1", title: "Premier article", link: "https://exemple.fr/a1" });
    expect(items[0].publishedAt).toBe(Date.parse("2026-10-16T08:00:00Z"));
    expect(items[0].excerpt).toBe("Résumé du premier article.");
  });

  it("lit un flux Atom 1.0 et choisit le lien alternate", () => {
    const { title, items } = parseFeed(ATOM);
    expect(title).toBe("Flux Atom");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ guid: "urn:uuid:e1", link: "https://atom.exemple.fr/e1" });
    expect(items[0].publishedAt).toBe(Date.parse("2026-10-15T10:00:00Z"));
  });

  it("donne un identifiant stable entre deux analyses (AC-F3-4)", () => {
    const a = parseFeed(RSS).items.map((i) => i.guid);
    const b = parseFeed(RSS).items.map((i) => i.guid);
    expect(a).toEqual(b);
  });

  it("utilise le lien comme identifiant quand le flux n'en fournit pas", () => {
    const { items } = parseFeed(HOSTILE);
    expect(items.find((i) => i.title === "Sans date").guid).toBe("h5");
  });
});

describe("parseFeed — ce qui n'est pas un flux (AC-F1-4)", () => {
  it("rejette une page HTML", () => expect(() => parseFeed(HTML_PAGE)).toThrow(NotAFeedError));
  it("rejette du texte quelconque", () => expect(() => parseFeed("bonjour")).toThrow(NotAFeedError));
  it("rejette RSS 1.0 (non pris en charge dans le MVP)", () => expect(() => parseFeed(RDF)).toThrow(NotAFeedError));
  it("porte le message exact du critère", () => {
    expect(() => parseFeed(HTML_PAGE)).toThrow("Ce n'est pas un flux RSS ou Atom.");
  });
});

describe("parseFeed — contenu hostile (AC-F2-3, AC-F2-5)", () => {
  const { items } = parseFeed(HOSTILE);

  it("ignore les articles au lien non http(s), sans lien ou sans titre", () => {
    expect(items.map((i) => i.title)).toEqual(expect.not.arrayContaining(["Lien dangereux", "Sans lien", ""]));
    expect(items.every((i) => /^https?:\/\//.test(i.link))).toBe(true);
  });

  it("garde le HTML du titre comme texte brut, sans le transformer", () => {
    const hostile = items.find((i) => i.guid === "h1");
    expect(hostile.title).toBe("<script>alert(1)</script>Titre piégé");
  });

  it("retire toutes les balises de l'extrait, scripts compris", () => {
    const hostile = items.find((i) => i.guid === "h1");
    expect(hostile.excerpt).toBe("Extrait piégé");
    expect(hostile.excerpt).not.toContain("<");
    expect(hostile.excerpt).not.toContain("alert");
  });

  it("laisse la date vide quand elle manque", () => {
    expect(items.find((i) => i.guid === "h5").publishedAt).toBeNull();
  });
});

describe("bornes du stockage (R5, H5)", () => {
  const wrap = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;

  it("tronque un titre démesuré à 300 caractères", () => {
    const { items } = parseFeed(wrap(`<item><title>${"t".repeat(5000)}</title><link>https://e.fr/1</link></item>`));
    expect(items[0].title).toHaveLength(300);
  });

  it("ignore un lien de plus de 1 000 caractères", () => {
    const { items } = parseFeed(wrap(`<item><title>ok</title><link>https://e.fr/${"a".repeat(1100)}</link></item><item><title>court</title><link>https://e.fr/2</link></item>`));
    expect(items.map((i) => i.title)).toEqual(["court"]);
  });

  it("remplace un identifiant de plus de 200 caractères par une empreinte courte et stable", () => {
    const xml = wrap(`<item><title>a</title><link>https://e.fr/1</link><guid>${"g".repeat(900)}</guid></item>`);
    const a = parseFeed(xml).items[0].guid;
    const b = parseFeed(xml).items[0].guid;
    expect(a).toBe(b);
    expect(a.length).toBeLessThan(30);
  });

  it("garde un identifiant ordinaire tel quel", () => {
    expect(parseFeed(wrap(`<item><title>a</title><link>https://e.fr/1</link><guid>abc</guid></item>`)).items[0].guid).toBe("abc");
  });
});
