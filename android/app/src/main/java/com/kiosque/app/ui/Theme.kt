package com.kiosque.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Palette fixe (pas de couleurs dynamiques) : textes a contraste >= 4.5:1 (WCAG AA).
private val Light = lightColorScheme(
    primary = Color(0xFFC23A1E),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDBD1),
    onPrimaryContainer = Color(0xFF3B0900),
    secondaryContainer = Color(0xFFF6D9D0),
    onSecondaryContainer = Color(0xFF3B0900),
    background = Color(0xFFF3F1EC),
    onBackground = Color(0xFF16181D),
    surface = Color(0xFFF3F1EC),
    onSurface = Color(0xFF16181D),
    surfaceVariant = Color(0xFFE8E5DE),
    onSurfaceVariant = Color(0xFF555A64),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color.White,
    surfaceContainer = Color(0xFFEBE8E1),
    surfaceContainerHigh = Color(0xFFFFFFFF),
    outline = Color(0xFF8A8F98),
    outlineVariant = Color(0xFFE2DED5),
    error = Color(0xFFB3261E),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFFF7A59),
    onPrimary = Color(0xFF1A0A05),
    primaryContainer = Color(0xFF5C1A0B),
    onPrimaryContainer = Color(0xFFFFDBD1),
    secondaryContainer = Color(0xFF4A2A22),
    onSecondaryContainer = Color(0xFFFFDBD1),
    background = Color(0xFF111214),
    onBackground = Color(0xFFEEEFF1),
    surface = Color(0xFF111214),
    onSurface = Color(0xFFEEEFF1),
    surfaceVariant = Color(0xFF2A2D33),
    onSurfaceVariant = Color(0xFFA6ABB4),
    surfaceContainerLowest = Color(0xFF1C1E22),
    surfaceContainerLow = Color(0xFF1C1E22),
    surfaceContainer = Color(0xFF181A1D),
    surfaceContainerHigh = Color(0xFF23262B),
    outline = Color(0xFF6E737C),
    outlineVariant = Color(0xFF2E3137),
    error = Color(0xFFFF8A80),
)

private val SourceLight = listOf(0xFF1F5FBF, 0xFF1E7A46, 0xFF6B3FB5, 0xFF0F6E78, 0xFFA04A1C, 0xFFA8326E, 0xFF556010, 0xFF3D4FA0)
private val SourceDark = listOf(0xFF82B4FF, 0xFF72D69E, 0xFFB9A0FF, 0xFF62D2DD, 0xFFF2A472, 0xFFF490C4, 0xFFC8D85E, 0xFF9FAEF4)

/** Couleur stable par source, pour reperer d'un coup d'oeil. */
@Composable
@ReadOnlyComposable
fun sourceColor(name: String): Color {
    var h = 0x811C9DC5u
    for (b in name.encodeToByteArray()) h = (h xor b.toUByte().toUInt()) * 0x01000193u
    val list = if (isSystemInDarkTheme()) SourceDark else SourceLight
    return Color(list[(h % 8u).toInt()])
}

private val Type = Typography().let { t ->
    t.copy(
        headlineSmall = t.headlineSmall.copy(fontWeight = FontWeight.Bold, fontSize = 26.sp),
        titleLarge = t.titleLarge.copy(fontWeight = FontWeight.SemiBold, fontSize = 22.sp),
        titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 25.sp, letterSpacing = 0.sp),
        bodyLarge = t.bodyLarge.copy(fontSize = 17.sp, lineHeight = 24.sp),
        bodyMedium = t.bodyMedium.copy(fontSize = 15.sp, lineHeight = 21.sp),
        labelLarge = t.labelLarge.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
        labelMedium = t.labelMedium.copy(fontSize = 13.5.sp, lineHeight = 18.sp),
    )
}

@Composable
fun KiosqueTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, typography = Type, content = content)
}
