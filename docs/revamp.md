# Revamp — handover

The console is being restyled from the Supabase-derived dark theme to the **Cloudflare
dashboard's**. This file is the pickup point: where the work stands, how to verify it,
what is left, and which decisions are already settled so they are not relitigated.

| | |
| --- | --- |
| Branch | `claude/insight-hub-cloudflare-revamp-xttm3r` |
| Previous branch | `claude/insight-hub-ui-guidelines-96lfr0` — [PR #26](https://github.com/suhascpaunikar/Insight-Hub/pull/26), still open. This branch was restarted from its head (`39d63f8`) and carries all six of its commits. |
| Base | `main` (`fec44d2`) |
| Status | The §6 open list below is closed. |
| CI | None runs on pull requests. `.github/workflows/pages.yml` deploys to GitHub Pages on push to `main` only, so the restyle goes live the moment this merges. |

> **Two PRs now describe overlapping work.** #26 has the first six commits; this branch
> has those plus the ones that close its open list. Merge one, not both — this branch is
> a superset of #26.

---

## 1. Read these first

| File | What it is |
| --- | --- |
| `docs/ui-guidelines-cloudflare-dark.md` | **The specification.** ~1250 lines. Colour, type, spacing, the shell, every component with its states, do/don'ts, page-by-page notes, and a migration map. §11 is Kumo; §12 is motion. |
| `assets/css/kumo-tokens.css` | **Generated — do not edit.** Kumo's own tokens, resolved out of the installed package by `scripts/kumo-tokens.mjs`: each var() chain followed, each oklch converted to sRGB, each `light-dark()` pair split into the two themes. Loaded **second** on all four pages. Rebuild it after upgrading `@cloudflare/kumo`. |
| `assets/css/tokens-cloudflare.css` | The translation table: InsightHub's token names onto Kumo's. Every colour is a `var()` into the generated file, so nothing here can drift from the package. What Kumo has no token for is listed by hand and says why. Loaded **third**; carries the motion scale, and the light-mode block is now only the handful of values Kumo does not name. |
| `assets/css/motion-kumo.css` | Kumo's keyframes, its utility classes under its own names, and the three places this product is allowed to overshoot. Loaded **fourth**, so its rules are out of reach of `supabase.css`'s reduced-motion block and are stilled again at its own foot. |
| `assets/css/supabase.css` | The primitives. Still named for the system it replaced; the *App shell* block is the new chrome. |
| `assets/js/chrome.js` | Owns the breadcrumb, the tab strip (including docking) and now the stat strip. Kept separate from `shell.js` so a page module can import it without pulling the assistant into an import cycle. |
| `assets/js/shell.js` | The rail, the bar, the footer, the switcher and quick-search popovers. |
| `DESIGN.md` | The **previous** system. Superseded for the console; kept as the record of what was replaced. |

---

## 2. Rules that override the defaults

- **`CLAUDE.md` at the repo root forbids watching.** Do not subscribe to PR activity, do
  not schedule check-ins, and do not offer to. Finish the work, report, stop. This is not
  a preference to weigh — it overrides the default Claude Code posture.
- **Develop on `claude/insight-hub-cloudflare-revamp-xttm3r`.** Do not push elsewhere
  without being asked. If its PR has merged by the time you read this, start the branch
  again from the new `main` rather than stacking on merged history.
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

### From the first pass (PR #26)

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

### This pass — the §6 list, closed

- **§6.1 The palette moved into JavaScript.** `RAMP` and `AI_ACCENT` in `core.js` were
  the last Supabase colours in the codebase and are now the Cloudflare ones. The
  three-declarations-of-one-idea problem is resolved in favour of **CSS**: `readPalette()`
  reads `--rating-1..5` and `--ai` off the root element at boot, and again on a theme
  change. CSS won the tie because the ramp became theme-dependent — five stops tuned for
  a near-black canvas are not the five that read on `#fbfbfb`, and a JS constant cannot
  express that.
- **§6.2 The charts point at the chart tokens.** All 17 sites. `--chart-0` neutral for a
  total, `--chart-1` blue for the series, the ramp for anything rating-coded, the status
  colours for anything status-coded. The Insights delivery column now reads
  neutral-total / blue-completed instead of one blue at two opacities, and no chart mark
  is the action blue any more — which is what stops a mark reading as clickable.
  Three non-chart sites moved for the same reason: the score-drag bar and the A/B lift
  and leading-variant figures are verdicts, so they are `--success`, and the builder's
  saved-state dot is a status, so it is too.
- **§6.3 The four compositions are built.** Stat strip (`setStrip()` in `chrome.js`),
  pagination (`pager()` / `pageSlice()` in `core.js`), drawer (`drawer()` in `core.js`,
  with the segment builder moved into it), docs chip (`docsChip()` in `settings.js`).
  `--strip-h` and `--destructive-icon` are wired; `--success-fg` gained three more uses.
- **Kumo's motion, adopted in full.** Including the overshoot the old rule 1 banned.
  Guideline §12 is rewritten. New file: `assets/css/motion-kumo.css`, loaded third.
- **Light mode**, from Appendix B, with the semantic colours, the rating ramp and the
  chart series re-derived for contrast on white. Dark stays the default.

## 6. Open

### 6.1 Decisions that are now closed

Do not reopen these without a reason; each was decided deliberately and the reasoning is
in the guideline.

- **Table zebra striping → flat.** Guideline §11.4a. Kumo stripes; the screenshots do
  not; and this product's tables already use row background to mean something (`data-flash`
  on a restored row, hover, the ramp on rating cells), so a stripe that means nothing
  would sit behind marks that do.
- **Light mode → built.** Appendix B. Dark remains the default.
- **Overshoot → allowed, at a completion only.** Guideline §12.2 rule 1. Three moments:
  a wizard step completing, a toast arriving or re-firing, a rating landing. A spring on
  a status pill is still forbidden.
- **The ramp's owner → CSS.** §6.1 above.

### 6.1a The motion pass (Sep 2026)

A second pass added Kumo's motion everywhere the product had none. What went in:

- **The four state changes that had no acknowledgement** — the settings save footer (the
  item `docs/motion-handover.md` ranked first, which had survived two passes), the
  departing row on a delete, the page turn, and the stat strip's arrival. A fifth, the
  Insights chart readout parity, turned out to have been built already by `fec44d2`; the
  backlog entry was stale.
- **Kumo's scroll fade** on the table, which overflows below about 1250px. Its exact
  implementation: a mask on a `scroll(self x)` timeline, behind `@supports`, with
  `observeOverflow()` in `core.js` setting the attribute CSS cannot compute.
- **The toolbar refresh button** (§9.1, never built) and Kumo's `refresh` spinner on it.
- **The anchored Copied chip** (§6.23), which is what Kumo's `clipboard-toast-bump` is
  for. It replaced a corner toast on the builder's copy-trigger — a value landing in the
  fields beside you should not be reported in the far corner.
- **The rejected set, reopened**: card entrance staggers, hover lift, empty-state
  entrances. Guideline §12.2 rule 7 replaces the ban with an ordering.

`float` and the marquee stayed out: both loop with nothing happening, which rule 2 still
forbids, and neither has a host that would make it mean anything.

### 6.2 Still open, in the order worth doing

1. **The `--code-*` tokens are still unused.** `--code-bg`, `--code-field-bg` and
   `--code-accent` go with §6.21's code block, and there is nowhere in the product that
   genuinely wants one yet. They were deliberately *not* consumed by inventing a code
   surface — this repo's own standard is that decoration is not a reason to build. The
   honest candidates, when one is wanted: the export dialog showing the CSV header, or a
   webhook payload in Settings.
2. **The stat strip wraps at 1440px with the sidebar expanded.** §6.8 asks for an 80px
   gap; §9.2 puts four action buttons at the right end of the same band; at 1352px the
   two do not both fit. The gap is 48px and long values truncate, which fits the row with
   the rail collapsed but not expanded, where the band grows to two rows. If one row at
   every width is wanted, the move is to collapse Stop and Edit into a `⋯` menu — that is
   a spec change, so it is a question rather than a fix.
3. **The response detail is still a `.dialog-lg`.** Left deliberately: §6.16 scopes the
   drawer to *editing* a rule, a segment or an alert, and the response detail is
   read-only. Worth revisiting only if the drawer becomes the house style for any large
   panel.
4. **Filter chips on Insights.** Unchanged from the last handover, and still a data
   problem before it is a UI one: five `<select>`s of which only `range` changes anything.
   The honest fix is fewer controls.
5. ~~**The chart readout is painted over by a `.metric-head`.**~~ **Retracted — there is
   no such bug.** It was `document.elementFromPoint()` returning what sits beneath the
   readout, because `.chart-tip` carries `pointer-events: none` so the pointer can keep
   tracking the columns under it. Hit-testing is not paint order. The readout paints
   correctly over its own card, never escapes it at any column of any card, and overlaps
   no neighbouring or later card. `docs/motion-handover.md` carries the full retraction.

### 6.3 Deliberately left alone

- **The `motion` library is installed and still not wired.** §12.4 lists the four cases
  where it would beat CSS; none has come up, and adopting Kumo's motion did not create
  one — `--ease-bounce` covers overshoot in CSS. If one does arrive, vendor the built ESM
  into `assets/vendor/` rather than adding an import map, so "clone it and open
  `index.html`" stays true.
- **Adopting Kumo's components for real** means React, a bundler and Tailwind v4. §11.5
  sets out the two honest positions. The one thing that must not happen is a third, where
  some screens use Kumo and others mirror it — the mirror is only defensible while it is
  complete.


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
- **`localStorage` persists across runs**, including the rail-collapsed, builder-chrome
  and now **theme** preferences. Fresh context per verification run — a run that ends in
  light mode will otherwise make the next one disagree with the screenshots.

### Added by the motion pass

- **A backtick in a comment closes the `html` template it sits inside.** Writing
  ``Kumo's `refresh` keyframe`` inside an HTML comment in a tagged template ended the
  literal, and the file still *parsed* — so `node --check` passed and the page died at
  runtime with "Unexpected identifier". **`node --check` is not enough; load the page.**
- **`elementFromPoint` is not paint order.** It skips anything with
  `pointer-events: none`, so it returns whatever is *beneath* such an element. Used to
  check whether the chart readout was on top, it reported a z-order bug that does not
  exist — and that false finding was written into two documents and a CSS comment before
  a screenshot of the same pixels contradicted it. **To answer "is this on top", look at
  the pixels; to answer "what will the click hit", use `elementFromPoint`.**
- **A screenshot is not evidence and neither is a reading of the block.** Two animations
  looked stilled under reduced motion and were not: the card stagger reuses the `lazy-in`
  keyframe through a different selector, and the hover lift is a transition rather than an
  animation. Both were caught by reading `getComputedStyle` in an emulated reduced-motion
  context, not by reading the CSS.
- **Check the change actually happens before animating it.** The page turn was animated
  against a page size of ten and a seeded list of seven — a second page that did not
  exist. The page size moved to five. This is the same trap `motion-handover.md` records
  at the top of its list, walked into again.
- **Playwright's `reducedMotion` is a context option, not a method.**
  `browser.newContext({ reducedMotion: 'reduce' })`; there is no `ctx.emulateMedia`.
- **`python3 -m http.server` started from a tool call dies with it.** Two verification
  runs measured an empty page and a 404 before this was noticed. `setsid nohup … &` and
  check the status code before trusting a run.

### Added this pass

- **A Playwright screenshot is not evidence of a colour.** Verifying light mode, the
  rendered PNG appeared to show a dark sidebar over light content; `getComputedStyle`
  said `rgb(251,251,251)`. Decoding the PNG and sampling the pixel agreed with the
  computed style — the image was fine and the reading of it was not. **Sample the pixel
  or read the computed value; do not settle a colour question by looking at a
  screenshot.**
- **The lazy sections wait 1000–1500ms** (`LAZY_MIN`/`LAZY_MAX` in `core.js`). A
  verification run that waits 1200ms catches some sections mid-skeleton and screenshots
  a page of grey blocks. Wait 2400ms.
- **The webfont CDN is unreachable from the sandbox.** Abort the request in Playwright
  and the abort logs its own console error, which then masks real ones. Fulfil it with
  an empty 200 instead.
- **A control moved out of `#content` loses the page's delegated handlers.** The stat
  strip is a sibling of `#content`, so the four campaign actions it carries had to stop
  being closures inside `wire()` and become module-level functions the strip calls by
  key. The same trap caught the docs chip: `foot-stub` was delegated on `#app`, and a
  drawer mounts on `document.body`, so that listener moved to the document.
- **A delegated handler that reads `textContent` breaks on an icon-only control.** The
  docs chip has no text, so the stub toast read " is not part of the prototype". It reads
  `aria-label` first now.
- **Custom properties resolve per-element, so the Kumo aliases needed no theme work.**
  `--color-kumo-canvas: var(--background-200)` is declared on `:root`, and
  `:root[data-theme="light"]` also matches the root element, so the alias picks up the
  light value with nothing added. Verified rather than assumed.

---

## 8. Conventions

- Commit messages: what changed and why, in prose. Attribution footer as configured for
  the session.
- Push with `git push -u origin <branch>`; retry network failures with backoff.
- Do not open a second PR for this branch — #26 exists. Update it instead.
