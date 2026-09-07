# Motion handover

State of the motion work across the product. Written so the next person can pick up mid-stream
without re-deriving the analysis.

**Round 1** ([PR #16](https://github.com/suhascpaunikar/Insight-Hub/pull/16), merged) — the motion
tokens, the P0 microanimations, and lazy loading on Campaigns and Insights.
**Round 2** — the same treatment across every remaining page and step, plus Tier 1 and Tier 2 in
full. Tiers 1 and 2 below are now **done**; what is left is Tier 3, and Tier 3 is mostly one
refactor.

The house rules live in **DESIGN.md → Motion**. That section is the authority; this file is the backlog.

---

## What shipped

Two commits: `4b6fc79` (the motion work) and `56f1faa` (the transitions.dev skills).

| | Change | Where |
| --- | --- | --- |
| Tokens | `--motion-fast/base/slow`, `--ease-out` | `supabase.css:94-97`, documented in `DESIGN.md` |
| P0-1 | Global `prefers-reduced-motion` guard | end of `supabase.css` |
| P0-2 | Toast exits under its own animation | `core.js` `toast()` |
| P0-3 | Dropdown menu entrance, origin-aware | `.dd-menu` + `@keyframes dd-in` |
| P0-4 | Range switch crossfade + staggered regrow | `.chart-plot[data-swap]`, `dashboard.js` range handler |
| — | `lazySection()` + shimmer skeletons | `core.js`, `dashboard.js`, `insights.js` |

**Why P0-1 mattered:** three `prefers-reduced-motion` blocks already existed, but each was scoped to a
single assistant surface. The dialog, scrim and toast animations were unguarded. The new block at the
foot of the stylesheet covers the rest of the product and must stay last so it wins.

**Why P0-4 is a crossfade and not a height morph:** `RANGES` is 7d (7 points) and 30d (24 points).
Different column counts, so there is no 1:1 mapping to tween between. The old plot leaves over
`--motion-fast`, the new series grows from its own baseline at 8ms per column.

### Lazy sections

A screen with data holds a shimmer skeleton for 1–1.5s, once per section per browser-tab session,
then the content fades up. The wait is synthetic — the prototype has no network — and exists so the
screens demo what they will feel like against a real API.

- **Cached in `sessionStorage`**, not a module flag: each screen is its own document, so a module
  variable would not survive the walk from campaigns to insights and every trip back would reload.
- **Only where there is data.** An empty workspace and a campaign with `volumeOf(c) === 0` go
  straight to their zero states. Settings panels are local forms and paint instantly, by decision.
- **Chrome stays live throughout.** On an Insights tab switch only the panel below skeletons; the
  header, filters and tab strip stay real with the clicked tab already selected. Blanking the control
  someone just clicked reads as the click having failed.
- **Skeleton blocks are measured, not guessed** — metric card 147px vs 147.1 real, toolbar 45 vs 45,
  row 73 vs 73.1. The table header lands within ~1px of its loaded position. If you add a skeleton,
  measure it the same way (recipe below) rather than eyeballing.
- **Blocks are deliberately flat.** A skeleton that mimicked bars or a rating ramp would be fake data
  on screen, and for the second it is up a reader cannot tell it from the real thing.

---

## The constraint that shapes everything left

Every screen repaints by replacing `innerHTML` — **14 sites across 8 files**
(`assistant.js`, `builder.js`, `content-step.js`, `core.js`, `dashboard.js`, `insights.js`,
`settings.js`, `shell.js`). Two consequences that keep recurring:

1. **Entrance animations re-fire on every keystroke** unless gated. Search input calls the same
   render path as a tab switch. This is why `lazySection` keys on section identity rather than
   firing per render.
2. **`transition:` never runs on re-created nodes.** There is no previous state to animate from.
   `.chart-seg { transition: height .3s }` (`supabase.css:1015`) is dead code on the dashboard for
   exactly this reason — left in place because it is live on the insights charts.

Anything that needs old and new state on screen at once — row enter/exit, a true skeleton→content
crossfade — is blocked behind this until the render path does keyed reconciliation or FLIP.
**That is the single highest-leverage refactor available**, and no animation library removes the
need for it.

---

## Status by tier

### Tier 1 — DONE

All five shipped in round 2, product-wide:

1. **Stylesheet tokenized** — 38 replacements. `.12s`/`120ms`/`.1s` → `--motion-fast`,
   `.15s`/`.18s` → `--motion-base`, `.3s` → `--motion-slow`, and every `ease` → `var(--ease-out)`.
   Six values remain hardcoded, all in the assistant layer (400/500/600ms and the card's own
   `cubic-bezier`): they are ambient, carry their own intent, and match no token usage. Leave them.
2. **Tooltip intent delay** — 80ms in, instant out, on the hover state only.
3. **Open/close asymmetry** — opens take `--motion-base`, closes `--motion-fast`. The dropdown
   gained a real close animation, which meant `hidden` can no longer be set on the same frame:
   `[hidden]` is `display:none !important` and would cut the exit off. See `closeMenu()`.
4. **Table row hover** — background transition plus the 2px chevron lean already used by `.srow`.
5. **Live status pulse** — a pseudo-element ring on a 2.4s loop, transform/opacity so it
   composites rather than repainting.

### Tier 2 — DONE

6. **Count-up on the headline figures**, fired only by a range change. The figures carry
   `data-value` so a render can tween from the previous number without re-parsing formatted text.
7. **Sliding tab indicator** on Insights and Settings. The `innerHTML` wall meant the marker is a
   new node every render with nothing to travel from, so `wireTabPill()` remembers the last
   position per strip and replays it. First paint and reduced motion land in place instead.
8. **Sparkline entrance** — reuses the range-switch grow, fired when content arrives after a
   skeleton, so figures and shapes land together.
9. **Clone flash** — fills the 350ms already spent waiting to navigate.

### Also in round 2

- **Settings skeletons** — reverses the round-1 decision that config is not data. All three tabs.
- **Builder step travel** — direction-aware slide, no skeleton. Fired only from `advance()`;
  `renderBuilder()` also runs on every save and field edit, and animating those would strobe the
  form someone is filling.
- **Toast stack collapse** — the stack used to jump when one was removed. The departing toast
  animates a negative `margin-bottom` equal to its own height plus the flex gap. `transitionend`
  is keyed to `margin-bottom` specifically, because opacity finishes first and removing on it
  would cut the collapse short and reintroduce the jump.

### Tier 3 — what actually remains

1. **Row enter/exit on filter.** Blocked on the `innerHTML` constraint. Needs keyed reconciliation
    or a FLIP pass. `@formkit/auto-animate` looks tailor-made and will not work: it observes a
    parent's children, and replacing `innerHTML` destroys the `<tbody>` and the observer with it.
2. **Skeleton→content crossfade.** `14-skeleton-reveal` needs both layers in the DOM at once.
    Same wall. Current `lazy-in` fade-up is a reasonable substitute; the gain does not justify the
    refactor on its own.
3. **`.chart-tip`** (`supabase.css:1031`) fades at `.1s`; a 2px rise would make it read as attached
    to its column.
4. **Rail collapse.** `.rail` width animates over `.18s` but `.rail-text { display: none }`
    (`supabase.css:583`) snaps, so labels pop while the panel glides. Fade + width, or decide the
    snap is deliberate.
5. **`a.metric:hover` (`supabase.css:975`) is dead code** — `metricCard` renders a `<div>`, so the
    rule never matches. Either make the cards interactive or delete it. Do not build hover motion
    on top of it.

---

## The transitions.dev skills

Installed via `npx skills add Jakubantalik/transitions.dev` → `.agents/skills/`, symlinked into
`.claude/skills/`, pinned by `skills-lock.json`. Documentation only, no executables, nothing ships
to the browser.

- **`transitions-dev`** — 32 portable CSS transitions, `t-*` namespaced, each with its own
  `prefers-reduced-motion` guard.
- **`transitions-polish`** — audits motion that already exists. `transitions review` reports and
  writes nothing; `transitions polish` asks before editing.

### Read this before running `transitions polish`

**Its token scale is not ours.**

| Purpose | Ours (DESIGN.md) | Theirs |
| --- | --- | --- |
| Quick feedback | `--motion-fast: 120ms` | `--duration-quick: 150ms` |
| Standard | `--motion-base: 180ms` | `--duration-fast: 250ms` |
| Easing | `cubic-bezier(0.22, 0.61, 0.36, 1)` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Hover-out | — | `--ease-bounce-strong: cubic-bezier(0.34, 3.85, 0.64, 1)` |

That last row directly contradicts DESIGN.md: *nothing overshoots*. Their scale also runs roughly
2× slower than a console wants, and leans on `filter: blur()` almost everywhere — fine on one modal,
expensive across a 24-column chart or a 20-row table.

**Use it as an auditor, not an authority.** The scan is genuinely good at finding ad-hoc values;
map the findings onto our scale.

Skip for this product: card tilt, like button, success check, matrix loader, spinning counter,
avatar hover, plus-menu morph. Consumer motion — in an admin console it reads as unserious.

**Licensing:** the repo has **no LICENSE file**, so formally all rights reserved. The intent is
plainly "copy this" (copy buttons, a CLI, an installable skill), and CSS timing values are largely
uncopyrightable, but for anything client-facing prefer using it as reference for *values* over
pasting blocks verbatim.

---

## How to verify a change

No test suite. Everything so far was verified by driving real Chromium. The recipe:

```bash
python3 -m http.server 8099          # serve the repo root
```

Then Playwright against the pre-installed browser
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), with two gotchas that cost real time:

1. **Block the font CDN** (`page.route('**fonts.g**', r => r.abort())`). It is unreachable in some
   environments and holds the `load` event open for seconds.
2. **Use `waitUntil: 'commit'`**, not the default. `goto` otherwise resolves *after* a 1–1.5s
   skeleton has already finished, and you will conclude the skeleton never rendered.

To measure a skeleton against real content, capture `getBoundingClientRect().height` for both states
and diff them — that is how the current blocks were tuned to ~1px.

Worth checking on any motion change: reduced-motion (`newContext({ reducedMotion: 'reduce' })`),
that typing in search does not re-trigger a load, and that all four pages stay free of console
errors.

---

## Decisions already made — do not silently reverse

- **No animation library.** Motion/GSAP/anime were evaluated and rejected: this is a zero-build,
  zero-dependency static prototype (`netlify.toml`: *"Static prototype — no build step"*), and its
  only external resource, Google Fonts, is loaded non-blocking specifically so a slow CDN cannot
  delay the page. A bundler-less `import` from a CDN sits in the module graph and would contradict
  that. If a library is ever adopted, **vendor it** into `assets/vendor/`.
- **Builder wizard steps are excluded** from lazy loading. A 1–1.5s wait between steps of a form
  someone is filling reads as lag, not loading.
- **Settings panels paint instantly** — local forms, not records being fetched.
- **The lazy cache is per browser-tab session.** A demo re-run needs a new tab (or
  `sessionStorage.clear()`) to show the skeletons again.
