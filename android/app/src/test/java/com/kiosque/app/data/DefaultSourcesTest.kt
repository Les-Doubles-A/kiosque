package com.kiosque.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DefaultSourcesTest {
    @Test
    fun defaultsAreConsistent() {
        assertEquals(DEFAULT_SOURCES.size, DEFAULT_SOURCES.map { it.url }.toSet().size)
        assertEquals(DEFAULT_SOURCES.size, DEFAULT_SOURCES.map { it.name }.toSet().size)
        assertTrue(DEFAULT_SOURCES.all { it.url.startsWith("https://") && it.category in CATEGORIES })
        // Chaque categorie a des sources.
        assertTrue(CATEGORIES.all { c -> DEFAULT_SOURCES.any { it.category == c } })
        // Les sources de la version 1 restent en tete (migration des installations existantes).
        assertEquals("BBC", DEFAULT_SOURCES.first().name)
        assertEquals("LMI Sécurité", DEFAULT_SOURCES[V1_DEFAULTS - 1].name)
        assertEquals("Tech", defaultCategory("https://next.ink/feed/"))
        assertEquals("Général", defaultCategory("https://exemple.fr/rss"))
    }
}
