package com.kiosque.app.data

import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException

sealed interface Outcome {
    class Fresh(val articles: List<Article>, val etag: String?, val lastModified: String?) : Outcome
    data object NotModified : Outcome
    class Failed(val message: String) : Outcome
}

/** Recuperation d'un flux, requete conditionnelle (ETag / Last-Modified), 4 Mo max. */
object Net {
    private const val MAX_BYTES = 4L * 1024 * 1024

    fun fetch(source: Source, etag: String?, lastModified: String?, now: Long): Outcome =
        fetchRaw(source, etag, lastModified, now).also {
            // Visible avec `adb logcat -s Kiosque` : quelle source echoue et pourquoi.
            if (it is Outcome.Failed) android.util.Log.w("Kiosque", "${source.name} (${source.url}) : ${it.message}")
        }

    private fun fetchRaw(source: Source, etag: String?, lastModified: String?, now: Long): Outcome {
        val c = try {
            URL(source.url).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            return Outcome.Failed("Adresse invalide")
        }
        return try {
            c.connectTimeout = 6_000
            c.readTimeout = 12_000
            c.instanceFollowRedirects = true
            c.setRequestProperty("User-Agent", "Kiosque/1.0 (Android)")
            c.setRequestProperty("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5")
            etag?.let { c.setRequestProperty("If-None-Match", it) }
            lastModified?.let { c.setRequestProperty("If-Modified-Since", it) }
            when (val code = c.responseCode) {
                304 -> Outcome.NotModified
                !in 200..299 -> Outcome.Failed("HTTP $code")
                else -> Limited(c.inputStream.buffered(64 * 1024), MAX_BYTES).use { input ->
                    Outcome.Fresh(
                        FeedParser.parse(input, source.name, now),
                        c.getHeaderField("ETag"),
                        c.getHeaderField("Last-Modified"),
                    )
                }
            }
        } catch (e: UnknownHostException) {
            Outcome.Failed("Hors ligne")
        } catch (e: SocketTimeoutException) {
            Outcome.Failed("Délai dépassé")
        } catch (e: NotAFeedException) {
            Outcome.Failed(e.message ?: "Flux invalide")
        } catch (e: IOException) {
            Outcome.Failed("Connexion impossible")
        } finally {
            c.disconnect()
        }
    }

    /** Coupe la lecture au-dela de `max` octets (le parseur voit une fin de flux). */
    private class Limited(input: InputStream, private var left: Long) : FilterInputStream(input) {
        override fun read(): Int = if (left <= 0) -1 else super.read().also { if (it >= 0) left-- }
        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (left <= 0) return -1
            val n = super.read(b, off, minOf(len.toLong(), left).toInt())
            if (n > 0) left -= n
            return n
        }
    }
}
