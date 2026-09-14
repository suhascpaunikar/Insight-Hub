/**
 * Re-derive assets/css/kumo-tokens.css from the installed @cloudflare/kumo.
 *
 *   node scripts/kumo-tokens.mjs
 *
 * Kumo authors its tokens in oklch behind `light-dark()`, inside Tailwind
 * `@theme {}` blocks that no browser understands. This prototype has no build
 * step and themes off a `data-theme` attribute rather than `color-scheme`, so
 * the values have to be resolved ahead of time. Everything here is mechanical:
 * read the package, follow the var() chain, split each `light-dark()` pair,
 * convert oklch to sRGB, and write one plain stylesheet.
 *
 * Nothing in the output is hand-picked. If a token looks wrong, it is wrong in
 * Kumo, and the fix is a package upgrade and a re-run — not an edit here.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PKG = 'node_modules/@cloudflare/kumo/dist/styles';
const theme = readFileSync(`${PKG}/theme-kumo.css`, 'utf8');
const standalone = readFileSync(`${PKG}/kumo-standalone.css`, 'utf8');
const version = JSON.parse(
  readFileSync('node_modules/@cloudflare/kumo/package.json', 'utf8'),
).version;

/* ---------- The palette Kumo's semantic tokens resolve against ---------- */
/* Tailwind's scale plus Kumo's own extra neutral steps, as compiled into the
   standalone build. Declaration order matters nowhere: these are all literals. */
const palette = new Map();
for (const [, name, value] of standalone.matchAll(
  /(--color-[a-z]+-\d+):\s*(oklch\([^)]*\)|#[0-9a-f]{3,8})/gi,
)) palette.set(name, value.trim());
/* `--color-white` / `--color-black` carry no numeric step. */
for (const [, name, value] of standalone.matchAll(
  /(--color-(?:white|black)):\s*(#[0-9a-f]{3,8}|oklch\([^)]*\))/gi,
)) palette.set(name, value.trim());

/* ---------- oklch -> sRGB ---------- */
/* The Oklab matrices from Björn Ottosson's reference, then the sRGB transfer
   function. Out-of-gamut channels are clipped, which is what a browser does
   for these tokens anyway — the palette is neutral or near-neutral throughout,
   so nothing here is close to an edge. */
function oklchToHex(str) {
  const m = str.match(/oklch\(\s*([\d.]+)%?\s+([\d.]*)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)/);
  if (!m) return null;
  let L = parseFloat(m[1]);
  if (str.includes('%')) L /= 100;
  const C = parseFloat(m[2] || '0');
  const hDeg = parseFloat(m[3] || '0');
  const alpha = m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;

  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const to8 = (v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(c * 255)));
  };
  const [r, g, bl] = lin.map(to8);
  if (alpha < 1) return `rgba(${r}, ${g}, ${bl}, ${+alpha.toFixed(4)})`;
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A single value: a var() chain into the palette, an oklch, or a literal. */
function resolve(value, depth = 0) {
  const v = value.trim();
  if (depth > 6) return v;

  const varRef = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+?)\s*)?\)$/);
  if (varRef) {
    const [, name, fallback] = varRef;
    if (palette.has(name)) return resolve(palette.get(name), depth + 1);
    return fallback ? resolve(fallback, depth + 1) : v;
  }

  /* color-mix stays verbatim: browsers compute it, and flattening it here
     would silently drop Kumo's intent. */
  if (v.startsWith('color-mix(')) return v;
  if (v.startsWith('oklch(')) return oklchToHex(v) ?? v;
  return v;
}

/** Split `light-dark(a, b)` on the comma that separates its two arguments. */
function splitPair(value) {
  const v = value.trim();
  if (!v.startsWith('light-dark(')) return [v, v];
  const inner = v.slice('light-dark('.length, -1);
  let depth = 0, cut = -1;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) { cut = i; break; }
  }
  return cut === -1 ? [inner, inner] : [inner.slice(0, cut), inner.slice(cut + 1)];
}

/* ---------- Read every token Kumo declares ---------- */
/* `@layer base` is where Kumo writes the two themes out explicitly — one block
   guarded by `:root, [data-theme="kumo"]` and one by `[data-mode="dark"]` —
   rather than folding them into `light-dark()` as the `@theme` blocks above it
   do. Those explicit blocks are what a consumer without `color-scheme` support
   is meant to read, so they are what is parsed here. */
const base = theme.slice(theme.indexOf('@layer base'));
const darkStart = base.search(/:root\[data-mode="dark"\]/);
if (darkStart === -1) throw new Error('no dark block — did the package layout change?');

const readBlock = (text) => {
  const out = [];
  for (const [, name, body] of text.matchAll(/(--(?:color|text-color)-kumo-[\w-]+):\s*([\s\S]*?);/g)) {
    out.push([name, resolve(body)]);
  }
  return out;
};
const light = readBlock(base.slice(0, darkStart));
const dark = readBlock(base.slice(darkStart));
if (!light.length || light.length !== dark.length) {
  throw new Error(`themes disagree: ${light.length} light vs ${dark.length} dark`);
}

/* Kumo pretty-prints long values across lines; one line each reads better here. */
const rows = (pairs) =>
  pairs.map(([n, v]) => `  ${n}: ${v.replace(/\s+/g, ' ')};`).join('\n');

writeFileSync(
  'assets/css/kumo-tokens.css',
  `/* ==========================================================================
   Kumo's design tokens, resolved.

   GENERATED — do not edit. Run \`node scripts/kumo-tokens.mjs\` to rebuild it
   from the installed package.

   Source: @cloudflare/kumo@${version}, dist/styles/theme-kumo.css.

   Kumo declares these inside Tailwind \`@theme {}\` blocks, in oklch, behind
   \`light-dark()\`. None of that survives in a stylesheet loaded straight into
   a browser with no build step, so the generator resolves each token's var()
   chain, converts oklch to sRGB and splits the pair into the two themes this
   prototype switches between with \`data-theme\`.

   Dark is the default and therefore sits on bare \`:root\`: every page ships
   \`<html data-theme="dark">\`, but a page that somehow lost the attribute
   should still get the theme it was designed in.
   ========================================================================== */

:root,
:root[data-theme="dark"] {
${rows(dark)}
}

:root[data-theme="light"] {
${rows(light)}
}
`,
);
console.log(`assets/css/kumo-tokens.css — ${dark.length} tokens from @cloudflare/kumo@${version}`);
