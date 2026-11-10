package com.kiosque.app.data

import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Nettoyage de texte et dates, sans dependance Android (testable sur JVM). */
object Text {
    const val EXCERPT_MAX = 240

    fun htmlToText(s: String): String = collapse(decode(strip(s)))

    fun clip(s: String, max: Int): String {
        if (s.length <= max) return s
        val cut = s.substring(0, max)
        val sp = cut.lastIndexOf(' ')
        return (if (sp > max / 2) cut.substring(0, sp) else cut).trimEnd() + "…"
    }

    private fun strip(s: String): String {
        if (s.indexOf('<') < 0) return s
        val out = StringBuilder(s.length)
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c == '<' && i + 1 < s.length) {
                val n = s[i + 1]
                if (n.isLetter() || n == '/' || n == '!' || n == '?') {
                    val close = when {
                        s.regionMatches(i, "<script", 0, 7, ignoreCase = true) -> "</script"
                        s.regionMatches(i, "<style", 0, 6, ignoreCase = true) -> "</style"
                        else -> null
                    }
                    val from = if (close != null) s.indexOf(close, i, ignoreCase = true).let { if (it < 0) s.length else it } else i
                    val gt = if (from >= s.length) -1 else s.indexOf('>', from)
                    i = if (gt < 0) s.length else gt + 1
                    out.append(' ')
                    continue
                }
            }
            out.append(c)
            i++
        }
        return out.toString()
    }

    private fun decode(s: String): String {
        if (s.indexOf('&') < 0) return s
        val out = StringBuilder(s.length)
        var i = 0
        while (i < s.length) {
            if (s[i] == '&') {
                val semi = s.indexOf(';', i)
                if (semi in (i + 2)..(i + 11)) {
                    val r = entity(s.substring(i + 1, semi))
                    if (r != null) {
                        out.append(r)
                        i = semi + 1
                        continue
                    }
                }
            }
            out.append(s[i])
            i++
        }
        return out.toString()
    }

    private fun entity(name: String): String? {
        if (name.startsWith("#")) {
            val code = if (name.length > 1 && (name[1] == 'x' || name[1] == 'X')) {
                name.substring(2).toIntOrNull(16)
            } else {
                name.substring(1).toIntOrNull()
            }
            return code?.takeIf { Character.isValidCodePoint(it) }?.let { String(Character.toChars(it)) }
        }
        return NAMED[name]
    }

    private val NAMED = mapOf(
        "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\"", "apos" to "'", "nbsp" to " ",
        "rsquo" to "’", "lsquo" to "‘", "ldquo" to "“", "rdquo" to "”",
        "laquo" to "«", "raquo" to "»", "hellip" to "…", "mdash" to "—", "ndash" to "–", "euro" to "€",
        "eacute" to "é", "egrave" to "è", "ecirc" to "ê", "euml" to "ë", "agrave" to "à", "acirc" to "â",
        "ccedil" to "ç", "icirc" to "î", "iuml" to "ï", "ocirc" to "ô", "ugrave" to "ù", "ucirc" to "û",
        "Eacute" to "É", "Agrave" to "À", "Ccedil" to "Ç", "deg" to "°", "copy" to "©",
    )

    private fun collapse(s: String): String {
        val out = StringBuilder(s.length)
        var space = false
        for (c in s) {
            if (c.isWhitespace()) {
                space = out.isNotEmpty()
            } else {
                if (space) out.append(' ')
                space = false
                out.append(c)
            }
        }
        return out.toString()
    }

    private val RFC822_NAMED = DateTimeFormatter.ofPattern("EEE, d MMM yyyy HH:mm[:ss] zzz", Locale.ENGLISH)

    /** RFC 2822 (RSS), ISO 8601 avec ou sans fuseau (Atom, dc:date). Secondes Unix. */
    fun parseDate(raw: String): Long? {
        val s = raw.trim()
        if (s.isEmpty()) return null
        return runCatching { ZonedDateTime.parse(s, DateTimeFormatter.RFC_1123_DATE_TIME).toEpochSecond() }
            .recoverCatching { ZonedDateTime.parse(s, RFC822_NAMED).toEpochSecond() }
            .recoverCatching { OffsetDateTime.parse(s).toEpochSecond() }
            .recoverCatching { Instant.parse(s).epochSecond }
            .recoverCatching { LocalDateTime.parse(s).atZone(ZoneId.systemDefault()).toEpochSecond() }
            .getOrNull()
    }
}
