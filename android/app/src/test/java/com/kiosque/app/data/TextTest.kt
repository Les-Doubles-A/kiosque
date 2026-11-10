package com.kiosque.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class TextTest {
    @Test
    fun stripsAndDecodes() {
        assertEquals("Bonjour le monde & co", Text.htmlToText("<p>Bonjour&nbsp;<b>le</b> monde &amp; co</p>"))
        assertEquals("a b", Text.htmlToText("a<script>x()</script>b"))
        assertEquals("l’été", Text.htmlToText("l&#8217;&eacute;t&#xE9;"))
        assertEquals("1 < 2 & 3", Text.htmlToText("1 < 2 & 3"))
    }

    @Test
    fun clipsOnWord() {
        assertEquals("un deux…", Text.clip("un deux trois", 9))
        assertEquals("court", Text.clip("court", 10))
    }

    @Test
    fun parsesDates() {
        assertEquals(1_794_045_600L, Text.parseDate("Sat, 07 Nov 2026 10:00:00 GMT"))
        assertEquals(1_794_045_600L, Text.parseDate("Sat, 07 Nov 2026 11:00:00 +0100"))
        assertEquals(1_794_045_600L, Text.parseDate("2026-11-07T10:00:00Z"))
        assertEquals(1_794_045_600L, Text.parseDate("Sat, 7 Nov 2026 05:00:00 EST"))
        assertNotNull(Text.parseDate("2026-11-06T16:37:19"))
        assertNull(Text.parseDate("n'importe quoi"))
    }
}
