//! Palette, polices et style. Couleurs de texte choisies pour un contraste >= 4.5:1 (WCAG AA).

use std::sync::Arc;

use eframe::egui::{
    self, Color32, CornerRadius, FontData, FontDefinitions, FontFamily, FontId, Stroke, TextStyle,
    Theme, Vec2,
};

#[derive(Clone, Copy)]
pub struct Palette {
    pub bg: Color32,
    pub card: Color32,
    pub card_hover: Color32,
    pub border: Color32,
    pub text: Color32,
    pub muted: Color32,
    pub read: Color32,
    pub accent: Color32,
    pub on_accent: Color32,
    pub chip: Color32,
    sources: [Color32; 8],
}

pub const LIGHT: Palette = Palette {
    bg: Color32::from_rgb(0xF3, 0xF1, 0xEC),
    card: Color32::WHITE,
    card_hover: Color32::from_rgb(0xFC, 0xFB, 0xF8),
    border: Color32::from_rgb(0xE2, 0xDE, 0xD5),
    text: Color32::from_rgb(0x16, 0x18, 0x1D),
    muted: Color32::from_rgb(0x55, 0x5A, 0x64),
    read: Color32::from_rgb(0x6B, 0x70, 0x79),
    accent: Color32::from_rgb(0xC2, 0x3A, 0x1E),
    on_accent: Color32::WHITE,
    chip: Color32::from_rgb(0xE8, 0xE5, 0xDE),
    sources: [
        Color32::from_rgb(0x1F, 0x5F, 0xBF),
        Color32::from_rgb(0x1E, 0x7A, 0x46),
        Color32::from_rgb(0x6B, 0x3F, 0xB5),
        Color32::from_rgb(0x0F, 0x6E, 0x78),
        Color32::from_rgb(0xA0, 0x4A, 0x1C),
        Color32::from_rgb(0xA8, 0x32, 0x6E),
        Color32::from_rgb(0x55, 0x60, 0x10),
        Color32::from_rgb(0x3D, 0x4F, 0xA0),
    ],
};

pub const DARK: Palette = Palette {
    bg: Color32::from_rgb(0x11, 0x12, 0x14),
    card: Color32::from_rgb(0x1C, 0x1E, 0x22),
    card_hover: Color32::from_rgb(0x23, 0x26, 0x2B),
    border: Color32::from_rgb(0x2E, 0x31, 0x37),
    text: Color32::from_rgb(0xEE, 0xEF, 0xF1),
    muted: Color32::from_rgb(0xA6, 0xAB, 0xB4),
    read: Color32::from_rgb(0x90, 0x95, 0x9E),
    accent: Color32::from_rgb(0xFF, 0x7A, 0x59),
    on_accent: Color32::from_rgb(0x1A, 0x0A, 0x05),
    chip: Color32::from_rgb(0x2A, 0x2D, 0x33),
    sources: [
        Color32::from_rgb(0x82, 0xB4, 0xFF),
        Color32::from_rgb(0x72, 0xD6, 0x9E),
        Color32::from_rgb(0xB9, 0xA0, 0xFF),
        Color32::from_rgb(0x62, 0xD2, 0xDD),
        Color32::from_rgb(0xF2, 0xA4, 0x72),
        Color32::from_rgb(0xF4, 0x90, 0xC4),
        Color32::from_rgb(0xC8, 0xD8, 0x5E),
        Color32::from_rgb(0x9F, 0xAE, 0xF4),
    ],
};

impl Palette {
    pub fn of(ui: &egui::Ui) -> Self {
        if ui.visuals().dark_mode { DARK } else { LIGHT }
    }

    /// Couleur stable par source, pour reperer d'un coup d'oeil.
    pub fn source(&self, name: &str) -> Color32 {
        let h = name.bytes().fold(0x811C_9DC5u32, |h, b| {
            (h ^ b as u32).wrapping_mul(0x0100_0193)
        });
        self.sources[(h % 8) as usize]
    }
}

pub const BOLD: &str = "bold";

pub fn bold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name(BOLD.into()))
}

/// Segoe UI (Windows) si disponible : bien plus lisible que la police fine par defaut.
fn fonts() -> FontDefinitions {
    let mut defs = FontDefinitions::default();
    let dir = std::env::var("WINDIR")
        .map(|w| std::path::PathBuf::from(w).join("Fonts"))
        .unwrap_or_default();
    let fallback = defs
        .families
        .get(&FontFamily::Proportional)
        .cloned()
        .unwrap_or_default();
    let mut bold_chain = fallback.clone();
    if let Ok(bytes) = std::fs::read(dir.join("segoeui.ttf")) {
        defs.font_data
            .insert("ui".into(), Arc::new(FontData::from_owned(bytes)));
        defs.families
            .entry(FontFamily::Proportional)
            .or_default()
            .insert(0, "ui".into());
        bold_chain.insert(0, "ui".into());
    }
    if let Ok(bytes) = std::fs::read(dir.join("seguisb.ttf")) {
        defs.font_data
            .insert("ui_bold".into(), Arc::new(FontData::from_owned(bytes)));
        bold_chain.insert(0, "ui_bold".into());
    }
    defs.families
        .insert(FontFamily::Name(BOLD.into()), bold_chain);
    defs
}

pub fn apply(ctx: &egui::Context) {
    ctx.set_fonts(fonts());
    for (theme, p) in [(Theme::Light, LIGHT), (Theme::Dark, DARK)] {
        ctx.style_mut_of(theme, |s| {
            s.text_styles
                .insert(TextStyle::Small, FontId::proportional(13.0));
            s.text_styles
                .insert(TextStyle::Body, FontId::proportional(16.0));
            s.text_styles
                .insert(TextStyle::Button, FontId::proportional(15.0));
            s.text_styles.insert(TextStyle::Heading, bold(24.0));
            s.spacing.item_spacing = Vec2::new(10.0, 8.0);
            s.spacing.button_padding = Vec2::new(14.0, 8.0);
            s.spacing.interact_size.y = 36.0;

            let v = &mut s.visuals;
            let r = CornerRadius::same(10);
            v.panel_fill = p.bg;
            v.window_fill = p.card;
            v.window_stroke = Stroke::new(1.0, p.border);
            v.window_corner_radius = CornerRadius::same(14);
            v.extreme_bg_color = p.card;
            v.faint_bg_color = p.card_hover;
            v.hyperlink_color = p.accent;
            v.selection.bg_fill = p.accent.gamma_multiply(0.35);
            v.selection.stroke = Stroke::new(1.0, p.text);
            v.text_cursor.stroke = Stroke::new(2.0, p.accent);
            v.widgets.noninteractive.fg_stroke = Stroke::new(1.0, p.text);
            v.widgets.noninteractive.bg_stroke = Stroke::new(1.0, p.border);
            v.widgets.noninteractive.corner_radius = r;
            for w in [
                &mut v.widgets.inactive,
                &mut v.widgets.hovered,
                &mut v.widgets.active,
                &mut v.widgets.open,
            ] {
                w.bg_fill = p.chip;
                w.weak_bg_fill = p.chip;
                w.fg_stroke = Stroke::new(1.5, p.text);
                w.bg_stroke = Stroke::new(1.0, p.border);
                w.corner_radius = r;
                w.expansion = 0.0;
            }
            v.widgets.hovered.bg_stroke = Stroke::new(1.0, p.accent);
            v.widgets.active.bg_stroke = Stroke::new(1.5, p.accent);
        });
    }
}
