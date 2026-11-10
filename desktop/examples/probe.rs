//! Verifie des sources avec le vrai code de recuperation.
//! `cargo run --release --example probe` : toutes les sources par defaut.
//! `cargo run --release --example probe -- fichier.txt` : lignes `Nom|https://...` (candidats).
use kiosque::fetch::{Job, Outcome, Validators, agent, fetch_one};
use kiosque::model::{Source, default_sources};

fn main() {
    let sources: Vec<Source> = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(path)
            .expect("lecture du fichier")
            .lines()
            .filter_map(|l| l.split_once('|'))
            .map(|(n, u)| Source::new(n.trim(), u.trim(), ""))
            .collect(),
        None => default_sources(),
    };
    let agent = agent();
    let now = chrono::Utc::now().timestamp();
    for source in sources {
        let t = std::time::Instant::now();
        let job = Job {
            source: source.clone(),
            validators: Validators::default(),
        };
        match fetch_one(&agent, &job) {
            Outcome::Fresh { articles, .. } => {
                let dated = articles.iter().filter(|a| a.published > 0).count();
                let newest = articles.iter().map(|a| a.published).max().unwrap_or(0);
                let age_h = if newest > 0 {
                    (now - newest) / 3600
                } else {
                    -1
                };
                println!(
                    "OK  {:<24} {:>3} art  {:>3} dates  dernier il y a {:>4} h  {:>5} ms | {}",
                    source.name,
                    articles.len(),
                    dated,
                    age_h,
                    t.elapsed().as_millis(),
                    articles.first().map(|a| a.title.as_str()).unwrap_or("")
                )
            }
            Outcome::NotModified => println!("304 {}", source.name),
            Outcome::Failed(e) => println!("ERR {:<24} {e}", source.name),
        }
    }
}
