// Genere Kiosque.ico (16 a 256 px) et l'integre a l'executable Windows.

#[allow(dead_code)]
mod icon_art {
    include!("src/icon_art.rs");
}

fn ico(sizes: &[u32]) -> Vec<u8> {
    let images: Vec<Vec<u8>> = sizes
        .iter()
        .map(|&n| {
            let rgba = icon_art::icon_rgba(n);
            let mask_row = n.div_ceil(32) * 4;
            let mut bmp = Vec::new();
            for v in [40u32, n, n * 2] {
                bmp.extend_from_slice(&v.to_le_bytes());
            }
            bmp.extend_from_slice(&1u16.to_le_bytes()); // plans
            bmp.extend_from_slice(&32u16.to_le_bytes()); // bits par pixel
            for _ in 0..6 {
                bmp.extend_from_slice(&0u32.to_le_bytes());
            }
            // Pixels BGRA, de bas en haut.
            for y in (0..n).rev() {
                for x in 0..n {
                    let i = ((y * n + x) * 4) as usize;
                    bmp.extend_from_slice(&[rgba[i + 2], rgba[i + 1], rgba[i], rgba[i + 3]]);
                }
            }
            bmp.resize(bmp.len() + (mask_row * n) as usize, 0); // masque AND (transparence via alpha)
            bmp
        })
        .collect();

    let mut out = Vec::new();
    out.extend_from_slice(&[0, 0, 1, 0]);
    out.extend_from_slice(&(sizes.len() as u16).to_le_bytes());
    let mut offset = 6 + 16 * sizes.len() as u32;
    for (&n, img) in sizes.iter().zip(&images) {
        let b = if n >= 256 { 0 } else { n as u8 };
        out.extend_from_slice(&[b, b, 0, 0]);
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&32u16.to_le_bytes());
        out.extend_from_slice(&(img.len() as u32).to_le_bytes());
        out.extend_from_slice(&offset.to_le_bytes());
        offset += img.len() as u32;
    }
    for img in images {
        out.extend_from_slice(&img);
    }
    out
}

fn main() {
    println!("cargo:rerun-if-changed=src/icon_art.rs");
    println!("cargo:rerun-if-changed=build.rs");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let path = std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("Kiosque.ico");
    std::fs::write(&path, ico(&[16, 20, 24, 32, 40, 48, 64, 128, 256]))
        .expect("ecriture de l'icone");
    // Copie consultable a cote du projet.
    let _ = std::fs::copy(&path, "Kiosque.ico");

    #[cfg(windows)]
    {
        let mut res = winresource::WindowsResource::new();
        res.set_icon(path.to_str().unwrap());
        res.set("ProductName", "Kiosque");
        res.set("FileDescription", "Kiosque");
        if let Err(e) = res.compile() {
            println!("cargo:warning=icone non integree : {e}");
        }
    }
}
