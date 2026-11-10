package com.kiosque.app.data

import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserException
import java.io.InputStream

class NotAFeedException : Exception("Pas un flux RSS/Atom")

/** Analyse en flux de RSS 2.0, RSS 1.0 (RDF) et Atom 1.0. */
object FeedParser {
    private const val MAX_PER_FEED = 60
    private const val NONE = 0
    private const val TITLE = 1
    private const val LINK = 2
    private const val GUID = 3
    private const val DATE = 4
    private const val SUMMARY = 5

    private class Raw {
        var title = ""
        var link = ""
        var guid = ""
        var date = ""
        var summary = ""
    }

    fun parse(input: InputStream, source: String, now: Long): List<Article> {
        val p = Xml.newPullParser()
        p.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        runCatching { p.setFeature("http://xmlpull.org/v1/doc/features.html#relaxed", true) }
        p.setInput(input, null) // encodage lu dans la declaration XML

        val out = ArrayList<Article>(64)
        val buf = StringBuilder()
        var raw = Raw()
        var isFeed = false
        var itemDepth = -1
        var field = NONE
        var fieldDepth = -1

        try {
            var ev = p.eventType
            while (ev != XmlPullParser.END_DOCUMENT) {
                when (ev) {
                    XmlPullParser.START_TAG -> {
                        val name = p.name
                        val depth = p.depth
                        if (depth == 1) isFeed = name == "rss" || name == "feed" || name == "RDF"
                        if (itemDepth < 0) {
                            if (name == "item" || name == "entry") {
                                itemDepth = depth
                                raw = Raw()
                            }
                        } else if (field == NONE && depth == itemDepth + 1) {
                            val f = fieldOf(name)
                            val href = if (f == LINK) p.getAttributeValue(null, "href") else null
                            if (href != null) {
                                val rel = p.getAttributeValue(null, "rel")
                                if (raw.link.isEmpty() && (rel == null || rel == "alternate")) raw.link = href.trim()
                            } else if (f != NONE) {
                                field = f
                                fieldDepth = depth
                                buf.setLength(0)
                            }
                        }
                    }
                    XmlPullParser.TEXT -> if (field != NONE) buf.append(p.text)
                    XmlPullParser.END_TAG -> {
                        val depth = p.depth
                        if (field != NONE && depth == fieldDepth) {
                            val v = buf.toString().trim()
                            when (field) {
                                TITLE -> if (raw.title.isEmpty()) raw.title = v
                                LINK -> if (raw.link.isEmpty()) raw.link = v
                                GUID -> if (raw.guid.isEmpty()) raw.guid = v
                                DATE -> if (raw.date.isEmpty()) raw.date = v
                                SUMMARY -> if (raw.summary.isEmpty()) raw.summary = v
                            }
                            field = NONE
                        } else if (depth == itemDepth) {
                            itemDepth = -1
                            finish(raw, source, now)?.let(out::add)
                        }
                    }
                }
                ev = p.next()
            }
        } catch (e: XmlPullParserException) {
            // Flux tronque : on garde ce qui a deja ete lu.
            if (out.isEmpty()) throw NotAFeedException()
        }
        if (!isFeed && out.isEmpty()) throw NotAFeedException()
        out.sortByDescending { it.published }
        return if (out.size > MAX_PER_FEED) out.subList(0, MAX_PER_FEED).toList() else out
    }

    private fun fieldOf(name: String) = when (name) {
        "title" -> TITLE
        "link" -> LINK
        "guid", "id" -> GUID
        "pubDate", "published", "updated", "date" -> DATE
        "description", "summary", "content", "encoded" -> SUMMARY
        else -> NONE
    }

    /** Extrait nettoye ; vide s'il ne fait que repeter le titre (flux Google News). */
    private fun excerptFor(title: String, summary: String): String {
        val ex = Text.htmlToText(summary)
        return if (ex.startsWith(title.take(40))) "" else Text.clip(ex, Text.EXCERPT_MAX)
    }

    private fun finish(r: Raw, source: String, now: Long): Article? {
        val link = when {
            r.link.startsWith("http") -> r.link
            r.guid.startsWith("http") -> r.guid
            else -> return null
        }
        val title = Text.clip(Text.htmlToText(r.title), 300)
        if (title.isEmpty()) return null
        return Article(
            link = link,
            title = title,
            source = source,
            excerpt = excerptFor(title, r.summary),
            published = Text.parseDate(r.date)?.coerceAtMost(now) ?: 0L,
        )
    }
}
