import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/kiosque.css"), "utf8");

function vars(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}
const light = vars(css.match(/:root\s*{([^}]*)}/)[1]);
const dark = { ...light, ...vars(css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)[1]) };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const blend = (fg, bg, alpha) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)));

const READ_OPACITY = Number(css.match(/\.feed-list li\.read\s*{[^}]*opacity:\s*([\d.]+)/)[1]);

describe.each([["clair", light], ["sombre", dark]])("contraste du thème %s (≥ 4,5 : 1)", (_name, p) => {
  const pairs = [
    ["texte sur fond", "text", "bg"], ["texte sur surface", "text", "surface"],
    ["texte discret sur fond", "muted", "bg"], ["texte discret sur surface", "muted", "surface"],
    ["lien sur surface", "accent", "surface"], ["lien sur fond", "accent", "bg"],
    ["texte du bouton", "accent-text", "accent"],
    ["erreur sur fond", "error", "bg"], ["erreur sur surface", "error", "surface"],
  ];
  it.each(pairs)("%s", (_label, fg, bg) => {
    expect(ratio(rgb(p[fg]), rgb(p[bg]))).toBeGreaterThanOrEqual(4.5);
  });

  it("article lu (opacité réduite) : texte, texte discret et lien restent lisibles", () => {
    for (const fg of ["text", "muted", "accent"]) {
      expect(ratio(blend(rgb(p[fg]), rgb(p.surface), READ_OPACITY), rgb(p.surface))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
