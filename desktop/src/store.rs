//! Etat persistant : sources, cache des flux, favoris, articles lus.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::model::{
    Article, CATEGORIES, DEFAULTS, MOVED, Source, V1_DEFAULTS, default_category, default_sources,
};

pub const MAX_FEED: usize = 600;
const MAX_READ: usize = 4000;

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct CachedFeed {
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub articles: Vec<Article>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Default, Serialize, Deserialize)]
pub struct Cache {
    pub feeds: HashMap<String, CachedFeed>,
    pub last_refresh: i64,
}

pub struct Store {
    dir: PathBuf,
    pub sources: Vec<Source>,
    pub cache: Cache,
    /// Favoris, du plus recent ajout au plus ancien. Copie complete : survit au cache.
    pub favorites: Vec<Article>,
    pub read: Vec<String>,
    fav_index: HashSet<String>,
    read_index: HashSet<String>,
}

impl Store {
    pub fn open() -> Self {
        let dir = dirs::data_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("Kiosque");
        Self::open_in(dir)
    }

    pub fn open_in(dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&dir);
        let mut sources: Vec<Source> =
            load(&dir.join("sources.json")).unwrap_or_else(default_sources);
        for s in sources
            .iter_mut()
            .filter(|s| !CATEGORIES.contains(&s.category.as_str()))
        {
            s.category = default_category(&s.url).into();
        }
        for s in sources.iter_mut() {
            if let Some(m) = MOVED.iter().find(|m| m.0 == s.url) {
                s.url = m.1.into();
            }
        }
        // Sources par defaut apparues depuis la derniere ouverture : ajoutees une seule fois,
        // pour qu'une source supprimee par l'utilisateur ne revienne pas.
        let seen_path = dir.join("defaults_seen.json");
        let seen: HashSet<String> = load::<Vec<String>>(&seen_path).map_or_else(
            || {
                DEFAULTS[..V1_DEFAULTS]
                    .iter()
                    .map(|d| d.1.to_string())
                    .collect()
            },
            |v| v.into_iter().collect(),
        );
        let mut added = false;
        for &(n, u, c) in &DEFAULTS {
            if !seen.contains(u) && !sources.iter().any(|s| s.url == u) {
                sources.push(Source::new(n, u, c));
                added = true;
            }
        }
        if added {
            save(&dir.join("sources.json"), &sources);
        }
        if seen.len() != DEFAULTS.len() || DEFAULTS.iter().any(|d| !seen.contains(d.1)) {
            save(
                &seen_path,
                &DEFAULTS.iter().map(|d| d.1).collect::<Vec<_>>(),
            );
        }
        let favorites: Vec<Article> = load(&dir.join("favorites.json")).unwrap_or_default();
        let read: Vec<String> = load(&dir.join("read.json")).unwrap_or_default();
        let cache: Cache = load(&dir.join("cache.json")).unwrap_or_default();
        Self {
            fav_index: favorites.iter().map(|a| a.link.clone()).collect(),
            read_index: read.iter().cloned().collect(),
            dir,
            sources,
            cache,
            favorites,
            read,
        }
    }

    pub fn is_favorite(&self, link: &str) -> bool {
        self.fav_index.contains(link)
    }

    pub fn is_read(&self, link: &str) -> bool {
        self.read_index.contains(link)
    }

    pub fn toggle_favorite(&mut self, a: &Article) -> bool {
        let now_fav = if self.fav_index.remove(&a.link) {
            self.favorites.retain(|f| f.link != a.link);
            false
        } else {
            self.fav_index.insert(a.link.clone());
            self.favorites.insert(0, a.clone());
            true
        };
        save(&self.dir.join("favorites.json"), &self.favorites);
        now_fav
    }

    pub fn mark_read(&mut self, link: &str) {
        if self.read_index.insert(link.to_string()) {
            self.read.push(link.to_string());
            if self.read.len() > MAX_READ {
                let drop = self.read.len() - MAX_READ;
                for old in self.read.drain(..drop) {
                    self.read_index.remove(&old);
                }
            }
            save(&self.dir.join("read.json"), &self.read);
        }
    }

    /// Remplace les articles d'un flux. Un article non date (published == 0) garde
    /// sa date de premiere apparition, sinon recoit `now`.
    pub fn absorb(
        &mut self,
        url: &str,
        mut articles: Vec<Article>,
        etag: Option<String>,
        last_modified: Option<String>,
        now: i64,
    ) {
        let entry = self.cache.feeds.entry(url.to_string()).or_default();
        if articles.iter().any(|a| a.published == 0) {
            let old: HashMap<&str, i64> = entry
                .articles
                .iter()
                .map(|a| (a.link.as_str(), a.published))
                .collect();
            for a in articles.iter_mut().filter(|a| a.published == 0) {
                a.published = old.get(a.link.as_str()).copied().unwrap_or(now);
            }
            articles.sort_by(|a, b| b.published.cmp(&a.published));
        }
        *entry = CachedFeed {
            etag,
            last_modified,
            articles,
            error: None,
        };
    }

    /// Categorie d'une source d'apres son nom (None si la source a ete supprimee).
    pub fn category_of(&self, source: &str) -> Option<&str> {
        self.sources
            .iter()
            .find(|s| s.name == source)
            .map(|s| s.category.as_str())
    }

    pub fn save_sources(&self) {
        save(&self.dir.join("sources.json"), &self.sources);
    }

    pub fn save_cache(&self) {
        save(&self.dir.join("cache.json"), &self.cache);
    }

    /// Fil fusionne des sources actives, sans doublon, du plus recent au plus ancien.
    pub fn merged_feed(&self) -> Vec<Article> {
        let mut seen = HashSet::new();
        let mut all: Vec<Article> = self
            .sources
            .iter()
            .filter(|s| s.enabled)
            .filter_map(|s| self.cache.feeds.get(&s.url).map(|f| (s, f)))
            .flat_map(|(s, f)| {
                f.articles.iter().map(move |a| Article {
                    source: s.name.clone(),
                    ..a.clone()
                })
            })
            .collect();
        all.sort_unstable_by(|a, b| b.published.cmp(&a.published));
        all.retain(|a| seen.insert(a.link.clone()));
        all.truncate(MAX_FEED);
        all
    }
}

fn load<T: DeserializeOwned>(path: &Path) -> Option<T> {
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// Ecriture atomique : fichier temporaire puis renommage.
fn save<T: Serialize>(path: &Path, value: &T) {
    let Ok(json) = serde_json::to_vec(value) else {
        return;
    };
    let tmp = path.with_extension("tmp");
    if fs::write(&tmp, json).is_ok() {
        let _ = fs::rename(&tmp, path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn art(link: &str, t: i64) -> Article {
        Article {
            link: link.into(),
            title: link.into(),
            source: "S".into(),
            excerpt: String::new(),
            published: t,
        }
    }

    #[test]
    fn favorites_persist() {
        let dir = std::env::temp_dir().join(format!("kiosque-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let mut s = Store::open_in(dir.clone());
        assert!(s.toggle_favorite(&art("https://a/1", 1)));
        let s2 = Store::open_in(dir.clone());
        assert!(s2.is_favorite("https://a/1"));
        assert!(!s.toggle_favorite(&art("https://a/1", 1)));
        assert!(!Store::open_in(dir.clone()).is_favorite("https://a/1"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn old_sources_get_category() {
        let dir = std::env::temp_dir().join(format!("kiosque-cat-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let old = r#"[{"name":"BBC Tech","url":"https://feeds.bbci.co.uk/news/technology/rss.xml","enabled":true},
                      {"name":"Perso","url":"https://exemple.fr/rss","enabled":false}]"#;
        fs::write(dir.join("sources.json"), old).unwrap();
        let s = Store::open_in(dir.clone());
        assert_eq!(s.sources[0].category, "Tech");
        assert_eq!(s.sources[1].category, "Général");
        assert!(!s.sources[1].enabled);
        assert_eq!(s.category_of("BBC Tech"), Some("Tech"));
        assert_eq!(s.category_of("Inconnue"), None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn new_defaults_added_once() {
        let dir = std::env::temp_dir().join(format!("kiosque-new-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        // Installation v1 dont l'utilisateur a supprime BBC.
        let v1: Vec<Source> = default_sources()[1..V1_DEFAULTS].to_vec();
        fs::write(dir.join("sources.json"), serde_json::to_vec(&v1).unwrap()).unwrap();
        let mut s = Store::open_in(dir.clone());
        assert_eq!(s.sources.len(), DEFAULTS.len() - 1);
        assert!(!s.sources.iter().any(|x| x.name == "BBC"));
        assert!(
            s.sources
                .iter()
                .any(|x| x.name == "Numerama" && x.category == "Tech")
        );
        // Supprimee ensuite : ne revient pas.
        s.sources.retain(|x| x.name != "Numerama");
        s.save_sources();
        let s = Store::open_in(dir.clone());
        assert!(!s.sources.iter().any(|x| x.name == "Numerama"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn merge_dedup_sorted() {
        let dir = std::env::temp_dir().join(format!("kiosque-merge-{}", std::process::id()));
        let mut s = Store::open_in(dir.clone());
        let (u1, u2) = (s.sources[0].url.clone(), s.sources[1].url.clone());
        s.cache.feeds.insert(
            u1,
            CachedFeed {
                articles: vec![art("x", 1), art("y", 3)],
                ..Default::default()
            },
        );
        s.cache.feeds.insert(
            u2,
            CachedFeed {
                articles: vec![art("x", 1), art("z", 2)],
                ..Default::default()
            },
        );
        let f = s.merged_feed();
        assert_eq!(
            f.iter().map(|a| a.link.as_str()).collect::<Vec<_>>(),
            ["y", "z", "x"]
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
