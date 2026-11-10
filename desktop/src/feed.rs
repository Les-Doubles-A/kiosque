//! Analyse en flux (streaming) de RSS 2.0, RSS 1.0 (RDF) et Atom 1.0.

use chrono::{DateTime, Local, NaiveDateTime};
use quick_xml::events::{BytesStart, Event};
use quick_xml::{Reader, XmlVersion};

use crate::model::Article;
use crate::text::{EXCERPT_MAX, clip, html_to_text};

pub const MAX_PER_FEED: usize = 60;

#[derive(Clone, Copy, PartialEq)]
enum Field {
    Title,
    Link,
    Guid,
    Date,
    Summary,
}

#[derive(Default)]
struct Raw {
    title: String,
    link: String,
    guid: String,
    date: String,
    summary: String,
}

/// Extrait les articles d'un flux. `now` sert de date pour les articles non dates.
pub fn parse(xml: &str, source: &str, now: i64) -> Result<Vec<Article>, String> {
    let mut reader = Reader::from_str(xml);
    let cfg = reader.config_mut();
    cfg.check_end_names = false;
    cfg.allow_dangling_amp = true;

    let mut out = Vec::new();
    let mut is_feed = false;
    let mut depth = 0usize;
    let mut item_depth: Option<usize> = None;
    let mut field: Option<(Field, usize)> = None;
    let mut raw = Raw::default();
    let mut buf = String::new();

    loop {
        let ev = match reader.read_event() {
            Ok(ev) => ev,
            // Flux tronque ou mal forme : on garde ce qui a deja ete lu.
            Err(_) if !out.is_empty() => break,
            Err(e) => return Err(format!("XML invalide : {e}")),
        };
        match ev {
            Event::Start(e) => {
                let name = local(&e);
                if depth == 0 {
                    is_feed = matches!(name.as_str(), "rss" | "feed" | "RDF");
                }
                match item_depth {
                    None if name == "item" || name == "entry" => {
                        item_depth = Some(depth);
                        raw = Raw::default();
                    }
                    Some(d) if field.is_none() && depth == d + 1 => {
                        if let Some(f) = field_of(&name) {
                            if f == Field::Link && take_href(&e, &mut raw.link) {
                                // lien Atom avec contenu : rien a capturer
                            } else {
                                field = Some((f, depth));
                                buf.clear();
                            }
                        }
                    }
                    _ => {}
                }
                depth += 1;
            }
            Event::Empty(e) => {
                if let Some(d) = item_depth
                    && depth == d + 1
                    && local(&e) == "link"
                {
                    take_href(&e, &mut raw.link);
                }
            }
            Event::Text(t) if field.is_some() => buf.push_str(&t.xml10_content()),
            Event::CData(c) if field.is_some() => buf.push_str(&c.into_inner()),
            Event::GeneralRef(r) if field.is_some() => {
                if let Ok(Some(ch)) = r.resolve_char_ref() {
                    buf.push(ch);
                } else {
                    match &*r {
                        "amp" => buf.push('&'),
                        "lt" => buf.push('<'),
                        "gt" => buf.push('>'),
                        "quot" => buf.push('"'),
                        "apos" => buf.push('\''),
                        other => {
                            buf.push('&');
                            buf.push_str(other);
                            buf.push(';');
                        }
                    }
                }
            }
            Event::End(_) => {
                depth = depth.saturating_sub(1);
                if let Some((f, d)) = field
                    && depth == d
                {
                    let slot = match f {
                        Field::Title => &mut raw.title,
                        Field::Link => &mut raw.link,
                        Field::Guid => &mut raw.guid,
                        Field::Date => &mut raw.date,
                        Field::Summary => &mut raw.summary,
                    };
                    if slot.is_empty() {
                        *slot = buf.trim().to_string();
                    }
                    field = None;
                } else if item_depth == Some(depth) {
                    item_depth = None;
                    if let Some(a) = finish(std::mem::take(&mut raw), source, now) {
                        out.push(a);
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }

    if !is_feed && out.is_empty() {
        return Err("Pas un flux RSS/Atom".into());
    }
    out.sort_by(|a, b| b.published.cmp(&a.published));
    out.truncate(MAX_PER_FEED);
    Ok(out)
}

fn local(e: &BytesStart) -> String {
    e.local_name().as_ref().to_string()
}

fn field_of(name: &str) -> Option<Field> {
    Some(match name {
        "title" => Field::Title,
        "link" => Field::Link,
        "guid" | "id" => Field::Guid,
        "pubDate" | "published" | "updated" | "date" => Field::Date,
        "description" | "summary" | "content" | "encoded" => Field::Summary,
        _ => return None,
    })
}

/// Lien Atom `<link rel="alternate" href="..."/>`. Vrai si l'element portait un href.
fn take_href(e: &BytesStart, link: &mut String) -> bool {
    let Ok(Some(href)) = e.try_get_attribute("href") else {
        return false;
    };
    let rel = e.try_get_attribute("rel").ok().flatten().and_then(|r| {
        r.normalized_value(XmlVersion::Implicit1_0)
            .ok()
            .map(|v| v.into_owned())
    });
    if link.is_empty() && rel.as_deref().is_none_or(|r| r == "alternate") {
        if let Ok(v) = href.normalized_value(XmlVersion::Implicit1_0) {
            *link = v.trim().to_string();
        }
    }
    true
}

fn finish(r: Raw, source: &str, now: i64) -> Option<Article> {
    let title = clip(&html_to_text(&r.title), 300);
    let link = if r.link.starts_with("http") {
        r.link
    } else if r.guid.starts_with("http") {
        r.guid
    } else {
        return None;
    };
    if title.is_empty() {
        return None;
    }
    let excerpt = excerpt_for(&title, &r.summary);
    Some(Article {
        link,
        title,
        source: source.to_string(),
        excerpt,
        // 0 = non date : le stockage garde alors la date de premiere apparition.
        published: parse_date(&r.date).map_or(0, |t| t.min(now)),
    })
}

/// Extrait nettoye ; vide s'il ne fait que repeter le titre (cas des flux Google News).
fn excerpt_for(title: &str, summary: &str) -> String {
    let ex = html_to_text(summary);
    let head: String = title.chars().take(40).collect();
    if ex.starts_with(&head) {
        String::new()
    } else {
        clip(&ex, EXCERPT_MAX)
    }
}

/// RFC 2822 (RSS), RFC 3339 (Atom), ou ISO sans fuseau (heure locale).
pub fn parse_date(s: &str) -> Option<i64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Ok(d) = DateTime::parse_from_rfc2822(s).or_else(|_| DateTime::parse_from_rfc3339(s)) {
        return Some(d.timestamp());
    }
    let naive = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
        .ok()?;
    naive
        .and_local_timezone(Local)
        .earliest()
        .map(|d| d.timestamp())
}

#[cfg(test)]
mod tests {
    use super::*;

    const RSS: &str = r#"<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Test</title><atom:link href="https://x.test/feed" rel="self"/>
<item><title>Premier &amp; seul</title><link>https://x.test/1</link>
<description><![CDATA[<p>Texte <b>gras</b></p>]]></description>
<pubDate>Sat, 07 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Deuxieme</title><link>https://x.test/2</link>
<description>&lt;p&gt;Echappe&lt;/p&gt;</description>
<pubDate>Sat, 07 Nov 2026 12:00:00 +0100</pubDate></item>
<item><title></title><link>https://x.test/vide</link></item>
</channel></rss>"#;

    const ATOM: &str = r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title type="html">Atom</title><link rel="alternate" href="https://a.test/1"/>
<link rel="enclosure" href="https://a.test/img.jpg"/><id>urn:1</id>
<updated>2026-11-07T09:00:00Z</updated><summary>Resume</summary></entry></feed>"#;

    #[test]
    fn rss() {
        let now = 2_000_000_000;
        let a = parse(RSS, "T", now).unwrap();
        assert_eq!(a.len(), 2);
        assert_eq!(a[1].title, "Premier & seul");
        assert_eq!(a[1].excerpt, "Texte gras");
        assert_eq!(a[0].excerpt, "Echappe");
        assert!(a[0].published > a[1].published);
    }

    #[test]
    fn atom() {
        let a = parse(ATOM, "A", 2_000_000_000).unwrap();
        assert_eq!(a.len(), 1);
        assert_eq!(a[0].link, "https://a.test/1");
        assert_eq!(a[0].excerpt, "Resume");
        assert!(parse_date("2026-11-06T16:37:19").is_some());
    }

    #[test]
    fn not_a_feed() {
        assert!(parse("<html><body>x</body></html>", "x", 0).is_err());
        assert_eq!(excerpt_for("Titre long", "Titre long AP News"), "");
    }
}
