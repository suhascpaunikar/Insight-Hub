# Revamp — handover

The console is being restyled from the Supabase-derived dark theme to the **Cloudflare
dashboard's**. This file is the pickup point: where the work stands, how to verify it,
what is left, and which decisions are already settled so they are not relitigated.

| | |
| --- | --- |
| Branch | `claude/insight-hub-ui-guidelines-96lfr0` |
| Pull request | [#26 — Restyle the console to the Cloudflare dashboard's dark system](https://github.com/suhascpaunikar/Insight-Hub/pull/26) |
| Base | `main` (`fec44d2`) |
| Head at handover | `9e355e7`, five commits, 20 files, +3233 / −407 |
| Status | Open, mergeable |
| CI | None runs on pull requests. `.github/workflows/pages.yml` deploys to GitHub Pages on push to `main` only, so the restyle goes live the moment #26 merges. |

---

## 1. Read these first

| File | What it is |
| --- | --- |
| `docs/ui-guidelines-cloudflare-dark.md` | **The specification.** ~1250 lines. Colour, type, spacing, the shell, every component with its states, do/don'ts, page-by-page notes, and a migration map. §11 is Kumo; §12 is motion. |
| `assets/css/tokens-cloudflare.css` | Every token, on Kumo's values, aliased to Kumo's own names at the foot. Loaded **after** `supabase.css` on all four pages. |
| `assets/css/supabase.css` | The primitives. Still named for the system it replaced; the *App shell* block is the new chrome. |
| `assets/js/chrome.js` | New. Owns the breadcrumb and the tab strip, including docking. Kept separate from `shell.js` so a page module can import it without pulling the assistant into an import cycle. |
| `assets/js/shell.js` | The rail, the bar, the footer, the switcher and quick-search popovers. |
| `DESIGN.md` | The **previous** system. Superseded for the console; kept as the record of what was replaced. |

---

## 2. Rules that override the defaults

- **`CLAUDE.md` at the repo root forbids watching.** Do not subscribe to PR activity, do
  not schedule check-ins, and do not offer to. Finish the work, report, stop. This is not
  a preference to weigh — it overrides the default Claude Code posture.
- **Develop on `claude/insight-hub-ui-guidelines-96lfr0`.** Do not push elsewhere without
  being asked. If PR #26 has merged by the time you read this, start the branch again
  from the new `main` rather than stacking on merged history.
- **Do not commit the reference screenshots.** They show a real Cloudflare account —
  account id, email, billing address, card. The guideline refers to them by capture time
  instead. They arrived as a zip and are not in the repo.
- **`node_modules` is gitignored.** `package.json` and `pnpm-lock.yaml` are committed.

---

## 3. Running and verifying

There is still **no build step and no runtime dependency**. The dependencies exist to be
consulted, not loaded.

```bash
pnpm install                       # only needed to consult Kumo
python3 -m http.server 8000        # or: pnpm start
# then open http://localhost:8000
```

A static server is required — the pages are ES modules, which browsers block on `file:`.

Every visual claim in the PR was checked by driving Chromium. Playwright is preinstalled;
the browser is at `PLAYWRIGHT_BROWSERS_PATH` and must not be re-downloaded:

```bash
NODE_PATH=/opt/node22/lib/node_modules node your-script.js
```

Use a **fresh browser context per run**. State persists in `localStorage`
(`insighthub.prototype.v1`), so a stale rail-collapsed or builder-chrome value will
otherwise make a run disagree with the last one. Always assert on the DOM as well as
screenshotting — several bugs here were invisible in a screenshot and obvious in a
`querySelector` count.

### Resolving a Kumo token

Kumo's tokens are authored in oklch behind `light-dark()`, so they cannot be read off the
file. Load its theme in a browser, set dark mode, and paint each property to a canvas —
`getComputedStyle` returns `oklch(...)` verbatim in Chromium and will mislead you:

```js
probe.style.color = `var(${name})`;
ctx.fillStyle = getComputedStyle(probe).color;
ctx.globalCompositeOperation = 'copy';
ctx.fillRect(0, 0, 1, 1);
const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;   // true sRGB
```

The theme file is `node_modules/@cloudflare/kumo/dist/styles/theme-kumo.css`. Component
specs come from the CLI rather than the source:

```bash
npx @cloudflare/kumo ls            # 48 components by category
npx @cloudflare/kumo doc Button    # props, sizes, variants, Tailwind classes
```

---

## 4. How a value is decided

Two sources, and a precedence rule that has already settled several arguments:

1. **Kumo wins on values.** It is Cloudflare's own component library, so it is the source
   the screenshots were a proxy for. Hex, control height, radius, spacing: take Kumo's.
2. **The screenshots win on compositions.** Where the dashboard plainly shows a layout
   Kumo does not describe — the stat strip, the chart series palette, the form-field
   border, flat table rows where Kumo's `Table` stripes — the screenshots are the target
   and Kumo is silent or divergent.

§11.1 lists what matched (canvas, card, line, hairline, both text greys, success, and the
whole type scale — exactly), §11.2 every value Kumo corrected. Do not re-measure from the
screenshots; that pass is done and its results are recorded.

---

## 5. Done

- **Tokens** on Kumo's values, with Kumo aliases.
- **Shell**: 56px icon rail expanding to a 260px sidebar; workspace and app switcher
  behind the logo cell; quick search on `⌘K`; 58px breadcrumb bar; tab strip that docks
  into the bar on scroll; site footer; the four content widths.
- **Primitives**: type, buttons, forms, controls, cards, badges, status pills, notices,
  tables, tabs, menus, dialogs, toasts, tooltips, empty states, stat and metric cards,
  settings panels, the stepper, the assistant card.
- **Pages**: Campaigns has the documentation/primary header pair and a table that fits;
  Insights drops the title the breadcrumb carries; Settings sits in the 954px column.
- **Builder, both chromes.** Step strip by default, boxed stepper kept.
  **Settings → Prototype state → Builder chrome** switches them; the choice persists in
  `store.state.builderChrome`. Both read one step model (`stepModel()` in `builder.js`).

---

## 6. Open — in the order worth doing

### 6.1 Finish the palette move into JavaScript

The highest-value loose end, because it is the one place the code still carries the old
system's colours.

- `assets/js/core.js` line ~620: `RAMP` is still `['#e5484d', '#f76b15', '#ffb224',
  '#7cc47f', '#3ecf8e']` — the **old** ramp, topped with the Supabase emerald. The new
  ramp is `#ff6467 · #ff8904 · #ffac00 · #7cc47f · #00d492`.
- `assets/js/core.js` line ~622: `AI_ACCENT` is still `#a78bfa`; the new accent is
  `#7367e5`.
- The `--rating-1..5` custom properties are **declared in both stylesheets and read by
  neither** — `ratingColor()` and `ratingLegend()` interpolate the JS array directly. So
  the ramp on screen is still the old one and there is no visible inconsistency, only
  three declarations of one idea. Decide the owner: either have the JS read the computed
  custom properties once at startup, or delete the CSS tokens and keep the JS array as
  the single source. Do not leave both.

### 6.2 Point the charts at the chart tokens

`insights.js` (14 sites) and `dashboard.js` (3) draw series with `var(--brand-default)`,
so every chart is currently the action blue. `--chart-0..3` exist for exactly this and are
unused. Per §6.19 the series are `#4390f0` blue, `#f0b620` amber, `#e7639d` pink and
`#848589` neutral for totals; anything rating-coded uses the ramp, anything status-coded
the status colours. This is also what stops a chart mark from reading as something
clickable.

### 6.3 Build the compositions that are specified but not built

- **Stat strip** (§6.8) — the 76px band of label/value columns under the tab strip on
  detail pages. `--strip-h` is declared and unused. Insights currently opens on a header
  row instead; §9.2 wants the strip.
- **Pagination** (§6.12) — the five-cell button group. The campaign list uses a count in
  the card foot instead.
- **Drawer** (§6.16) — 400px from the right, for editing a rule, a segment or an alert.
  Nothing opens one yet; the app uses `.dialog-lg` for those.
- **Docs chip** (§6.7) — the purple pill beside a settings section title.
- Unused tokens that go with the above: `--code-bg`, `--code-field-bg`, `--code-accent`,
  `--destructive-icon`, `--success-fg`.

### 6.4 Decisions deliberately left open

- **Table zebra striping.** Kumo's `Table` stripes even rows with `elevated`; the
  screenshots show flat rows and the flat rows shipped. Documented in §11.4. Pick one
  deliberately if it comes up.
- **Light mode.** Values are recorded in Appendix B, nothing is implemented. The token
  file is dark-only on purpose — this console has one theme.
- **The `motion` library is installed and not wired**, deliberately. §12.3 lists the four
  cases where it would beat CSS: DOM-position changes, springs, scroll-linked progress,
  sequenced timelines. None has come up. If one does, vendor the built ESM into
  `assets/vendor/` rather than adding an import map, so "clone it and open `index.html`"
  stays true.
- **Adopting Kumo's components for real** means React, a bundler and Tailwind v4. §11.5
  sets out the two honest positions. The one thing that must not happen is a third, where
  some screens use Kumo and others mirror it — the mirror is only defensible while it is
  complete.

---

## 7. Gotchas that cost time here

- **`getComputedStyle().color` returns `oklch(...)` verbatim** in Chromium for
  wide-gamut colours. Parsing it as three numbers yields nonsense like `#010000`. Paint
  to a canvas (§3).
- **The wizard and the console both repaint by replacing everything under `#app`.**
  Anything captured in a closure — a node, a measurement — is detached by the next paint,
  and a detached element measures zero. That is what made the tab group vanish: a stale
  strip measured 0 high, read as "scrolled past", and the live group was moved into a
  detached dock slot. `wireDock()` now re-resolves every node per update. Apply the same
  suspicion to anything new that caches DOM.
- **`wireOnce` marks the node, and `#app` survives repaints**, so a handler registered
  through it runs once for the life of the document. That is why `advance()` is reached
  from the tab strip through a module-level `gotoStep` hook rather than a closure.
- **Name collisions in `builder.js`.** There is already a `stepStates` Map used by the
  step animations; the shared step model had to be `stepModel`. Grep before naming.
- **Splicing definitions in front of `export function foo()`** by string index will land
  between `export` and `function` and silently move the export onto your new function.
  Check `node --check` *and* that the expected exports still exist.
- **`localStorage` persists across runs**, including the rail-collapsed and builder-chrome
  preferences. Fresh context per verification run.

---

## 8. Conventions

- Commit messages: what changed and why, in prose. Attribution footer as configured for
  the session.
- Push with `git push -u origin <branch>`; retry network failures with backoff.
- Do not open a second PR for this branch — #26 exists. Update it instead.
