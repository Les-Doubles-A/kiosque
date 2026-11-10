// Dessin de l'icone, partage entre build.rs (fichier .ico de l'exe) et l'app (icone de fenetre).
// Coordonnees normalisees 0..1, lissage par sur-echantillonnage 4x4.

const ICON_BG: [u8; 3] = [0xC2, 0x3A, 0x1E];

fn icon_sample(u: f32, v: f32) -> Option<[u8; 3]> {
    // Carre a coins arrondis.
    let r = 0.22;
    let (cx, cy) = (u.clamp(r, 1.0 - r), v.clamp(r, 1.0 - r));
    if (u - cx).powi(2) + (v - cy).powi(2) > r * r {
        return None;
    }
    let inside = |x0: f32, y0: f32, x1: f32, y1: f32| u >= x0 && u < x1 && v >= y0 && v < y1;
    if !inside(0.19, 0.25, 0.81, 0.75) {
        return Some(ICON_BG);
    }
    let ink = inside(0.25, 0.31, 0.47, 0.48)
        || inside(0.52, 0.31, 0.75, 0.36)
        || inside(0.52, 0.42, 0.75, 0.47)
        || inside(0.25, 0.54, 0.75, 0.59)
        || inside(0.25, 0.64, 0.62, 0.69);
    Some(if ink { ICON_BG } else { [0xFF, 0xFF, 0xFF] })
}

/// Pixels RGBA (ligne par ligne, du haut vers le bas) d'une icone `n` x `n`.
pub fn icon_rgba(n: u32) -> Vec<u8> {
    const S: u32 = 4;
    let mut out = Vec::with_capacity((n * n * 4) as usize);
    for y in 0..n {
        for x in 0..n {
            let (mut acc, mut hits) = ([0u32; 3], 0u32);
            for sy in 0..S {
                for sx in 0..S {
                    let u = (x as f32 + (sx as f32 + 0.5) / S as f32) / n as f32;
                    let v = (y as f32 + (sy as f32 + 0.5) / S as f32) / n as f32;
                    if let Some(c) = icon_sample(u, v) {
                        for i in 0..3 {
                            acc[i] += c[i] as u32;
                        }
                        hits += 1;
                    }
                }
            }
            if hits == 0 {
                out.extend_from_slice(&[0, 0, 0, 0]);
            } else {
                let a = (hits * 255 / (S * S)) as u8;
                out.extend_from_slice(&[
                    (acc[0] / hits) as u8,
                    (acc[1] / hits) as u8,
                    (acc[2] / hits) as u8,
                    a,
                ]);
            }
        }
    }
    out
}
