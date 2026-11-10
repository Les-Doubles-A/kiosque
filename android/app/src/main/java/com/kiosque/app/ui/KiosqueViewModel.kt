package com.kiosque.app.ui

import android.app.Application
import androidx.compose.runtime.Immutable
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kiosque.app.data.Article
import com.kiosque.app.data.Net
import com.kiosque.app.data.Outcome
import com.kiosque.app.data.Source
import com.kiosque.app.data.Store
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

@Immutable
data class UiState(
    val loaded: Boolean = false,
    val feed: List<Article> = emptyList(),
    val favorites: List<Article> = emptyList(),
    val favLinks: Set<String> = emptySet(),
    val read: Set<String> = emptySet(),
    val fresh: Set<String> = emptySet(),
    val sources: List<Source> = emptyList(),
    /** Nom de source -> message d'erreur. */
    val errors: Map<String, String> = emptyMap(),
    val total: Int = 0,
    val done: Int = 0,
    val lastRefresh: Long = 0,
) {
    val refreshing get() = done < total
}

class KiosqueViewModel(app: Application) : AndroidViewModel(app) {
    private val store = Store(app.filesDir)
    private val lock = Mutex()
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()
    private var job: Job? = null
    private val known = HashSet<String>()

    init {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { lock.withLock { store.load() } }
            val feed = withContext(Dispatchers.Default) { lock.withLock { store.merged() } }
            feed.mapTo(known) { it.link }
            _state.value = snapshot(feed, emptySet()).copy(loaded = true)
            refreshIfStale()
        }
    }

    fun refreshIfStale() {
        if (_state.value.loaded && now() - _state.value.lastRefresh >= AUTO_REFRESH_S) refresh()
    }

    fun refresh() {
        if (job?.isActive == true || !_state.value.loaded) return
        job = viewModelScope.launch {
            val active = lock.withLock { store.sources.filter { it.enabled } }
            _state.update { it.copy(total = active.size, done = 0) }
            val sem = Semaphore(PARALLEL)
            coroutineScope {
                for (src in active) launch(Dispatchers.IO) {
                    val cached = lock.withLock { store.cache[src.url] }
                    val outcome = sem.withPermit { Net.fetch(src, cached?.etag, cached?.lastModified, now()) }
                    val feed = lock.withLock {
                        when (outcome) {
                            is Outcome.Fresh -> store.absorb(src.url, outcome, now())
                            is Outcome.NotModified -> store.setError(src.url, null)
                            is Outcome.Failed -> store.setError(src.url, outcome.message)
                        }
                        if (outcome is Outcome.Fresh) store.merged() else null
                    }
                    publish(feed)
                }
            }
            withContext(Dispatchers.IO) {
                lock.withLock {
                    store.lastRefresh = now()
                    store.saveCache()
                }
            }
            _state.value.feed.mapTo(known) { it.link }
            _state.update { it.copy(lastRefresh = store.lastRefresh) }
        }
    }

    /** Publie un resultat des qu'il arrive : l'affichage se remplit en direct. */
    private suspend fun publish(feed: List<Article>?) = lock.withLock {
        _state.update { s ->
            val f = feed ?: s.feed
            val fresh = if (feed == null || known.isEmpty()) s.fresh else s.fresh + feed.asSequence().map { it.link }.filter { it !in known }
            snapshot(f, fresh).copy(loaded = true, total = s.total, done = s.done + 1, lastRefresh = s.lastRefresh)
        }
    }

    private fun snapshot(feed: List<Article>, fresh: Set<String>) = UiState(
        feed = feed,
        favorites = store.favorites,
        favLinks = store.favorites.mapTo(HashSet()) { it.link },
        read = HashSet(store.read),
        fresh = fresh,
        sources = store.sources,
        errors = store.sources.mapNotNull { s -> store.cache[s.url]?.error?.takeIf { s.enabled }?.let { s.name to it } }.toMap(),
        lastRefresh = store.lastRefresh,
    )

    private fun mutate(io: Store.() -> Unit) {
        viewModelScope.launch(Dispatchers.IO) {
            lock.withLock {
                store.io()
                val s = _state.value
                _state.value = snapshot(store.merged(), s.fresh).copy(loaded = true, total = s.total, done = s.done)
            }
        }
    }

    fun toggleFavorite(a: Article) = mutate { toggleFavorite(a) }

    fun open(a: Article) {
        _state.update { it.copy(fresh = it.fresh - a.link) }
        mutate { markRead(a.link) }
    }

    fun clearFresh() = _state.update { it.copy(fresh = emptySet()) }

    fun setEnabled(src: Source, enabled: Boolean) = editSources { map { if (it.url == src.url) it.copy(enabled = enabled) else it } }

    fun remove(src: Source) = editSources {
        store.cache.remove(src.url)
        filter { it.url != src.url }
    }

    /** Ajoute une source ; renvoie false si l'adresse est invalide ou deja presente. */
    fun add(name: String, url: String, category: String): Boolean {
        val u = url.trim()
        if (!u.startsWith("https://") || store.sources.any { it.url == u }) return false
        val n = name.trim().ifEmpty { u.removePrefix("https://").substringBefore('/').removePrefix("www.") }
        editSources { this + Source(n, u, category = category) }
        return true
    }

    fun setCategory(src: Source, category: String) = editSources { map { if (it.url == src.url) it.copy(category = category) else it } }

    private fun editSources(edit: List<Source>.() -> List<Source>) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                lock.withLock {
                    store.sources = store.sources.edit()
                    store.saveSources()
                    val s = _state.value
                    _state.value = snapshot(store.merged(), s.fresh).copy(loaded = true, total = s.total, done = s.done)
                }
            }
            job?.join()
            refresh()
        }
    }

    companion object {
        const val AUTO_REFRESH_S = 5 * 60L
        private const val PARALLEL = 6
        fun now() = System.currentTimeMillis() / 1000
    }
}
