package com.kiosque.app.data

import androidx.compose.runtime.Immutable

@Immutable
data class Article(
    val link: String,
    val title: String,
    val source: String,
    val excerpt: String,
    /** Secondes Unix ; 0 = non date. */
    val published: Long,
)

@Immutable
data class Source(val name: String, val url: String, val enabled: Boolean = true, val category: String = CATEGORIES[0])

/** Categories affichees, dans l'ordre des onglets. */
val CATEGORIES = listOf("Général", "Économie", "Tech", "Sécurité")

/** Categorie d'une source par defaut (d'apres son adresse), sinon « Général ». */
fun defaultCategory(url: String): String = DEFAULT_SOURCES.firstOrNull { it.url == url }?.category ?: CATEGORIES[0]

/** Adresses de flux qui ont change : ancienne -> nouvelle. Appliquees au chargement. */
val MOVED = mapOf(
    // Redirige vers http:// (refuse par Android).
    "https://www.la-croix.com/RSS/UNIVERS" to "https://www.la-croix.com/feeds/rss/site.xml",
)

/** Les 16 premieres sont celles de la version 1 (voir `Store.load`). */
const val V1_DEFAULTS = 16

val DEFAULT_SOURCES = listOf(
    Source("BBC", "https://feeds.bbci.co.uk/news/rss.xml"),
    Source("BBC Eco", "https://feeds.bbci.co.uk/news/business/rss.xml", category = "Économie"),
    Source("BBC Tech", "https://feeds.bbci.co.uk/news/technology/rss.xml", category = "Tech"),
    Source("France 24", "https://www.france24.com/fr/rss"),
    Source("France Info", "https://www.franceinfo.fr/titres.rss"),
    Source("France Info Marchés", "https://www.franceinfo.fr/economie/bourse/marches.rss", category = "Économie"),
    Source("France Info Tech", "https://www.franceinfo.fr/internet.rss", category = "Tech"),
    Source("Reuters", "https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US"),
    Source("AP", "https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en"),
    Source("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    Source("The Guardian", "https://www.theguardian.com/world/rss"),
    Source("NPR", "https://feeds.npr.org/1001/rss.xml"),
    Source("NYT", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
    Source("RFI", "https://www.rfi.fr/en/rss"),
    Source("Le Monde", "https://www.lemonde.fr/en/rss/une.xml"),
    Source("LMI Sécurité", "https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml", category = "Sécurité"),
    // Ajoutees en version 2 (flux verifies le 07/11/2026).
    Source("Le Monde FR", "https://www.lemonde.fr/rss/une.xml"),
    Source("Le Figaro", "https://www.lefigaro.fr/rss/figaro_actualites.xml"),
    Source("Libération", "https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml"),
    Source("20 Minutes", "https://www.20minutes.fr/feeds/rss-une.xml"),
    Source("Ouest-France", "https://www.ouest-france.fr/rss/une"),
    Source("RFI FR", "https://www.rfi.fr/fr/rss"),
    Source("Euronews", "https://fr.euronews.com/rss"),
    Source("Courrier international", "https://www.courrierinternational.com/feed/all/rss.xml"),
    Source("La Croix", "https://www.la-croix.com/feeds/rss/site.xml"),
    Source("L'Express", "https://www.lexpress.fr/arc/outboundfeeds/rss/alaune.xml"),
    Source("Le Temps", "https://www.letemps.ch/articles.rss"),
    Source("Radio-Canada", "https://ici.radio-canada.ca/rss/4159"),
    Source("DW", "https://rss.dw.com/rdf/rss-en-all"),
    Source("CBC", "https://www.cbc.ca/webfeed/rss/rss-topstories"),
    Source("ABC Australia", "https://www.abc.net.au/news/feed/2942460/rss.xml"),
    Source("PBS NewsHour", "https://www.pbs.org/newshour/feeds/rss/headlines"),
    Source("AFP", "https://news.google.com/rss/search?q=when:24h+site:afp.com&hl=fr&gl=FR&ceid=FR:fr"),
    Source("Le Monde Économie", "https://www.lemonde.fr/economie/rss_full.xml", category = "Économie"),
    Source("Le Figaro Économie", "https://www.lefigaro.fr/rss/figaro_economie.xml", category = "Économie"),
    Source("BFM Business", "https://www.bfmtv.com/rss/economie/", category = "Économie"),
    Source("Alternatives Économiques", "https://www.alternatives-economiques.fr/rss.xml", category = "Économie"),
    Source("Guardian Business", "https://www.theguardian.com/uk/business/rss", category = "Économie"),
    Source("NYT Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", category = "Économie"),
    Source("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", category = "Économie"),
    Source("NPR Économie", "https://feeds.npr.org/1017/rss.xml", category = "Économie"),
    Source("The Economist", "https://www.economist.com/finance-and-economics/rss.xml", category = "Économie"),
    Source("BCE", "https://www.ecb.europa.eu/rss/press.html", category = "Économie"),
    Source("Numerama", "https://www.numerama.com/feed/", category = "Tech"),
    Source("Les Numériques", "https://www.lesnumeriques.com/rss.xml", category = "Tech"),
    Source("Next", "https://next.ink/feed/", category = "Tech"),
    Source("Le Monde Pixels", "https://www.lemonde.fr/pixels/rss_full.xml", category = "Tech"),
    Source("Korben", "https://korben.info/feed", category = "Tech"),
    Source("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", category = "Tech"),
    Source("The Verge", "https://www.theverge.com/rss/index.xml", category = "Tech"),
    Source("Wired", "https://www.wired.com/feed/rss", category = "Tech"),
    Source("TechCrunch", "https://techcrunch.com/feed/", category = "Tech"),
    Source("Guardian Tech", "https://www.theguardian.com/uk/technology/rss", category = "Tech"),
    Source("NYT Tech", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", category = "Tech"),
    Source("MIT Technology Review", "https://www.technologyreview.com/feed/", category = "Tech"),
    Source("Engadget", "https://www.engadget.com/rss.xml", category = "Tech"),
    Source("CERT-FR Alertes", "https://www.cert.ssi.gouv.fr/alerte/feed/", category = "Sécurité"),
    Source("CERT-FR Avis", "https://www.cert.ssi.gouv.fr/avis/feed/", category = "Sécurité"),
    Source("CERT-FR Actualités", "https://www.cert.ssi.gouv.fr/actualite/feed/", category = "Sécurité"),
    Source("Cybermalveillance.gouv", "https://www.cybermalveillance.gouv.fr/feed/atom-flux-actualites", category = "Sécurité"),
    Source("Zataz", "https://www.zataz.com/feed/", category = "Sécurité"),
    Source("Krebs on Security", "https://krebsonsecurity.com/feed/", category = "Sécurité"),
    Source("The Hacker News", "https://feeds.feedburner.com/TheHackersNews", category = "Sécurité"),
    Source("BleepingComputer", "https://www.bleepingcomputer.com/feed/", category = "Sécurité"),
    Source("Schneier on Security", "https://www.schneier.com/feed/atom/", category = "Sécurité"),
    Source("SecurityWeek", "https://www.securityweek.com/feed/", category = "Sécurité"),
    Source("Dark Reading", "https://www.darkreading.com/rss.xml", category = "Sécurité"),
    Source("CISA", "https://www.cisa.gov/cybersecurity-advisories/all.xml", category = "Sécurité"),
    Source("The Record", "https://therecord.media/feed/", category = "Sécurité"),
    Source("Google Project Zero", "https://googleprojectzero.blogspot.com/feeds/posts/default", category = "Sécurité"),
)
