use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Article {
    /// Lien de l'article, sert aussi d'identifiant.
    pub link: String,
    pub title: String,
    pub source: String,
    #[serde(default)]
    pub excerpt: String,
    /// Secondes Unix.
    pub published: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Source {
    pub name: String,
    pub url: String,
    #[serde(default = "yes")]
    pub enabled: bool,
    /// Une des `CATEGORIES`. Vide dans les anciens fichiers : complete au chargement.
    #[serde(default)]
    pub category: String,
}

/// Categories affichees, dans l'ordre des onglets.
pub const CATEGORIES: [&str; 4] = ["Général", "Économie", "Tech", "Sécurité"];

fn yes() -> bool {
    true
}

impl Source {
    pub fn new(name: &str, url: &str, category: &str) -> Self {
        Self {
            name: name.into(),
            url: url.into(),
            enabled: true,
            category: category.into(),
        }
    }
}

/// Categorie d'une source par defaut (d'apres son adresse), sinon « Général ».
pub fn default_category(url: &str) -> &'static str {
    DEFAULTS
        .iter()
        .find(|d| d.1 == url)
        .map_or(CATEGORIES[0], |d| d.2)
}

/// Les 16 premieres sont celles de la version 1 (voir `Store::open_in`).
pub const V1_DEFAULTS: usize = 16;

pub const DEFAULTS: [(&str, &str, &str); 70] = [
    ("BBC", "https://feeds.bbci.co.uk/news/rss.xml", "Général"),
    (
        "BBC Eco",
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "Économie",
    ),
    (
        "BBC Tech",
        "https://feeds.bbci.co.uk/news/technology/rss.xml",
        "Tech",
    ),
    ("France 24", "https://www.france24.com/fr/rss", "Général"),
    (
        "France Info",
        "https://www.franceinfo.fr/titres.rss",
        "Général",
    ),
    (
        "France Info Marches",
        "https://www.franceinfo.fr/economie/bourse/marches.rss",
        "Économie",
    ),
    (
        "France Info Tech",
        "https://www.franceinfo.fr/internet.rss",
        "Tech",
    ),
    (
        "Reuters",
        "https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US",
        "Général",
    ),
    (
        "AP",
        "https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en",
        "Général",
    ),
    (
        "Al Jazeera",
        "https://www.aljazeera.com/xml/rss/all.xml",
        "Général",
    ),
    (
        "The Guardian",
        "https://www.theguardian.com/world/rss",
        "Général",
    ),
    ("NPR", "https://feeds.npr.org/1001/rss.xml", "Général"),
    (
        "NYT",
        "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "Général",
    ),
    ("RFI", "https://www.rfi.fr/en/rss", "Général"),
    (
        "Le Monde",
        "https://www.lemonde.fr/en/rss/une.xml",
        "Général",
    ),
    (
        "LMI Securite",
        "https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml",
        "Sécurité",
    ),
    // Ajoutees en version 2 (flux verifies le 07/11/2026).
    (
        "Le Monde FR",
        "https://www.lemonde.fr/rss/une.xml",
        "Général",
    ),
    (
        "Le Figaro",
        "https://www.lefigaro.fr/rss/figaro_actualites.xml",
        "Général",
    ),
    (
        "Libération",
        "https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml",
        "Général",
    ),
    (
        "20 Minutes",
        "https://www.20minutes.fr/feeds/rss-une.xml",
        "Général",
    ),
    (
        "Ouest-France",
        "https://www.ouest-france.fr/rss/une",
        "Général",
    ),
    ("RFI FR", "https://www.rfi.fr/fr/rss", "Général"),
    ("Euronews", "https://fr.euronews.com/rss", "Général"),
    (
        "Courrier international",
        "https://www.courrierinternational.com/feed/all/rss.xml",
        "Général",
    ),
    (
        "La Croix",
        "https://www.la-croix.com/feeds/rss/site.xml",
        "Général",
    ),
    (
        "L'Express",
        "https://www.lexpress.fr/arc/outboundfeeds/rss/alaune.xml",
        "Général",
    ),
    ("Le Temps", "https://www.letemps.ch/articles.rss", "Général"),
    (
        "Radio-Canada",
        "https://ici.radio-canada.ca/rss/4159",
        "Général",
    ),
    ("DW", "https://rss.dw.com/rdf/rss-en-all", "Général"),
    (
        "CBC",
        "https://www.cbc.ca/webfeed/rss/rss-topstories",
        "Général",
    ),
    (
        "ABC Australia",
        "https://www.abc.net.au/news/feed/2942460/rss.xml",
        "Général",
    ),
    (
        "PBS NewsHour",
        "https://www.pbs.org/newshour/feeds/rss/headlines",
        "Général",
    ),
    (
        "AFP",
        "https://news.google.com/rss/search?q=when:24h+site:afp.com&hl=fr&gl=FR&ceid=FR:fr",
        "Général",
    ),
    (
        "Le Monde Économie",
        "https://www.lemonde.fr/economie/rss_full.xml",
        "Économie",
    ),
    (
        "Le Figaro Économie",
        "https://www.lefigaro.fr/rss/figaro_economie.xml",
        "Économie",
    ),
    (
        "BFM Business",
        "https://www.bfmtv.com/rss/economie/",
        "Économie",
    ),
    (
        "Alternatives Économiques",
        "https://www.alternatives-economiques.fr/rss.xml",
        "Économie",
    ),
    (
        "Guardian Business",
        "https://www.theguardian.com/uk/business/rss",
        "Économie",
    ),
    (
        "NYT Business",
        "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
        "Économie",
    ),
    (
        "CNBC",
        "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "Économie",
    ),
    (
        "NPR Économie",
        "https://feeds.npr.org/1017/rss.xml",
        "Économie",
    ),
    (
        "The Economist",
        "https://www.economist.com/finance-and-economics/rss.xml",
        "Économie",
    ),
    (
        "BCE",
        "https://www.ecb.europa.eu/rss/press.html",
        "Économie",
    ),
    ("Numerama", "https://www.numerama.com/feed/", "Tech"),
    (
        "Les Numériques",
        "https://www.lesnumeriques.com/rss.xml",
        "Tech",
    ),
    ("Next", "https://next.ink/feed/", "Tech"),
    (
        "Le Monde Pixels",
        "https://www.lemonde.fr/pixels/rss_full.xml",
        "Tech",
    ),
    ("Korben", "https://korben.info/feed", "Tech"),
    (
        "Ars Technica",
        "https://feeds.arstechnica.com/arstechnica/index",
        "Tech",
    ),
    (
        "The Verge",
        "https://www.theverge.com/rss/index.xml",
        "Tech",
    ),
    ("Wired", "https://www.wired.com/feed/rss", "Tech"),
    ("TechCrunch", "https://techcrunch.com/feed/", "Tech"),
    (
        "Guardian Tech",
        "https://www.theguardian.com/uk/technology/rss",
        "Tech",
    ),
    (
        "NYT Tech",
        "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "Tech",
    ),
    (
        "MIT Technology Review",
        "https://www.technologyreview.com/feed/",
        "Tech",
    ),
    ("Engadget", "https://www.engadget.com/rss.xml", "Tech"),
    (
        "CERT-FR Alertes",
        "https://www.cert.ssi.gouv.fr/alerte/feed/",
        "Sécurité",
    ),
    (
        "CERT-FR Avis",
        "https://www.cert.ssi.gouv.fr/avis/feed/",
        "Sécurité",
    ),
    (
        "CERT-FR Actualités",
        "https://www.cert.ssi.gouv.fr/actualite/feed/",
        "Sécurité",
    ),
    (
        "Cybermalveillance.gouv",
        "https://www.cybermalveillance.gouv.fr/feed/atom-flux-actualites",
        "Sécurité",
    ),
    ("Zataz", "https://www.zataz.com/feed/", "Sécurité"),
    (
        "Krebs on Security",
        "https://krebsonsecurity.com/feed/",
        "Sécurité",
    ),
    (
        "The Hacker News",
        "https://feeds.feedburner.com/TheHackersNews",
        "Sécurité",
    ),
    (
        "BleepingComputer",
        "https://www.bleepingcomputer.com/feed/",
        "Sécurité",
    ),
    (
        "Schneier on Security",
        "https://www.schneier.com/feed/atom/",
        "Sécurité",
    ),
    (
        "SecurityWeek",
        "https://www.securityweek.com/feed/",
        "Sécurité",
    ),
    (
        "Dark Reading",
        "https://www.darkreading.com/rss.xml",
        "Sécurité",
    ),
    (
        "CISA",
        "https://www.cisa.gov/cybersecurity-advisories/all.xml",
        "Sécurité",
    ),
    ("The Record", "https://therecord.media/feed/", "Sécurité"),
    (
        "Google Project Zero",
        "https://googleprojectzero.blogspot.com/feeds/posts/default",
        "Sécurité",
    ),
];

/// Adresses de flux qui ont change : (ancienne, nouvelle). Appliquees au chargement.
pub const MOVED: [(&str, &str); 1] = [
    // Redirige vers http:// (refuse par Android).
    (
        "https://www.la-croix.com/RSS/UNIVERS",
        "https://www.la-croix.com/feeds/rss/site.xml",
    ),
];

pub fn default_sources() -> Vec<Source> {
    DEFAULTS
        .iter()
        .map(|&(n, u, c)| Source::new(n, u, c))
        .collect()
}
