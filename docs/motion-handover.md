# Motion handover

State of the dashboard motion work as of the merge of `claude/dashboard-microanimations-priority-m9nnpf`
([PR #16](https://github.com/suhascpaunikar/Insight-Hub/pull/16)). Written so the next person can pick
up mid-stream without re-deriving the analysis.

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
   `.chart-seg { transition: height .3s }` (`supabase.css:982`) is dead code on the dashboard for
   exactly this reason — left in place because it is live on the insights charts.

Anything that needs old and new state on screen at once — row enter/exit, a true skeleton→content
crossfade — is blocked behind this until the render path does keyed reconciliation or FLIP.
**That is the single highest-leverage refactor available**, and no animation library removes the
need for it.

---

## Remaining work

### Tier 1 — cheap, no architectural change

1. **Tokenize the rest of the stylesheet.** 38 `transition:` declarations, 53 hardcoded duration
   values, only 7 using the new tokens. `.12s` and `120ms` are the same number written two ways
   **34 times**. This is the drift the tokens exist to stop, and only the rules touched in `4b6fc79`
   were converted. Use `transitions review` (below) to enumerate, but map onto **our** scale.

2. **Tooltip intent delay.** `.tip::after` (`supabase.css:523`) fades at `.12s` with no
   `transition-delay`, so dragging the cursor across the toolbar flashes three tooltips in a row.
   Wants ~80ms delay in, instant out.

3. **Open/close asymmetry.** A close should be quicker than its open. Today the toast is symmetric
   at `--motion-base` both directions, and `.dd-menu` has no close animation at all — it goes
   straight to `hidden`. Both are one-line fixes.

4. **Table row hover.** `.table tbody tr:hover td` (`supabase.css:403`) is an instant background
   swap. Wants `transition: background-color .1s`, plus a 2px `translateX` on the Open chevron —
   the pattern already exists at `supabase.css:846` for `.srow-chev`, so this is consistency, not
   invention.

5. **Live status dot pulse.** `.pill[data-status="Live"] .dot` (`supabase.css:369`) already carries
   a static ring. Animate its scale/opacity on a ~2s loop, `Live` only. It is the one thing on
   screen that genuinely is happening right now. Keep it CSS — a JS-driven infinite animation holds
   the main thread awake for the life of the tab.

### Tier 2 — worth doing, some effort

6. **Count-up on the headline figures** (`dashboard.js:212`, the Responses collected / Completion
   rate pair). Fire on range change only, never on a search keystroke. `.metric-value`
   (`supabase.css:951`) already sets `tabular-nums`, so no width jitter. This finishes P0-4: right
   now the chart animates and the number it belongs to hard-cuts. See `02-number-pop-in` in the
   skill — but cut its 500ms to ~250ms and drop the blur.

7. **Sliding tab indicator.** Insights (`insights.js`) and Settings (`settings.js`) both hard-swap
   a `border-bottom`. `16-tabs-sliding` in the skill has the correct wire-up including the part
   people get wrong: suspend the transition on first paint and on resize so the pill snaps into
   position instead of flying in from zero.

8. **Sparkline entrance on first paint.** Bars grow from baseline, ~20ms stagger, gated strictly to
   first paint. Keep total stagger under ~300ms.

9. **Clone flow.** `dashboard.js:558` already burns `setTimeout(…, 350)` of dead time before
   navigating. Fill it — a brand-tinted flash on the source row.

### Tier 3 — blocked or low value

10. **Row enter/exit on filter.** Blocked on the `innerHTML` constraint. Needs keyed reconciliation
    or a FLIP pass. `@formkit/auto-animate` looks tailor-made and will not work: it observes a
    parent's children, and replacing `innerHTML` destroys the `<tbody>` and the observer with it.
11. **Skeleton→content crossfade.** `14-skeleton-reveal` needs both layers in the DOM at once.
    Same wall. Current `lazy-in` fade-up is a reasonable substitute; the gain does not justify the
    refactor on its own.
12. **`.chart-tip`** (`supabase.css:998`) fades at `.1s`; a 2px rise would make it read as attached
    to its column.
13. **Rail collapse.** `.rail` width animates over `.18s` but `.rail-text { display: none }`
    (`supabase.css:550`) snaps, so labels pop while the panel glides. Fade + width, or decide the
    snap is deliberate.
14. **`a.metric:hover` (`supabase.css:942`) is dead code** — `metricCard` renders a `<div>`, so the
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
