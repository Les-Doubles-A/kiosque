// Sources chargées automatiquement par la page « Actualités ».
// Les adresses viennent de répertoires de flux tiers (voir product/PRODUCT_BRIEF.md, sections 6.1 et 6.2).
// Tout nom d'hôte ajouté ici doit aussi figurer dans « host_permissions » de manifest.json (un test le vérifie).
export const DEFAULT_SOURCES = [
  { title: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { title: "BBC · Économie", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { title: "BBC · Technologie", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { title: "France 24", url: "https://www.france24.com/fr/rss" },
  { title: "France Info", url: "https://www.franceinfo.fr/titres.rss" },
  { title: "France Info · Marchés", url: "https://www.franceinfo.fr/economie/bourse/marches.rss" },
  { title: "France Info · Tech", url: "https://www.franceinfo.fr/internet.rss" },
  { title: "Reuters (via Google News)", url: "https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US" },
  { title: "AP (via Google News)", url: "https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en" },
  { title: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { title: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { title: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
  { title: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { title: "RFI", url: "https://www.rfi.fr/en/rss" },
  { title: "Le Monde", url: "https://www.lemonde.fr/en/rss/une.xml" },
  { title: "Le Monde Informatique · Sécurité", url: "https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml" },
];

/** Hôtes distincts des sources par défaut (pour les permissions du manifeste). */
export function defaultHosts() {
  return [...new Set(DEFAULT_SOURCES.map((s) => new URL(s.url).host))];
}
