package com.kiosque.app.data

import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class CachedFeed(
    val etag: String? = null,
    val lastModified: String? = null,
    val articles: List<Article> = emptyList(),
    val error: String? = null,
)

/**
 * Etat persistant (fichiers JSON ecrits de facon atomique).
 * Non thread-safe : l'appelant serialise les acces.
 */
class Store(private val dir: File) {
    var sources: List<Source> = DEFAULT_SOURCES
    val cache = HashMap<String, CachedFeed>()
    var favorites: List<Article> = emptyList()
    val read = LinkedHashSet<String>()
    var lastRefresh = 0L

    fun load() {
        readJson("sources.json")?.let {
            sources = JSONArray(it).map { o ->
                val u = o.getString("u").let { MOVED[it] ?: it }
                // Anciens fichiers sans categorie : deduite de l'adresse.
                val c = o.optString("c").takeIf { c -> c in CATEGORIES } ?: defaultCategory(u)
                Source(o.getString("n"), u, o.optBoolean("e", true), c)
            }
        }
        // Sources par defaut apparues depuis la derniere ouverture : ajoutees une seule fois,
        // pour qu'une source supprimee par l'utilisateur ne revienne pas.
        val seen = readJson("defaults_seen.json")?.let { j -> JSONArray(j).let { a -> List(a.length()) { a.getString(it) }.toSet() } }
            ?: DEFAULT_SOURCES.take(V1_DEFAULTS).mapTo(HashSet()) { it.url }
        val missing = DEFAULT_SOURCES.filter { d -> d.url !in seen && sources.none { it.url == d.url } }
        if (missing.isNotEmpty()) {
            sources = sources + missing
            saveSources()
        }
        if (DEFAULT_SOURCES.any { it.url !in seen }) {
            writeJson("defaults_seen.json", JSONArray(DEFAULT_SOURCES.map { it.url }).toString())
        }
        readJson("favorites.json")?.let { favorites = JSONArray(it).map(::articleOf) }
        readJson("read.json")?.let { val a = JSONArray(it); for (i in 0 until a.length()) read += a.getString(i) }
        readJson("cache.json")?.let {
            val o = JSONObject(it)
            lastRefresh = o.optLong("last", 0)
            val feeds = o.getJSONObject("feeds")
            for (url in feeds.keys()) {
                val f = feeds.getJSONObject(url)
                cache[url] = CachedFeed(
                    f.optString("etag").ifEmpty { null },
                    f.optString("lm").ifEmpty { null },
                    f.getJSONArray("a").map(::articleOf),
                )
            }
        }
    }

    /** Remplace les articles d'un flux ; un article non date garde sa date de premiere apparition. */
    fun absorb(url: String, fresh: Outcome.Fresh, now: Long) {
        val old = cache[url]?.articles?.associate { it.link to it.published } ?: emptyMap()
        val articles = if (fresh.articles.none { it.published == 0L }) fresh.articles else {
            fresh.articles.map { if (it.published == 0L) it.copy(published = old[it.link] ?: now) else it }
                .sortedByDescending { it.published }
        }
        cache[url] = CachedFeed(fresh.etag, fresh.lastModified, articles)
    }

    fun setError(url: String, error: String?) {
        val c = cache[url] ?: CachedFeed()
        cache[url] = CachedFeed(c.etag, c.lastModified, c.articles, error)
    }

    /** Fil fusionne des sources actives : sans doublon, du plus recent au plus ancien. */
    fun merged(): List<Article> {
        val seen = HashSet<String>()
        return sources.asSequence()
            .filter { it.enabled }
            .flatMap { s -> cache[s.url]?.articles.orEmpty().asSequence().map { if (it.source == s.name) it else it.copy(source = s.name) } }
            .sortedByDescending { it.published }
            .filter { seen.add(it.link) }
            .take(MAX_FEED)
            .toList()
    }

    fun toggleFavorite(a: Article) {
        favorites = if (favorites.any { it.link == a.link }) favorites.filter { it.link != a.link } else listOf(a) + favorites
        writeJson("favorites.json", JSONArray().apply { favorites.forEach { put(jsonOf(it)) } }.toString())
    }

    fun markRead(link: String) {
        if (!read.add(link)) return
        while (read.size > MAX_READ) read.remove(read.first())
        writeJson("read.json", JSONArray(read.toList()).toString())
    }

    fun saveSources() = writeJson(
        "sources.json",
        JSONArray().apply { sources.forEach { put(JSONObject().put("n", it.name).put("u", it.url).put("e", it.enabled).put("c", it.category)) } }.toString(),
    )

    fun saveCache() {
        val feeds = JSONObject()
        for ((url, f) in cache) {
            feeds.put(url, JSONObject().put("etag", f.etag ?: "").put("lm", f.lastModified ?: "")
                .put("a", JSONArray().apply { f.articles.forEach { put(jsonOf(it)) } }))
        }
        writeJson("cache.json", JSONObject().put("last", lastRefresh).put("feeds", feeds).toString())
    }

    private fun readJson(name: String): String? = runCatching {
        AtomicFile(File(dir, name)).readFully().toString(Charsets.UTF_8)
    }.getOrNull()

    private fun writeJson(name: String, json: String) {
        val f = AtomicFile(File(dir, name))
        val out = f.startWrite()
        try {
            out.write(json.toByteArray(Charsets.UTF_8))
            f.finishWrite(out)
        } catch (e: Exception) {
            f.failWrite(out)
        }
    }

    companion object {
        const val MAX_FEED = 600
        private const val MAX_READ = 4000

        private fun jsonOf(a: Article) = JSONObject()
            .put("l", a.link).put("t", a.title).put("s", a.source).put("e", a.excerpt).put("p", a.published)

        private fun articleOf(o: JSONObject) =
            Article(o.getString("l"), o.getString("t"), o.optString("s"), o.optString("e"), o.optLong("p"))

        private inline fun <T> JSONArray.map(f: (JSONObject) -> T): List<T> =
            List(length()) { f(getJSONObject(it)) }
    }
}
