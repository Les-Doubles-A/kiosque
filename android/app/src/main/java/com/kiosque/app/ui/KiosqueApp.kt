package com.kiosque.app.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kiosque.app.data.Article
import com.kiosque.app.data.CATEGORIES
import com.kiosque.app.data.Source
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private enum class Tab { Live, Favorites }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KiosqueApp(vm: KiosqueViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()

    var tab by rememberSaveable { mutableStateOf(Tab.Live) }
    var query by rememberSaveable { mutableStateOf("") }
    var searching by rememberSaveable { mutableStateOf(false) }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var source by rememberSaveable { mutableStateOf<String?>(null) }
    var showSources by rememberSaveable { mutableStateOf(false) }
    var showErrors by remember { mutableStateOf(false) }
    val liveList = rememberLazyListState()
    val favList = rememberLazyListState()

    // Heure courante pour les dates relatives, rafraichie toutes les 30 s.
    val now by produceState(KiosqueViewModel.now()) {
        while (true) {
            delay(30_000)
            value = KiosqueViewModel.now()
        }
    }

    BackHandler(enabled = searching) {
        searching = false
        query = ""
    }

    val base = if (tab == Tab.Live) state.feed else state.favorites
    // Nom de source -> categorie (un favori d'une source supprimee n'apparait que dans « Tout »).
    val catOf = remember(state.sources) { state.sources.associate { it.name to it.category } }
    val visible = remember(base, query, source, category, catOf) {
        val q = query.trim()
        base.filter { a ->
            (category == null || catOf[a.source] == category) &&
                (source == null || a.source == source) &&
                (q.isEmpty() || a.title.contains(q, ignoreCase = true) || a.excerpt.contains(q, ignoreCase = true))
        }
    }
    val chips = remember(base, category, catOf) {
        base.asSequence().map { it.source }.filter { category == null || catOf[it] == category }.toSortedSet().toList()
    }

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        if (searching) {
                            SearchField(query, onChange = { query = it })
                        } else {
                            Text("Kiosque", style = MaterialTheme.typography.headlineSmall)
                        }
                    },
                    actions = {
                        if (searching) {
                            IconButton(onClick = { searching = false; query = "" }) { Icon(Icons.Filled.Close, "Fermer la recherche") }
                        } else {
                            IconButton(onClick = { searching = true }) { Icon(Icons.Filled.Search, "Rechercher") }
                        }
                        if (state.refreshing) {
                            Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            }
                        } else {
                            IconButton(onClick = vm::refresh) { Icon(Icons.Filled.Refresh, "Actualiser") }
                        }
                        IconButton(onClick = { showSources = true }) { Icon(Icons.Outlined.Tune, "Sources") }
                    },
                )
                if (state.refreshing && state.total > 0) {
                    LinearProgressIndicator(progress = { state.done.toFloat() / state.total }, modifier = Modifier.fillMaxWidth().height(2.dp))
                } else {
                    Spacer(Modifier.height(2.dp))
                }
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item { FilterChip(selected = category == null, onClick = { category = null }, label = { Text("Tout") }) }
                    items(CATEGORIES, key = { it }) { c ->
                        FilterChip(
                            selected = category == c,
                            onClick = {
                                category = if (category == c) null else c
                                // La source choisie n'appartient peut-etre pas a cette categorie.
                                if (source != null && category != null && catOf[source] != category) source = null
                            },
                            label = { Text(c) },
                        )
                    }
                }
                if (chips.size > 1) {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        item { FilterChip(selected = source == null, onClick = { source = null }, label = { Text("Toutes") }) }
                        items(chips, key = { it }) { name ->
                            FilterChip(
                                selected = source == name,
                                onClick = { source = if (source == name) null else name },
                                label = { Text(name) },
                            )
                        }
                    }
                }
            }
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == Tab.Live,
                    onClick = {
                        if (tab == Tab.Live) scope.launch { liveList.animateScrollToItem(0) }
                        tab = Tab.Live
                    },
                    icon = { Icon(Icons.Outlined.Newspaper, null) },
                    label = { Text("Direct") },
                )
                NavigationBarItem(
                    selected = tab == Tab.Favorites,
                    onClick = { tab = Tab.Favorites },
                    icon = {
                        BadgedBox(badge = { if (state.favorites.isNotEmpty()) Badge { Text("${state.favorites.size}") } }) {
                            Icon(Icons.Filled.Star, null)
                        }
                    },
                    label = { Text("Favoris") },
                )
            }
        },
    ) { padding ->
        val list = if (tab == Tab.Live) liveList else favList
        PullToRefreshBox(
            isRefreshing = tab == Tab.Live && state.refreshing,
            onRefresh = vm::refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Feed(
                items = visible,
                state = state,
                now = now,
                listState = list,
                header = if (tab == Tab.Live) statusLine(state, now) else null,
                onErrors = { showErrors = true },
                empty = when {
                    !state.loaded -> ""
                    tab == Tab.Favorites && query.isBlank() && source == null && category == null -> "Aucun favori.\nTouche l'étoile d'un article pour le garder ici."
                    tab == Tab.Live && state.refreshing && state.feed.isEmpty() -> "Chargement…"
                    else -> "Rien à afficher."
                },
                onOpen = { a ->
                    vm.open(a)
                    openUrl(ctx, a.link)
                },
                onStar = vm::toggleFavorite,
                onShare = { a -> share(ctx, a) },
            )
            if (tab == Tab.Live && state.fresh.isNotEmpty() && list.firstVisibleItemIndex > 0) {
                FilledTonalButton(
                    onClick = {
                        scope.launch { list.animateScrollToItem(0) }
                        vm.clearFresh()
                    },
                    modifier = Modifier.align(Alignment.TopCenter).padding(top = 8.dp),
                ) { Text("↑ ${state.fresh.size} nouveaux") }
            }
        }
    }

    if (showSources) {
        SourcesSheet(
            sources = state.sources,
            errors = state.errors,
            onDismiss = { showSources = false },
            onToggle = vm::setEnabled,
            onCategory = vm::setCategory,
            onRemove = { s ->
                if (source == s.name) source = null
                vm.remove(s)
            },
            onAdd = vm::add,
        )
    }

    if (showErrors) {
        AlertDialog(
            onDismissRequest = { showErrors = false },
            confirmButton = { TextButton(onClick = { showErrors = false }) { Text("OK") } },
            title = { Text("Sources hors service") },
            text = { Text(state.errors.entries.joinToString("\n") { "${it.key} : ${it.value}" }) },
        )
    }
}

private class StatusLine(val text: String, val errors: Int)

private fun statusLine(s: UiState, now: Long): StatusLine? = when {
    s.refreshing -> StatusLine("Mise à jour… ${s.done}/${s.total}", s.errors.size)
    s.lastRefresh > 0 -> StatusLine("À jour · ${ago(s.lastRefresh, now)}", s.errors.size)
    else -> null
}

@Composable
private fun SearchField(query: String, onChange: (String) -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    TextField(
        value = query,
        onValueChange = onChange,
        placeholder = { Text("Rechercher") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Color.Transparent,
            unfocusedContainerColor = Color.Transparent,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
        ),
        modifier = Modifier.fillMaxWidth().focusRequester(focus),
    )
}

@Composable
private fun Feed(
    items: List<Article>,
    state: UiState,
    now: Long,
    listState: LazyListState,
    header: StatusLine?,
    onErrors: () -> Unit,
    empty: String,
    onOpen: (Article) -> Unit,
    onStar: (Article) -> Unit,
    onShare: (Article) -> Unit,
) {
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (header != null) {
            item(key = "status", contentType = "status") {
                Row(Modifier.padding(horizontal = 6.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(header.text, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (header.errors > 0) {
                        Text(
                            "  ·  ${header.errors} hors service",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.clickable(onClick = onErrors),
                        )
                    }
                }
            }
        }
        if (items.isEmpty() && empty.isNotEmpty()) {
            item(key = "empty", contentType = "empty") {
                Text(
                    empty,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 64.dp, horizontal = 24.dp),
                )
            }
        }
        items(items, key = { it.link }, contentType = { "article" }) { a ->
            ArticleCard(
                a = a,
                fav = a.link in state.favLinks,
                read = a.link in state.read,
                fresh = a.link in state.fresh,
                now = now,
                onOpen = { onOpen(a) },
                onStar = { onStar(a) },
                onShare = { onShare(a) },
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ArticleCard(
    a: Article,
    fav: Boolean,
    read: Boolean,
    fresh: Boolean,
    now: Long,
    onOpen: () -> Unit,
    onStar: () -> Unit,
    onShare: () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    val muted = cs.onSurfaceVariant
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(cs.surfaceContainerLowest)
            .border(1.dp, if (fresh) cs.primary.copy(alpha = 0.55f) else cs.outlineVariant, shape)
            .combinedClickable(onClick = onOpen, onLongClick = onShare, onLongClickLabel = "Partager")
            .padding(start = 16.dp, end = 4.dp, top = 14.dp, bottom = 14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(color = sourceColor(a.source), fontWeight = FontWeight.SemiBold)) { append(a.source) }
                    withStyle(SpanStyle(color = muted)) { append("  ·  ${ago(a.published, now)}") }
                    if (fresh) withStyle(SpanStyle(color = cs.primary, fontWeight = FontWeight.Bold, fontSize = 12.sp)) { append("   NOUVEAU") }
                },
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                a.title,
                style = MaterialTheme.typography.titleMedium,
                color = if (read) muted else cs.onSurface,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            if (a.excerpt.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(a.excerpt, style = MaterialTheme.typography.bodyMedium, color = muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        IconButton(onClick = onStar, modifier = Modifier.padding(top = 0.dp)) {
            Icon(
                if (fav) Icons.Filled.Star else Icons.Outlined.StarBorder,
                contentDescription = if (fav) "Retirer des favoris" else "Ajouter aux favoris",
                tint = if (fav) cs.primary else muted,
                modifier = Modifier.size(26.dp),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SourcesSheet(
    sources: List<Source>,
    errors: Map<String, String>,
    onDismiss: () -> Unit,
    onToggle: (Source, Boolean) -> Unit,
    onRemove: (Source) -> Unit,
    onCategory: (Source, String) -> Unit,
    onAdd: (String, String, String) -> Boolean,
) {
    var name by remember { mutableStateOf("") }
    var newCategory by remember { mutableStateOf(CATEGORIES[0]) }
    var url by remember { mutableStateOf("") }
    var invalid by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Text("Sources", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp))
        LazyColumn(Modifier.weight(1f, fill = false)) {
            for (cat in CATEGORIES) {
                item(key = "cat:$cat", contentType = "header") {
                    Text(
                        cat,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 20.dp, top = 12.dp, bottom = 2.dp),
                    )
                }
                items(sources.filter { it.category == cat }, key = { it.url }) { s ->
                    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        var menu by remember { mutableStateOf(false) }
                        Column(Modifier.weight(1f)) {
                            Text(s.name, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            errors[s.name]?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
                        }
                        Box {
                            TextButton(onClick = { menu = true }) { Text(s.category, style = MaterialTheme.typography.labelMedium) }
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                CATEGORIES.forEach { c ->
                                    DropdownMenuItem(text = { Text(c) }, onClick = {
                                        menu = false
                                        if (c != s.category) onCategory(s, c)
                                    })
                                }
                            }
                        }
                        Switch(checked = s.enabled, onCheckedChange = { onToggle(s, it) })
                        IconButton(onClick = { onRemove(s) }) { Icon(Icons.Filled.Delete, "Supprimer ${s.name}", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }
        }
        Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(name, { name = it }, label = { Text("Nom (facultatif)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                url,
                { url = it; invalid = false },
                label = { Text("Adresse du flux (https://…)") },
                singleLine = true,
                isError = invalid,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
            )
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(CATEGORIES, key = { it }) { c ->
                    FilterChip(selected = newCategory == c, onClick = { newCategory = c }, label = { Text(c) })
                }
            }
            Button(
                onClick = {
                    if (onAdd(name, url, newCategory)) {
                        name = ""
                        url = ""
                    } else {
                        invalid = true
                    }
                },
                enabled = url.isNotBlank(),
                modifier = Modifier.align(Alignment.End),
            ) { Text("Ajouter") }
            Spacer(Modifier.height(8.dp))
        }
    }
}

private val DAY_MONTH = DateTimeFormatter.ofPattern("dd/MM")

/** « à l'instant », « 5 min », « 3 h », « hier », « 12/11 ». */
fun ago(ts: Long, now: Long): String {
    val d = (now - ts).coerceAtLeast(0)
    return when {
        d < 60 -> "à l'instant"
        d < 3600 -> "${d / 60} min"
        d < 86_400 -> "${d / 3600} h"
        d < 172_800 -> "hier"
        else -> DAY_MONTH.format(Instant.ofEpochSecond(ts).atZone(ZoneId.systemDefault()))
    }
}

private fun openUrl(ctx: Context, url: String) {
    try {
        CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(ctx, url.toUri())
    } catch (e: ActivityNotFoundException) {
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, url.toUri())) }
    }
}

private fun share(ctx: Context, a: Article) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${a.title}\n${a.link}")
    ctx.startActivity(Intent.createChooser(send, null))
}
