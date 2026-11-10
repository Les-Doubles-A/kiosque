#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod icon_art;
mod theme;

use std::collections::HashSet;
use std::sync::Arc;
use std::sync::mpsc::{Receiver, Sender, channel};
use std::time::{Duration, Instant};

use eframe::egui::{
    self, Align, Align2, Button, Color32, CornerRadius, FontId, Frame, Key, Label, Layout, Margin,
    Panel, Pos2, Rect, RichText, ScrollArea, Sense, Stroke, TextEdit, TextFormat, Ui, UiBuilder,
    Vec2,
    text::{LayoutJob, TextWrapping},
};
use kiosque::fetch::{self, Done, Job, Outcome, Validators};
use kiosque::model::{Article, CATEGORIES, Source};
use kiosque::store::{CachedFeed, Store};
use theme::{Palette, bold};

const AUTO_REFRESH: Duration = Duration::from_secs(5 * 60);
const STALL: Duration = Duration::from_secs(60);
/// Largeur max de la colonne de lecture (lignes trop longues = lecture penible).
const COLUMN_MAX: f32 = 860.0;
const GAP: f32 = 10.0;
const PAD_X: f32 = 18.0;
const PAD_Y: f32 = 14.0;
const STAR: f32 = 44.0;

#[derive(PartialEq, Clone, Copy)]
enum Tab {
    Live,
    Favorites,
}

struct App {
    store: Store,
    feed: Vec<Article>,
    tab: Tab,
    query: String,
    /// None = toutes les categories.
    category: Option<String>,
    source: Option<String>,
    tx: Sender<Done>,
    rx: Receiver<Done>,
    pending: usize,
    known: HashSet<String>,
    fresh: HashSet<String>,
    last_auto: Instant,
    show_sources: bool,
    new_name: String,
    new_url: String,
    new_category: String,
}

impl App {
    fn new(cc: &eframe::CreationContext) -> Self {
        theme::apply(&cc.egui_ctx);
        let store = Store::open();
        let feed = store.merged_feed();
        let (tx, rx) = channel();
        let mut app = Self {
            known: feed.iter().map(|a| a.link.clone()).collect(),
            feed,
            store,
            tab: Tab::Live,
            query: String::new(),
            category: None,
            source: None,
            tx,
            rx,
            pending: 0,
            fresh: HashSet::new(),
            last_auto: Instant::now(),
            show_sources: false,
            new_name: String::new(),
            new_url: String::new(),
            new_category: CATEGORIES[0].into(),
        };
        app.refresh(&cc.egui_ctx);
        app
    }

    fn refresh(&mut self, ctx: &egui::Context) {
        if self.pending > 0 {
            return;
        }
        self.last_auto = Instant::now();
        let jobs: Vec<Job> = self
            .store
            .sources
            .iter()
            .filter(|s| s.enabled)
            .map(|s| {
                let c = self.store.cache.feeds.get(&s.url);
                Job {
                    source: s.clone(),
                    validators: Validators {
                        etag: c.and_then(|c| c.etag.clone()),
                        last_modified: c.and_then(|c| c.last_modified.clone()),
                    },
                }
            })
            .collect();
        self.pending = jobs.len();
        let ctx = ctx.clone();
        fetch::spawn_all(jobs, self.tx.clone(), move || ctx.request_repaint());
    }

    fn poll(&mut self) {
        let mut changed = false;
        while let Ok(Done { url, outcome }) = self.rx.try_recv() {
            self.pending = self.pending.saturating_sub(1);
            match outcome {
                Outcome::Fresh {
                    articles,
                    validators,
                } => {
                    let now = chrono::Utc::now().timestamp();
                    self.store.absorb(
                        &url,
                        articles,
                        validators.etag,
                        validators.last_modified,
                        now,
                    );
                    changed = true;
                }
                Outcome::NotModified => {
                    self.store
                        .cache
                        .feeds
                        .entry(url)
                        .or_insert_with(CachedFeed::default)
                        .error = None
                }
                Outcome::Failed(e) => {
                    self.store
                        .cache
                        .feeds
                        .entry(url)
                        .or_insert_with(CachedFeed::default)
                        .error = Some(e)
                }
            }
        }
        if changed {
            self.feed = self.store.merged_feed();
            // Premier lancement : rien n'est « nouveau ».
            if !self.known.is_empty() {
                for a in &self.feed {
                    if !self.known.contains(&a.link) {
                        self.fresh.insert(a.link.clone());
                    }
                }
            }
        }
    }

    fn finish_if_done(&mut self, was_pending: bool) {
        if was_pending && self.pending == 0 {
            self.store.cache.last_refresh = chrono::Utc::now().timestamp();
            self.store.save_cache();
            self.known.extend(self.feed.iter().map(|a| a.link.clone()));
        }
    }

    fn errors(&self) -> Vec<(&str, &str)> {
        self.store
            .sources
            .iter()
            .filter(|s| s.enabled)
            .filter_map(|s| {
                let e = self.store.cache.feeds.get(&s.url)?.error.as_deref()?;
                Some((s.name.as_str(), e))
            })
            .collect()
    }

    fn visible(&self) -> Vec<Article> {
        let q = self.query.trim().to_lowercase();
        let base = match self.tab {
            Tab::Live => &self.feed,
            Tab::Favorites => &self.store.favorites,
        };
        base.iter()
            .filter(|a| {
                self.category
                    .as_deref()
                    .is_none_or(|c| self.store.category_of(&a.source) == Some(c))
            })
            .filter(|a| self.source.as_ref().is_none_or(|s| &a.source == s))
            .filter(|a| {
                q.is_empty()
                    || a.title.to_lowercase().contains(&q)
                    || a.excerpt.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    }

    fn top_bar(&mut self, ui: &mut Ui) {
        let ctx = ui.ctx().clone();
        let p = Palette::of(ui);
        ui.horizontal(|ui| {
            ui.label(RichText::new("Kiosque").font(bold(26.0)).color(p.text));
            ui.add_space(14.0);
            if pill(ui, "Direct", self.tab == Tab::Live, &p).clicked() {
                self.tab = Tab::Live;
            }
            let fav = match self.store.favorites.len() {
                0 => "Favoris".to_string(),
                n => format!("Favoris  {n}"),
            };
            if pill(ui, &fav, self.tab == Tab::Favorites, &p).clicked() {
                self.tab = Tab::Favorites;
            }

            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if pill(ui, "Sources", self.show_sources, &p).clicked() {
                    self.show_sources = !self.show_sources;
                }
                if self.pending > 0 {
                    ui.add_sized(
                        [36.0, 36.0],
                        egui::Spinner::new().size(20.0).color(p.accent),
                    );
                } else if ui
                    .add_sized(
                        [40.0, 36.0],
                        Button::new(RichText::new("⟳").size(20.0).color(p.text))
                            .fill(p.card)
                            .stroke(Stroke::new(1.0, p.border))
                            .corner_radius(CornerRadius::same(18)),
                    )
                    .on_hover_text("Actualiser (F5)")
                    .clicked()
                {
                    self.refresh(&ctx);
                }
            });
        });

        ui.add_space(10.0);
        ui.horizontal_wrapped(|ui| {
            if pill(ui, "Tout", self.category.is_none(), &p).clicked() {
                self.category = None;
            }
            for c in CATEGORIES {
                if pill(ui, c, self.category.as_deref() == Some(c), &p).clicked() {
                    self.category = Some(c.into());
                    // La source choisie n'appartient peut-etre pas a cette categorie.
                    if self
                        .source
                        .as_deref()
                        .is_some_and(|s| self.store.category_of(s) != Some(c))
                    {
                        self.source = None;
                    }
                }
            }
        });

        ui.add_space(10.0);
        ui.horizontal(|ui| {
            let search = Frame::new()
                .fill(p.card)
                .stroke(Stroke::new(1.0, p.border))
                .corner_radius(CornerRadius::same(10))
                .inner_margin(Margin::symmetric(12, 8))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("🔍").size(15.0).color(p.muted));
                        let r = ui.add(
                            TextEdit::singleline(&mut self.query)
                                .hint_text(RichText::new("Rechercher  (Ctrl+F)").color(p.muted))
                                .font(FontId::proportional(16.0))
                                .frame(Frame::NONE)
                                .desired_width(280.0),
                        );
                        if !self.query.is_empty()
                            && ui
                                .add(Button::new(RichText::new("✕").color(p.muted)).frame(false))
                                .clicked()
                        {
                            self.query.clear();
                        }
                        r
                    })
                    .inner
                })
                .inner;
            if ui.input(|i| i.modifiers.command && i.key_pressed(Key::F)) {
                search.request_focus();
            }
            if search.has_focus() && ui.input(|i| i.key_pressed(Key::Escape)) {
                self.query.clear();
            }

            let label = self
                .source
                .clone()
                .unwrap_or_else(|| "Toutes les sources".into());
            egui::ComboBox::from_id_salt("src")
                .selected_text(label)
                .width(200.0)
                .height(420.0)
                .show_ui(ui, |ui| {
                    ui.selectable_value(&mut self.source, None, "Toutes les sources");
                    let cat = self.category.as_deref();
                    for s in self
                        .store
                        .sources
                        .iter()
                        .filter(|s| s.enabled && cat.is_none_or(|c| s.category == c))
                    {
                        let text = RichText::new(&s.name).color(p.source(&s.name));
                        ui.selectable_value(&mut self.source, Some(s.name.clone()), text);
                    }
                });
        });

        ui.add_space(8.0);
        ui.horizontal(|ui| {
            let status = if self.pending > 0 {
                format!("Mise à jour… {} restantes", self.pending)
            } else if self.store.cache.last_refresh > 0 {
                format!("À jour · {}", ago(self.store.cache.last_refresh))
            } else {
                String::new()
            };
            ui.label(RichText::new(status).size(14.0).color(p.muted));
            if !self.fresh.is_empty() && self.tab == Tab::Live {
                let n = self.fresh.len();
                let b = Button::new(
                    RichText::new(format!("{n} nouveaux"))
                        .size(13.5)
                        .strong()
                        .color(p.on_accent),
                )
                .fill(p.accent)
                .corner_radius(CornerRadius::same(12))
                .min_size(Vec2::new(0.0, 24.0));
                if ui.add(b).on_hover_text("Marquer comme vus").clicked() {
                    self.fresh.clear();
                }
            }
            let errs = self.errors();
            if !errs.is_empty() {
                let tip = errs
                    .iter()
                    .map(|(n, e)| format!("{n} : {e}"))
                    .collect::<Vec<_>>()
                    .join("\n");
                ui.label(
                    RichText::new(format!("·  {} hors service", errs.len()))
                        .size(14.0)
                        .color(p.accent),
                )
                .on_hover_text(tip);
            }
        });
    }

    fn list(&mut self, ui: &mut Ui) {
        let p = Palette::of(ui);
        let items = self.visible();
        if items.is_empty() {
            ui.add_space(80.0);
            ui.vertical_centered(|ui| {
                let (title, sub) = match (self.tab, self.pending > 0) {
                    (Tab::Favorites, _)
                        if self.query.is_empty()
                            && self.source.is_none()
                            && self.category.is_none() =>
                    {
                        (
                            "Aucun favori",
                            "Clique sur l'étoile d'un article pour le garder ici.",
                        )
                    }
                    (Tab::Live, true) => ("Chargement…", ""),
                    _ => (
                        "Rien à afficher",
                        "Essaie une autre recherche ou une autre source.",
                    ),
                };
                ui.label(RichText::new(title).font(bold(20.0)).color(p.text));
                ui.label(RichText::new(sub).size(15.0).color(p.muted));
            });
            return;
        }
        let mut toggle: Option<Article> = None;
        let mut open: Option<String> = None;
        ScrollArea::vertical()
            .auto_shrink(false)
            .show_viewport(ui, |ui, viewport| {
                // Hauteurs variables, mais seules les cartes visibles sont dessinees.
                // Les mises en page de texte sont mises en cache par egui d'une image a l'autre.
                let w = ui.available_width();
                let layouts: Vec<CardLayout> = items
                    .iter()
                    .map(|a| CardLayout::new(ui, a, w, self.store.is_read(&a.link), &p))
                    .collect();
                let total: f32 = layouts.iter().map(|l| l.height + GAP).sum();
                let origin = ui.min_rect().min;
                ui.set_height(total);
                let mut y = 0.0;
                for (a, l) in items.iter().zip(layouts) {
                    let h = l.height;
                    if y + h >= viewport.min.y && y <= viewport.max.y {
                        let rect = Rect::from_min_size(origin + Vec2::new(0.0, y), Vec2::new(w, h));
                        let st = RowState {
                            fav: self.store.is_favorite(&a.link),
                            fresh: self.fresh.contains(&a.link),
                        };
                        match card(ui, rect, a, l, st, &p) {
                            RowAction::Open => open = Some(a.link.clone()),
                            RowAction::Star => toggle = Some(a.clone()),
                            RowAction::None => {}
                        }
                    }
                    y += h + GAP;
                }
            });
        if let Some(a) = toggle {
            self.store.toggle_favorite(&a);
        }
        if let Some(link) = open {
            let _ = open::that_detached(&link);
            self.store.mark_read(&link);
            self.fresh.remove(&link);
        }
    }

    fn sources_window(&mut self, ctx: &egui::Context, p: &Palette) {
        let mut open = self.show_sources;
        let mut changed = false;
        let mut remove: Option<usize> = None;
        egui::Window::new(RichText::new("Sources").font(bold(18.0)))
            .open(&mut open)
            .collapsible(false)
            .resizable(true)
            .default_width(460.0)
            .anchor(Align2::RIGHT_TOP, Vec2::new(-16.0, 70.0))
            .frame(Frame::window(&ctx.global_style()).inner_margin(Margin::same(16)))
            .show(ctx, |ui| {
                ScrollArea::vertical().max_height(420.0).show(ui, |ui| {
                    for cat in CATEGORIES {
                        ui.add_space(4.0);
                        ui.label(RichText::new(cat).font(bold(15.0)).color(p.muted));
                        for (i, s) in self
                            .store
                            .sources
                            .iter_mut()
                            .enumerate()
                            .filter(|(_, s)| s.category == cat)
                        {
                            ui.horizontal(|ui| {
                                changed |= ui.checkbox(&mut s.enabled, "").changed();
                                let color = if s.enabled {
                                    p.source(&s.name)
                                } else {
                                    p.muted
                                };
                                ui.add(
                                    Label::new(RichText::new(&s.name).size(15.5).color(color))
                                        .truncate(),
                                )
                                .on_hover_text(&s.url);
                                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                    if ui
                                        .add(
                                            Button::new(
                                                RichText::new("Supprimer")
                                                    .size(13.0)
                                                    .color(p.muted),
                                            )
                                            .frame(false),
                                        )
                                        .clicked()
                                    {
                                        remove = Some(i);
                                    }
                                    egui::ComboBox::from_id_salt(("cat", i))
                                        .selected_text(s.category.clone())
                                        .width(100.0)
                                        .show_ui(ui, |ui| {
                                            for c in CATEGORIES {
                                                changed |= ui
                                                    .selectable_value(
                                                        &mut s.category,
                                                        c.to_string(),
                                                        c,
                                                    )
                                                    .changed();
                                            }
                                        });
                                });
                            });
                        }
                    }
                });
                ui.add_space(6.0);
                ui.separator();
                ui.add_space(6.0);
                ui.label(
                    RichText::new("Ajouter un flux RSS ou Atom")
                        .size(14.0)
                        .color(p.muted),
                );
                ui.horizontal(|ui| {
                    ui.add(
                        TextEdit::singleline(&mut self.new_name)
                            .hint_text("Nom")
                            .desired_width(110.0),
                    );
                    ui.add(
                        TextEdit::singleline(&mut self.new_url)
                            .hint_text("https://…/rss")
                            .desired_width(210.0),
                    );
                    egui::ComboBox::from_id_salt("new_cat")
                        .selected_text(self.new_category.clone())
                        .width(100.0)
                        .show_ui(ui, |ui| {
                            for c in CATEGORIES {
                                ui.selectable_value(&mut self.new_category, c.to_string(), c);
                            }
                        });
                    let ok = self.new_url.trim().starts_with("https://")
                        && !self
                            .store
                            .sources
                            .iter()
                            .any(|s| s.url == self.new_url.trim());
                    let add = Button::new(RichText::new("Ajouter").color(if ok {
                        p.on_accent
                    } else {
                        p.muted
                    }))
                    .fill(if ok { p.accent } else { p.chip });
                    if ui.add_enabled(ok, add).clicked() {
                        let url = self.new_url.trim().to_string();
                        let name = match self.new_name.trim() {
                            "" => url
                                .split('/')
                                .nth(2)
                                .unwrap_or("Source")
                                .trim_start_matches("www.")
                                .to_string(),
                            n => n.to_string(),
                        };
                        self.store
                            .sources
                            .push(Source::new(&name, &url, &self.new_category));
                        self.new_name.clear();
                        self.new_url.clear();
                        changed = true;
                    }
                });
            });
        if let Some(i) = remove {
            let s = self.store.sources.remove(i);
            self.store.cache.feeds.remove(&s.url);
            changed = true;
        }
        if changed {
            self.store.save_sources();
            self.feed = self.store.merged_feed();
            let cat = self.category.as_deref();
            if self.source.as_ref().is_some_and(|n| {
                !self
                    .store
                    .sources
                    .iter()
                    .any(|s| s.enabled && &s.name == n && cat.is_none_or(|c| s.category == c))
            }) {
                self.source = None;
            }
            self.refresh(ctx);
        }
        self.show_sources = open;
    }
}

/// Bouton-pilule (onglets, actions) : plein en couleur d'accent quand actif.
fn pill(ui: &mut Ui, text: &str, selected: bool, p: &Palette) -> egui::Response {
    let (fill, color, stroke) = if selected {
        (p.accent, p.on_accent, Stroke::NONE)
    } else {
        (p.card, p.text, Stroke::new(1.0, p.border))
    };
    ui.add(
        Button::new(RichText::new(text).size(15.0).strong().color(color))
            .fill(fill)
            .stroke(stroke)
            .corner_radius(CornerRadius::same(18))
            .min_size(Vec2::new(0.0, 36.0)),
    )
}

#[derive(Clone, Copy)]
struct RowState {
    fav: bool,
    fresh: bool,
}

enum RowAction {
    None,
    Open,
    Star,
}

fn text_job(
    text: &str,
    font: FontId,
    color: Color32,
    line_h: f32,
    width: f32,
    rows: usize,
) -> LayoutJob {
    let mut job = LayoutJob::default();
    job.append(
        text,
        0.0,
        TextFormat {
            font_id: font,
            color,
            line_height: Some(line_h),
            ..Default::default()
        },
    );
    job.wrap = TextWrapping {
        max_width: width,
        max_rows: rows,
        break_anywhere: false,
        overflow_character: Some('…'),
    };
    job
}

const META_H: f32 = 18.0;
const TITLE_LH: f32 = 25.0;
const EXCERPT_LH: f32 = 21.0;

/// Mise en page d'une carte : titre sur 3 lignes max, extrait sur 2.
struct CardLayout {
    title: Arc<egui::Galley>,
    excerpt: Option<Arc<egui::Galley>>,
    height: f32,
}

impl CardLayout {
    fn new(ui: &Ui, a: &Article, w: f32, read: bool, p: &Palette) -> Self {
        let text_w = w - PAD_X * 2.0 - STAR;
        let painter = ui.painter();
        let color = if read { p.read } else { p.text };
        let title = painter.layout_job(text_job(&a.title, bold(18.5), color, TITLE_LH, text_w, 3));
        let excerpt = (!a.excerpt.is_empty()).then(|| {
            painter.layout_job(text_job(
                &a.excerpt,
                FontId::proportional(15.0),
                p.muted,
                EXCERPT_LH,
                text_w,
                2,
            ))
        });
        let mut height = PAD_Y * 2.0 + META_H + 6.0 + TITLE_LH * title.rows.len().max(1) as f32;
        if let Some(e) = &excerpt {
            height += 6.0 + EXCERPT_LH * e.rows.len() as f32;
        }
        Self {
            title,
            excerpt,
            height: height.max(STAR + PAD_Y * 2.0),
        }
    }
}

fn card(
    ui: &mut Ui,
    rect: Rect,
    a: &Article,
    l: CardLayout,
    st: RowState,
    p: &Palette,
) -> RowAction {
    let resp = ui
        .interact(rect, ui.scope_id().with(("card", &a.link)), Sense::click())
        .on_hover_cursor(egui::CursorIcon::PointingHand);
    let hovered = resp.hovered();
    let painter = ui.painter();

    painter.rect(
        rect,
        CornerRadius::same(12),
        if hovered { p.card_hover } else { p.card },
        Stroke::new(
            1.0,
            if hovered {
                p.accent.gamma_multiply(0.6)
            } else {
                p.border
            },
        ),
        egui::StrokeKind::Inside,
    );
    if st.fresh {
        let bar = Rect::from_min_size(
            rect.min + Vec2::new(0.0, 14.0),
            Vec2::new(4.0, rect.height() - 28.0),
        );
        painter.rect_filled(bar, CornerRadius::same(2), p.accent);
    }

    let text_w = rect.width() - PAD_X * 2.0 - STAR;
    let x = rect.min.x + PAD_X;
    let mut y = rect.min.y + PAD_Y;

    // Ligne meta : source (couleur propre) · date · NOUVEAU
    let mut meta = LayoutJob::default();
    meta.append(
        &a.source,
        0.0,
        TextFormat::simple(bold(13.5), p.source(&a.source)),
    );
    meta.append(
        &format!("  ·  {}", ago(a.published)),
        0.0,
        TextFormat::simple(FontId::proportional(13.5), p.muted),
    );
    if st.fresh {
        meta.append("   NOUVEAU", 0.0, TextFormat::simple(bold(12.0), p.accent));
    }
    meta.wrap = TextWrapping {
        max_width: text_w,
        max_rows: 1,
        break_anywhere: true,
        overflow_character: Some('…'),
    };
    painter.galley(Pos2::new(x, y), painter.layout_job(meta), p.muted);
    y += META_H + 6.0;

    let title_h = TITLE_LH * l.title.rows.len().max(1) as f32;
    painter.galley(Pos2::new(x, y), l.title, p.text);
    y += title_h + 6.0;
    if let Some(e) = l.excerpt {
        painter.galley(Pos2::new(x, y), e, p.muted);
    }

    // Etoile favori
    let star_rect = Rect::from_center_size(
        Pos2::new(
            rect.max.x - PAD_X - STAR / 2.0 + 8.0,
            rect.min.y + PAD_Y + 14.0,
        ),
        Vec2::splat(STAR),
    );
    let star = ui.interact(
        star_rect,
        ui.scope_id().with(("star", &a.link)),
        Sense::click(),
    );
    if star.hovered() {
        painter.circle_filled(star_rect.center(), 18.0, p.chip);
    }
    let color = if st.fav || star.hovered() {
        p.accent
    } else {
        p.muted
    };
    paint_star(painter, star_rect.center(), 11.0, st.fav, color);
    let star_clicked = star
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text(if st.fav {
            "Retirer des favoris"
        } else {
            "Ajouter aux favoris"
        })
        .clicked();

    if star_clicked {
        RowAction::Star
    } else if resp.clicked() || resp.middle_clicked() {
        RowAction::Open
    } else {
        RowAction::None
    }
}

/// Etoile vectorielle (independante des polices).
fn paint_star(p: &egui::Painter, c: Pos2, r: f32, filled: bool, color: Color32) {
    let pts: Vec<Pos2> = (0..10)
        .map(|i| {
            let ang = -std::f32::consts::FRAC_PI_2 + i as f32 * std::f32::consts::PI / 5.0;
            let rad = if i % 2 == 0 { r } else { r * 0.45 };
            c + Vec2::new(ang.cos(), ang.sin()) * rad
        })
        .collect();
    if filled {
        for i in 0..10 {
            p.add(egui::Shape::convex_polygon(
                vec![c, pts[i], pts[(i + 1) % 10]],
                color,
                Stroke::NONE,
            ));
        }
    }
    p.add(egui::Shape::closed_line(pts, Stroke::new(1.6, color)));
}

/// Date relative courte : « 5 min », « 3 h », « hier », « 12/11 ».
fn ago(ts: i64) -> String {
    let d = (chrono::Utc::now().timestamp() - ts).max(0);
    match d {
        0..60 => "à l'instant".into(),
        60..3600 => format!("il y a {} min", d / 60),
        3600..86_400 => format!("il y a {} h", d / 3600),
        86_400..172_800 => "hier".into(),
        _ => chrono::DateTime::from_timestamp(ts, 0)
            .map(|t| t.with_timezone(&chrono::Local).format("%d/%m").to_string())
            .unwrap_or_default(),
    }
}

/// Zone centrale de largeur limitee, centree.
fn centered(ui: &mut Ui, add: impl FnOnce(&mut Ui)) {
    let full = ui.available_rect_before_wrap();
    let w = full.width().min(COLUMN_MAX);
    let rect = Rect::from_min_size(
        Pos2::new(full.center().x - w / 2.0, full.min.y),
        Vec2::new(w, full.height()),
    );
    ui.scope_builder(
        UiBuilder::new()
            .max_rect(rect)
            .layout(Layout::top_down(Align::Min)),
        add,
    );
}

impl eframe::App for App {
    fn ui(&mut self, ui: &mut Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        let p = Palette::of(ui);
        let was_pending = self.pending > 0;
        self.poll();
        // Garde-fou : une actualisation ne bloque jamais les suivantes.
        if self.pending > 0 && self.last_auto.elapsed() > STALL {
            self.pending = 0;
        }
        self.finish_if_done(was_pending);

        if ctx.input(|i| i.key_pressed(Key::F5)) || self.last_auto.elapsed() >= AUTO_REFRESH {
            self.refresh(&ctx);
        }

        Panel::top("top")
            .show_separator_line(false)
            .frame(Frame::new().fill(p.bg).inner_margin(Margin {
                left: 20,
                right: 20,
                top: 16,
                bottom: 10,
            }))
            .show(ui, |ui| centered(ui, |ui| self.top_bar(ui)));
        egui::CentralPanel::default()
            .frame(Frame::new().fill(p.bg).inner_margin(Margin {
                left: 20,
                right: 20,
                top: 4,
                bottom: 0,
            }))
            .show(ui, |ui| centered(ui, |ui| self.list(ui)));
        if self.show_sources {
            self.sources_window(&ctx, &p);
        }

        // Pas de boucle de rendu continue : sondage rapide seulement pendant une actualisation.
        ctx.request_repaint_after(if self.pending > 0 {
            Duration::from_millis(250)
        } else {
            Duration::from_secs(30)
        });
    }
}

/// Meme dessin que l'icone du fichier .exe (voir build.rs).
fn icon() -> egui::IconData {
    egui::IconData {
        rgba: icon_art::icon_rgba(64),
        width: 64,
        height: 64,
    }
}

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Kiosque")
            .with_icon(Arc::new(icon()))
            .with_inner_size([960.0, 900.0])
            .with_min_inner_size([520.0, 420.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Kiosque",
        options,
        Box::new(|cc| Ok(Box::new(App::new(cc)))),
    )
}
