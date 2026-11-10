//! Nettoyage de texte : balises HTML retirees, entites decodees, espaces compactes.

pub const EXCERPT_MAX: usize = 240;

/// Convertit un fragment HTML en texte brut sur une ligne.
pub fn html_to_text(input: &str) -> String {
    let stripped = strip_tags(input);
    collapse_ws(&decode_entities(&stripped))
}

/// Coupe proprement a `max` caracteres, avec points de suspension.
pub fn clip(s: &str, max: usize) -> String {
    match s.char_indices().nth(max) {
        None => s.to_string(),
        Some((i, _)) => {
            let cut = &s[..i];
            let cut = cut
                .rfind(' ')
                .filter(|&p| p > i / 2)
                .map_or(cut, |p| &cut[..p]);
            format!("{}…", cut.trim_end())
        }
    }
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < s.len() {
        let c = bytes[i];
        if c == b'<' {
            let next = bytes.get(i + 1).copied().unwrap_or(0);
            if next.is_ascii_alphabetic() || next == b'/' || next == b'!' || next == b'?' {
                let rest = &s[i..];
                let lower: String = rest
                    .chars()
                    .take(8)
                    .collect::<String>()
                    .to_ascii_lowercase();
                let skip_block = ["<script", "<style"]
                    .iter()
                    .find(|t| lower.starts_with(**t));
                if let Some(tag) = skip_block {
                    let close = format!("</{}", &tag[1..]);
                    let pos = rest.to_ascii_lowercase().find(&close);
                    i += pos.map_or(rest.len(), |p| p + close.len());
                    i += s[i..].find('>').map_or(s.len() - i, |p| p + 1);
                } else {
                    i += rest.find('>').map_or(rest.len(), |p| p + 1);
                }
                out.push(' ');
                continue;
            }
        }
        let ch = s[i..].chars().next().unwrap_or(' ');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

fn decode_entities(s: &str) -> String {
    if !s.contains('&') {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let tail = &rest[amp..];
        // Recherche en octets : couper `tail` a 12 octets peut tomber au milieu d'un caractere.
        let semi = tail.bytes().take(12).position(|b| b == b';');
        let decoded = semi.and_then(|p| entity(&tail[1..p]).map(|c| (c, p)));
        match decoded {
            Some((c, p)) => {
                out.push(c);
                rest = &tail[p + 1..];
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn entity(name: &str) -> Option<char> {
    if let Some(num) = name.strip_prefix('#') {
        let code = match num.strip_prefix(['x', 'X']) {
            Some(hex) => u32::from_str_radix(hex, 16).ok()?,
            None => num.parse().ok()?,
        };
        return char::from_u32(code);
    }
    Some(match name {
        "amp" => '&',
        "lt" => '<',
        "gt" => '>',
        "quot" => '"',
        "apos" => '\'',
        "nbsp" => ' ',
        "rsquo" | "lsquo" => '\'',
        "ldquo" | "rdquo" | "bdquo" => '"',
        "laquo" => '«',
        "raquo" => '»',
        "hellip" => '…',
        "mdash" => '—',
        "ndash" => '–',
        "euro" => '€',
        "eacute" => 'é',
        "egrave" => 'è',
        "ecirc" => 'ê',
        "euml" => 'ë',
        "agrave" => 'à',
        "acirc" => 'â',
        "ccedil" => 'ç',
        "icirc" => 'î',
        "iuml" => 'ï',
        "ocirc" => 'ô',
        "ugrave" => 'ù',
        "ucirc" => 'û',
        "Eacute" => 'É',
        "Agrave" => 'À',
        "Ccedil" => 'Ç',
        "deg" => '°',
        "copy" => '©',
        _ => return None,
    })
}

fn collapse_ws(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for word in s.split_whitespace() {
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(word);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_and_decodes() {
        assert_eq!(
            html_to_text("<p>Bonjour&nbsp;<b>le</b> monde &amp; co</p>"),
            "Bonjour le monde & co"
        );
        assert_eq!(html_to_text("a<script>x()</script>b"), "a b");
        assert_eq!(html_to_text("l&#8217;&eacute;t&#xE9;"), "l\u{2019}été");
        assert_eq!(html_to_text("1 < 2 & 3"), "1 < 2 & 3");
        // « & » suivi de caracteres multi-octets : ne doit pas planter (flux Le Temps).
        assert_eq!(html_to_text("A & l’été’’’"), "A & l’été’’’");
    }

    #[test]
    fn clips_on_word() {
        assert_eq!(clip("un deux trois", 9), "un deux…");
        assert_eq!(clip("court", 10), "court");
    }
}
