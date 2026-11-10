//! Recuperation reseau en parallele, avec requetes conditionnelles (ETag / Last-Modified).

use std::io::Read;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::feed;
use crate::model::{Article, Source};

const MAX_BYTES: u64 = 4 * 1024 * 1024;
const WORKERS: usize = 6;

#[derive(Clone, Debug, Default)]
pub struct Validators {
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

pub struct Job {
    pub source: Source,
    pub validators: Validators,
}

pub enum Outcome {
    Fresh {
        articles: Vec<Article>,
        validators: Validators,
    },
    NotModified,
    Failed(String),
}

pub struct Done {
    pub url: String,
    pub outcome: Outcome,
}

pub fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(6))
        .timeout(Duration::from_secs(15))
        .redirects(5)
        .user_agent(concat!("Kiosque/", env!("CARGO_PKG_VERSION")))
        .build()
}

/// Lance la recuperation de toutes les sources. Chaque resultat est envoye des qu'il arrive ;
/// `notify` est appele apres chaque envoi (reveil de l'interface).
pub fn spawn_all(jobs: Vec<Job>, tx: Sender<Done>, notify: impl Fn() + Send + Sync + 'static) {
    let queue = Arc::new(Mutex::new(jobs));
    let notify = Arc::new(notify);
    let agent = agent();
    for _ in 0..WORKERS {
        let (queue, tx, notify, agent) = (queue.clone(), tx.clone(), notify.clone(), agent.clone());
        std::thread::spawn(move || {
            loop {
                let job = queue.lock().ok().and_then(|mut q| q.pop());
                let Some(job) = job else { break };
                let url = job.source.url.clone();
                let outcome = fetch_one(&agent, &job);
                if tx.send(Done { url, outcome }).is_err() {
                    break;
                }
                notify();
            }
        });
    }
}

pub fn fetch_one(agent: &ureq::Agent, job: &Job) -> Outcome {
    let mut req = agent.get(&job.source.url).set(
        "Accept",
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
    );
    if let Some(e) = &job.validators.etag {
        req = req.set("If-None-Match", e);
    }
    if let Some(m) = &job.validators.last_modified {
        req = req.set("If-Modified-Since", m);
    }
    let resp = match req.call() {
        Ok(r) => r,
        Err(ureq::Error::Status(code, _)) => return Outcome::Failed(format!("HTTP {code}")),
        Err(ureq::Error::Transport(t)) => return Outcome::Failed(short_transport(&t)),
    };
    if resp.status() == 304 {
        return Outcome::NotModified;
    }
    let validators = Validators {
        etag: resp.header("ETag").map(str::to_string),
        last_modified: resp.header("Last-Modified").map(str::to_string),
    };
    let mut bytes = Vec::with_capacity(256 * 1024);
    if let Err(e) = resp.into_reader().take(MAX_BYTES).read_to_end(&mut bytes) {
        return Outcome::Failed(format!("Lecture : {e}"));
    }
    let text = decode(bytes);
    let now = chrono::Utc::now().timestamp();
    match feed::parse(&text, &job.source.name, now) {
        Ok(articles) => Outcome::Fresh {
            articles,
            validators,
        },
        Err(e) => Outcome::Failed(e),
    }
}

/// UTF-8 si valide, sinon Windows-1252 (sur-ensemble pratique d'ISO-8859-1).
pub fn decode(bytes: Vec<u8>) -> String {
    match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => e.into_bytes().into_iter().map(cp1252).collect(),
    }
}

fn cp1252(b: u8) -> char {
    const HIGH: [char; 32] = [
        '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8d}', 'Ž',
        '\u{8f}', '\u{90}', '\u{2018}', '\u{2019}', '“', '”', '•', '–', '—', '˜', '™', 'š', '›',
        'œ', '\u{9d}', 'ž', 'Ÿ',
    ];
    match b {
        0x80..=0x9F => HIGH[(b - 0x80) as usize],
        _ => b as char,
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn decodes_latin1() {
        assert_eq!(super::decode(vec![b'L', 0xE9, 0x92]), "Lé\u{2019}");
        assert_eq!(super::decode("déjà".as_bytes().to_vec()), "déjà");
    }
}

fn short_transport(t: &ureq::Transport) -> String {
    match t.kind() {
        ureq::ErrorKind::Dns => "Hors ligne ou DNS".into(),
        ureq::ErrorKind::ConnectionFailed => "Connexion impossible".into(),
        ureq::ErrorKind::Io => "Delai depasse".into(),
        _ => t.to_string().chars().take(80).collect(),
    }
}
