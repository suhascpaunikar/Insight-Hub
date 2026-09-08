# Motion handover

State of the dashboard motion work after the Tier 1 and Tier 2 backlog was cleared. Written so
the next person can pick up mid-stream without re-deriving the analysis.

The house rules live in **DESIGN.md → Motion**. That section is the authority; this file is the
backlog.

---

## What shipped

### First pass — `claude/dashboard-microanimations-priority-m9nnpf` ([PR #16](https://github.com/suhascpaunikar/Insight-Hub/pull/16))

| | Change | Where |
| --- | --- | --- |
| Tokens | `--motion-fast/base/slow`, `--ease-out` | `supabase.css`, documented in `DESIGN.md` |
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

### Second pass — Tier 1 and Tier 2

| | Change | Where |
| --- | --- | --- |
| T1-1 | 54 hardcoded durations and easings converted to tokens | throughout `supabase.css` |
| T1-1 | `--motion-quick`, `--motion-delay-intent` added to the scale | `supabase.css`, `DESIGN.md` |
| T1-2 | Tooltip intent delay, hover only | `.tip:hover::after` |
| T1-3 | Toast exits one rung below its entrance | `.toast[data-leaving]` |
| T1-3 | Dropdown close animation, `hidden` deferred to its end | `dd-out`, `closeMenu()` in `core.js` |
| T1-4 | Table row hover transition + `.row-chev` lean | `.table td`, `dashboard.js` |
| T1-5 | Live status dot pulse, CSS-only 2s loop | `.pill[data-status="Live"] .dot::after` |
| T2-6 | Headline figures count on range change | `countFigures()` in `dashboard.js` |
| T2-7 | Sliding tab indicator | `tabInk()` in `core.js`, `insights.js`, `settings.js` |
| T2-8 | Column entrance on the paint that replaces a skeleton | `growPlots()` in `core.js` |
| T2-9 | Clone flashes its source row | `row-flash`, `dashboard.js` clone handler |

Five things in that list are worth knowing the reasoning behind.

**The scale gained two tokens, not one.** `--motion-quick: 90ms` exists because the asymmetry rule
(an exit runs one rung below its entrance) has nowhere to go for something that already opens at
`--motion-fast` — which the dropdown does. It is an exit duration only; nothing enters at it.
`--motion-delay-intent: 80ms` is a delay, not a duration, and is on the scale so the next surface
that needs an intent gate does not invent its own number.

**Tokenisation left four durations alone**, each paired with a JS constant rather than chosen for
feel: the assistant's word reveal against `WORD_MS`, its beam against `BEAM_FADE_MS`, the pointer
ring against `DWELL_MS`, and the orb halo against the orb's own settle. Loop periods (the shimmer,
the Live pulse, the caret, the beam spin) are not on the scale either and never were — the scale
measures how long the product takes to answer you, and a loop is not answering anything. Three
curves are likewise not `--ease-out` (the sweep is `ease-in-out`, the caret is `steps()`, the dwell
ring is `linear`), each because the curve is carrying meaning rather than feel. Every exception
carries a comment saying so, and `DESIGN.md → Motion` lists them. A sweep over all four
screens now finds no computed duration outside the scale and that exception list (see the
verification recipe below).

**The dropdown close had to defer `hidden`.** `hidden` takes the menu out of the box tree on the
frame it is set, so there is nothing left to animate. `closeMenu()` sets `data-closing` instead,
and `hidden` lands on `animationend` — or on a timer, which is what actually guarantees it, since
neither end event fires in a background tab. Re-opening mid-close clears the flag, and every
queued `finish` re-checks it before hiding anything: several closes can be in flight against one
menu and only the current one may act. "Open" is now the pair `!hidden && !closing`, or a click
landing inside the exit would close a menu that is already closing.

**The tab indicator works around the `innerHTML` constraint rather than fixing it.** The strip is
destroyed on every click, so there is no previous state for a transition to run from. The position
is remembered in a module `Map`: the bar is re-created where the last strip left it, that placement
is flushed with a forced layout read, and only then is it moved. What animates is the second
placement, on a node that has already stood at the first. The per-tab `border-bottom` is only stood
down once `tabInk()` has actually appended the bar (`data-ink-on`), so a strip the script never
reaches degrades to what it had before instead of losing its selection entirely.

**The count-up runs at `--motion-slow`, not the ~250ms this backlog originally called for.** The
figures are the sum of the columns beside them, and the columns run at `--motion-slow`; at 250ms
the number would settle while its own chart was still growing. Matching the chart is the point of
the item — P0-4 left the plot animating and the figure hard-cutting — so the chart is what it is
matched to.

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
- **`entering` is the first-paint gate.** `lazySection` tells `paint` whether it followed a wait,
  and that flag is now what `growPlots()` keys on as well as `lazy-in`. It is the only honest
  signal for "this section just arrived" — everything else on the dashboard, a sort, a column
  toggle and every search keystroke, comes through the same render path.

---

## The constraint that shapes everything left

Every screen repaints by replacing `innerHTML` — **14 sites across 8 files**
(`assistant.js`, `builder.js`, `content-step.js`, `core.js`, `dashboard.js`, `insights.js`,
`settings.js`, `shell.js`). Two consequences that keep recurring:

1. **Entrance animations re-fire on every keystroke** unless gated. Search input calls the same
   render path as a tab switch. This is why `lazySection` keys on section identity rather than
   firing per render, and why `growPlots()` and `countFigures()` are both called from the one
   branch that knows a render was not a keystroke.
2. **`transition:` never runs on re-created nodes.** There is no previous state to animate from.
   `.chart-seg { transition: height }` (`supabase.css`) is dead code on the dashboard for
   exactly this reason — left in place because it is live on the insights charts.

The tab indicator is the first thing here to get around (2) rather than accept it, and the price is
worth naming: it works because the bar's position is held in JS across the teardown and replayed on
the new node. That is a per-surface workaround, not a fix. Anything that needs old and new *content*
on screen at once — row enter/exit, a true skeleton→content crossfade — still needs the render path
to do keyed reconciliation or FLIP. **That remains the single highest-leverage refactor available**,
and no animation library removes the need for it.

---

## Remaining work

Everything left is Tier 3 from the previous handover: blocked on the constraint above, or judged
not worth its cost. Numbering kept from that list so old references still resolve.

10. **Row enter/exit on filter.** Blocked on the `innerHTML` constraint. Needs keyed reconciliation
    or a FLIP pass. `@formkit/auto-animate` looks tailor-made and will not work: it observes a
    parent's children, and replacing `innerHTML` destroys the `<tbody>` and the observer with it.
11. **Skeleton→content crossfade.** `14-skeleton-reveal` needs both layers in the DOM at once.
    Same wall. Current `lazy-in` fade-up is a reasonable substitute; the gain does not justify the
    refactor on its own.
12. **`.chart-tip`** fades at `--motion-fast`; a 2px rise would make it read as attached to its
    column. Cheap, and the only reason it is still here is that the tooltip is positioned in JS
    against the hovered column, so the rise has to compose with a transform that is already being
    written every frame.
13. **Rail collapse.** `.rail` width animates over `--motion-base` but `.rail-text { display: none }`
    snaps, so labels pop while the panel glides. Fade + width, or decide the snap is deliberate.
14. **`a.metric:hover` is dead code** — `metricCard` renders a `<div>`, so the rule never matches.
    Either make the cards interactive or delete it. Do not build hover motion on top of it.

Two things worth watching that are not backlog items:

- **`--col-step` is set inline by `growPlots()`** and defaults to 8ms in CSS. If a third caller
  ever wants a different stagger, give it a named value rather than a second inline write — three
  numbers for one idea is how the last round of drift started.
- **`inkAt` is keyed on `data-ink`.** Two strips sharing a key would inherit each other's position
  and slide across the screen on load. Give every new strip its own key.

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
map the findings onto our scale. Three of its patterns were used this round and all three were
re-tuned on the way in: `02-number-pop-in` lost its blur and was re-timed to the chart it belongs
to, `16-tabs-sliding` kept its suspend-on-first-paint-and-resize wire-up and nothing else, and its
intent-delay guidance became `--motion-delay-intent` at 80ms rather than their figure.

Skip for this product: card tilt, like button, success check, matrix loader, spinning counter,
avatar hover, plus-menu morph. Consumer motion — in an admin console it reads as unserious.

**Licensing:** the repo has **no LICENSE file**, so formally all rights reserved. The intent is
plainly "copy this" (copy buttons, a CLI, an installable skill), and CSS timing values are largely
uncopyrightable, but for anything client-facing prefer using it as reference for *values* over
pasting blocks verbatim. Nothing from it has been pasted verbatim.

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
   skeleton has already finished, and you will conclude the skeleton never rendered. The flip side:
   `commit` resolves *before* the modules have run, so wait on a selector (`.page`, `.skel`) before
   asserting anything, or you will count zero of everything.

To measure a skeleton against real content, capture `getBoundingClientRect().height` for both states
and diff them — that is how the current blocks were tuned to ~1px.

Worth checking on any motion change: reduced-motion (`newContext({ reducedMotion: 'reduce' })`),
that typing in search does not re-trigger a load or a count-up, and that all four pages stay free
of console errors. **Use a fresh context per page** — the lazy cache is per browser-tab session, so
a second page in the same context skips its skeletons.

**The scale sweep** is the cheapest guard against the drift that produced T1-1, and worth re-running
after any stylesheet change. Walk every element on each of the four screens, read
`getComputedStyle(node).transitionDuration` and `.animationDuration`, and assert that every value is
either a token or one of the documented exceptions:

```js
const allowed = new Set([
  '0s', '0.09s', '0.12s', '0.18s', '0.32s',          // the scale
  '0.26s', '0.4s', '0.5s', '0.6s',                    // paired with JS constants
  '1s', '1.4s', '2s', '3.4s', '12s',                  // loop periods
]);
```

Anything outside that set is either a new token that belongs in `DESIGN.md` or a value that should
have been one.

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
- **`REDUCED` lives in `core.js` and is read live.** One `matchMedia` object for the whole app,
  queried at call time rather than captured, so a reader who turns the preference on mid-session is
  taken at their word without reloading. Do not re-declare it per module.
- **The Live pulse is the only loop outside a pending state**, and it is not an exception to the
  rule — a Live campaign is enrolling people right now. Do not extend it to Paused or Scheduled;
  the rule is what makes a moving pixel mean something.
