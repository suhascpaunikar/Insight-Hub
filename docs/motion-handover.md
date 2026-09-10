# Motion handover

Everything animated in InsightHub: what moves, why it moves that way, what is deliberately still,
and what is left. Written to be read cold.

**`DESIGN.md` → Motion is the authority on the rules.** This file is the inventory and the backlog.

---

## Read this first

Every screen repaints by replacing `innerHTML` — **14 sites across 8 files** (`assistant.js`,
`builder.js`, `content-step.js`, `core.js`, `dashboard.js`, `insights.js`, `settings.js`,
`shell.js`). Almost every non-obvious decision below traces back to it:

1. **`transition:` cannot fire on a re-created node.** There is no previous value to move from. Any
   rule written as a transition on something that gets repainted is dead code that *looks* correct.
   This has bitten three separate components so far — the sparklines, the rail, and the stepper —
   and in each case the symptom looked like a styling bug rather than an architectural one.
2. **Entrance animations re-fire on every keystroke** unless gated, because a search keystroke and
   a tab switch call the same render path.

Two ways around it are already in the codebase, and new work should reuse them rather than
reinventing:

- **Replay** — remember the previous state, apply it to the new node, force a reflow, then flip to
  the new one so the transition has somewhere to travel from. Used by `wireTabPill()`.
- **Animate, don't transition** — a CSS `animation` runs on a fresh node. Mark only the elements
  that actually changed and let the stylesheet animate them. Used by `markChangedSteps()` and
  `growPlots()`.

**The real fix is keyed reconciliation or FLIP in the render path.** It is the single
highest-leverage refactor available here, it is what the last two backlog items are blocked on, and
no animation library removes the need for it.

---

## What is live

> **Rebased on Kumo.** The scale below is no longer the one this file was written against:
> `--motion-fast` is 100ms, `--motion-base` 200ms, `--motion-slow` 300ms, and `--ease-out` is
> Kumo's `cubic-bezier(0, 0, .2, 1)`. Two overshoot curves exist now — see the guideline §12,
> which supersedes the rules at the foot of this file wherever the two disagree. New motion lives
> in `assets/css/motion-kumo.css`, which loads third and carries its own reduced-motion block.

32 keyframes and 57 transition declarations, carrying 100 references to the three motion tokens.
Every duration outside the assistant is a token; the two that are not are the 8ms stagger the
distribution bars count on, and the 1.5s the collapsed rail's tooltip waits, both of which are
gaps between things rather than the length of anything. The sparkline columns used to be a third,
and are now `--motion-base` divided across however many columns there are — see *Range switch*. Six of the assistant's
durations are deliberately hardcoded (see *Rules*).

### Shell — every page

| What | Trigger | Mechanism |
| --- | --- | --- |
| Page to page | any in-app link or `navigate()` | outgoing `body[data-leaving]` fades over 120ms and holds the jump; arriving `.app` runs `page-in` |
| Rail collapse | the toggle | width + label fade + items closing to a 30px square; `applyRailState()` in `shell.js` patches state **in place** rather than rebuilding |
| Rail tooltip | hover / focus on a **collapsed** item | 1.5s intent gate, instant out; a body-level node positioned in JS by `wireRailTips()` |
| Dropdown open / close | menu trigger | `dd-in` 180ms / `dd-out` 120ms; `closeMenu()` defers `hidden` so the exit can run |
| Dialog + scrim | any dialog | `pop` / `fade` |
| Toast | `toast()` | `slidein` in, 120ms out, and the stack collapses via a negative `margin-bottom` |
| Tooltip | hover | 80ms intent delay in, instant out |

The rail's tooltip is the one that is **not** the `.tip` pseudo-element, and it cannot be: the
rail clips its own overflow — that is what hides the labels while it narrows — and the nav list
scrolls inside it, so anything drawn on the item is cut off at the strip's edge. It is drawn
against the rail's right edge rather than the item's, because a 30px square sits 15px inside a
60px strip. The native `title` it replaced was unstyled, opened on the browser's schedule and
could not be positioned.

### Campaigns

| What | Trigger | Mechanism |
| --- | --- | --- |
| Skeleton → content | first visit per session | `lazySection()` + `.skel`, then `lazy-in` |
| Sparkline entrance | content arriving | `growPlots()` sets `data-swap="in"` |
| Range switch | range dropdown | `swapCharts()` — plot crossfades out, new series grows back, the wipe spanning `--motion-base` whatever the column count |
| Headline figures | range switch only | `countUp()` — never on a keystroke |
| Card readout | hover on a metric plot | the column holds its ink, its neighbours drop to .38, and a `.chart-tip` opens against the cursor; `wireMetricCharts()` |
| Row menu | the ⋯ on any row | `dd-in` / `dd-out`, flipped above the trigger where the row is near the fold |
| Delete → undo | the row menu | `leaveRow()` fades and collapses the row *before* the repaint, toast carries the way back for 8s, restored row takes `row-flash` |
| Page turn | the pager | `page-rows` / `page-rows-back` — the rows enter from the side the reader travelled; `pageDir` is set by the press and consumed by the paint |
| Refresh | the toolbar's refresh button | `forgetSection('campaigns')`, then Kumo's `refresh` spins on the button — which stays real while the rest of the toolbar goes to skeleton |
| Card entrance stagger | content arriving | `staggerCards()` sets `--i`/`--n`; the four cards cross one `--motion-base` |
| Card hover lift | hover on a stat card | 1px `translateY` + brighter edge, with a `z-index` against the stacking context a transform makes |
| Empty state | the first paint that has one | `lazy-in`, gated on the previous paint not having had one |
| Table edge fade | the table overflowing its scroller | Kumo's `[data-overflowing]` mask on a `scroll(self x)` timeline — see the guideline §12.3a |
| Live status pulse | always, `Live` only | `pill-pulse`, a pseudo-element ring on transform/opacity |
| Row hover | hover | background + 2px chevron lean |
| Clone | confirm | `row-flash` on the source row |

### Insights

Skeleton on the panel only — the header, filters and tab strip stay live, with the clicked tab
already selected. Sliding tab marker via `wireTabPill()`. Chart tooltip rises 2px into place.

The panel draws its marks in the way the campaign list does: `growPlots()` on the delivery
columns, `growBars()` on every distribution bar across all four tabs. Both are **asked for**, not
wired to the render path — the Responses tab repaints on every character typed into its search,
and an entrance on that path would leave sixty bars redrawing under the cursor. The `drawIn` flag
in `insights.js` is set by content arriving, a tab, a filter and a band filter; by nothing else.

**A filter now swaps; a tab does not.** `redraw()` fades the marks out via `swapOut()` before the
repaint, so re-slicing a panel reads the way re-slicing the campaign list does — same chart, same
question, different slice. `drawNext()` is the tab's path and skips the fade, for two reasons: the
marks that leave a tab are not the marks that come back, so there is nothing being re-measured;
and the sliding marker under the tab strip is painted by the repaint, so holding the repaint for
120ms would leave the marker under the tab you just left.

**The figures count.** `figureValue()` tags each `.figure-value` with a stable key and its numeric
value; `redraw()` and `drawNext()` capture the old values, and the paint tweens to the new ones
beside `growPlots()`/`growBars()`. This is the backlog item that used to sit at #2.

Making it fire required fixing the thing under it: the **Date range filter did nothing**. FR-92 put
the control on every tab and the delivery series ignored it, so the only way to notice was to count
the columns before and after. `sliceRange()` now cuts the series by elapsed time rather than by a
point count (the two series run at three days and eight hours a point, so one count would mean two
different windows under one label), and `windowShare` reads the funnel and the failure reasons at
the same share of the run. One linear factor, so every relationship the seed was built to preserve
survives it — and every figure on the tab now has something to count to.

### Builder

No skeleton anywhere, by decision — a wizard step is a form being filled, not data arriving.

| What | Trigger | Mechanism |
| --- | --- | --- |
| Step travel | `advance()` only | `step-fwd` / `step-back` in, `step-exit-fwd` / `step-exit-back` out; **not** wired to `renderBuilder()`, which also runs on saves and field edits |
| Step arriving | state → `current` | marker wipes (`step-mark`), badge settles (`step-settle`) |
| Step finishing | state → `complete` | badge pops (`step-done`), check draws (`step-check`) |
| Reachability | `ready` ↔ `locked` | `step-unlock` / `step-lock` |
| Blocked advance | `advance()` refusing to move | `notice-shake`, two returns; fires on the press via `ui.shake`, not on the notice's presence |
| Rating press | the preview's rating buttons | `:active` scale to .9, and `rate-mark` on the button that comes back selected |

The wizard is **four steps**, not six — see `STEPS` in `builder.js`. Nothing about the motion
changed with the merge; there are simply two fewer step travels in a walk through it.

`markChangedSteps()` marks only steps whose state actually changed. A first paint marks nothing —
the stepper arrives with the page rather than changing.

`exitStep()` is the one place in the app that gets around the innerHTML problem by **moving the
real node out of the tree** instead of replaying or re-animating. Called before the repaint — the
last moment the outgoing step exists — it lifts the `.page` into a fixed box cut to the
scroller's rect, offset by the scroll position it had, so the step travels out clipped to exactly
the area it occupied rather than over the header and footer. Moved rather than cloned, because
`cloneNode` copies the `value` *attribute* and not the live one: a copy of a filled-in form
flashes empty. The box is opaque on `--background-200`; two steps of body copy crossfading
through each other is unreadable. Removed on `animationend`, with a 400ms fallback for a tab
hidden mid-advance, which never gets the event.

### Settings

Skeleton on all three tabs; sliding tab marker; toasts on save and on every alert toggle.
| Save footer | a panel going dirty or clean | `markChangedFeet()` marks only the footer that changed; Cancel arrives on `dd-in` |
| Theme switch | Settings → Appearance | `applyTheme()` re-reads the palette, then the screen repaints — the ramp is baked into markup as literal colours |

### Assistant

Pre-existing and untouched: `asst-resolve`, `asst-blink`, `asst-rise`, `asst-beam-spin`,
`asst-beam-hue`, `asst-dwell`. It has its own tuned motion and its own reduced-motion guards.

---

## Shared helpers

| Helper | File | Does |
| --- | --- | --- |
| `lazySection({key, hasData, skeleton, paint})` | `core.js` | the 1–1.5s skeleton gate, cached per section per tab session |
| `skel(width, height, extra)` | `core.js` | one placeholder block |
| `countUp(node, from, to, format)` | `core.js` | tweens a number, respects reduced motion |
| `wireTabPill(tabs, key)` | `core.js` | sliding tab marker with position replay |
| `closeMenu(menu)` | `core.js` | animated dropdown close |
| `growPlots(host)` | `core.js` | sparkline / column entrance; sets `--i` per column and `--n` per plot so the wipe spans `--motion-base` at any length |
| `growBars(host)` | `core.js` | distribution bar entrance, 8ms per row, counted per block |
| `swapOut(host)` | `core.js` | fades every `.chart-plot` and `.bar-track` out; resolves when they have gone |
| `swapCharts(host, repaint, between)` | `core.js` | the whole gesture: out, repaint, `between`, grow back |
| `wireMetricCharts(host)` | `dashboard.js` | the campaign list's card readout; re-bound every paint |
| `figureValue()` / `countFigures()` | `insights.js` | figures that tween between windows |
| `navigate(href)` | `core.js` | leave for another page behind the exit fade |
| `countFigures(host, before)` | `dashboard.js` | figure motion |
| `markChangedSteps(root)` / `slideStep(dir)` / `exitStep(dir)` | `builder.js` | stepper states + step travel, both directions |
| `wireRailTips(rail)` | `shell.js` | the collapsed rail's 1.5s tooltip |
| `applyRailState(rail, collapsed)` | `shell.js` | in-place rail collapse |

### Lazy sections, in detail

A section with data holds a shimmer skeleton for 1–1.5s, once per section per browser-tab session,
then the content fades up. The wait is synthetic — the prototype has no network — and exists so the
screens demo what they will feel like against a real API.

- **`sessionStorage`, not a module flag.** Each screen is its own document; a module variable would
  not survive the walk from Campaigns to Insights, so every trip back would reload.
- **Only where there is data.** An empty workspace and a campaign with `volumeOf(c) === 0` go
  straight to their zero states.
- **Chrome stays live throughout.** Blanking the control someone just clicked reads as the click
  having failed.
- **Blocks are measured, not guessed** — metric card 147px vs 147.1 real, toolbar 45 vs 45, row 73
  vs 73.1; the table header lands within ~1px of its loaded position. Measure new ones the same way.
- **Blocks are deliberately flat.** A skeleton mimicking bars or a rating ramp is fake data on
  screen, and for the second it is up a reader cannot tell it from the real thing.

**Demo note:** skeletons fire once per browser tab. Open a new tab or run `sessionStorage.clear()`
before showing anyone.

**The skeleton paints through `keepScroll` too, on the same key as the content.** It did not, and
the bug that came out of it is worth keeping in mind because it looked like nothing to do with
scrolling at all: the placeholder left the scroller unstamped, so the paint 1–1.5s later compared
a missing key against the screen's key, concluded it was a different screen, and reset `scrollTop`
to 0. A reader who scrolled while the skeleton was up was silently thrown back to the top — which
reads as *"scroll doesn't work, then after two seconds it does"*, since the second attempt lands
after the content and holds. Both renders now go through one `place()` helper per screen. Any new
lazy section must do the same.

---

## Backlog

### Done since the last pass

Four of the five items that were here are built. What they were, and what closing them taught:

1. ~~**Insights figure count-up**~~ — done, but not by adding `countUp()` where the backlog said.
   The figures had nothing to count *to*: the Date range filter was inert, so no figure on the tab
   ever changed under any control. Wiring motion to it first would have shipped an animation for a
   state that never renders — the exact dead code this file warns about two sections down. The
   range filter had to become real first. **The lesson is general: before animating a change, check
   the change actually happens.**
2. ~~**Validation shake**~~ — done, and the subtlety was *when*, not *what*. The notice is on
   screen for every repaint after the first block, including every keystroke in the field being
   fixed, so a shake wired to the notice's presence would fire on all of them. `ui.shake` is set by
   the press and consumed by the paint it causes.
3. ~~**Star / rating press feedback**~~ — done. `:active` for the give under the finger, `rate-mark`
   for the mark landing. Two halves, because a press and a selection are two events.
4. **Settings save footer** (`settings.js:111`) — **still open**, and now the best remaining item in
   the app by some distance. A panel going dirty makes Cancel *appear* and Save change state, both
   as a hard pop-in.

### Worth doing next — ranked

**All four of the items that were here are built** (Sep 2026), and the fifth was already
done before this list was last read. What they were, and what closing them taught:

1. ~~**Settings save footer**~~ — done, and it needed the stepper's trick rather than a
   transition. The screen repaints on every keystroke, so the footer is a fresh node each
   time and a fresh node has nothing to transition *from*. `markChangedFeet()` in
   `settings.js` remembers each panel's dirty state and marks only the footer that
   actually changed; without that, every character typed re-fired the animation. Cancel
   arrives on `dd-in`'s shape — a control appearing, not a completion, so no bounce.
2. ~~**The row menu's own destructive confirm**~~ — done. `leaveRow()` in `dashboard.js`
   holds the repaint until the row has faded and its cells have given up their padding,
   so the gap closes rather than the row blinking out of a hole. It resolves immediately
   under reduced motion and for a row that is not on screen, because a promise that never
   settles would strand the delete.
3. ~~**Insights chart column → readout parity**~~ — **was already done** when this list
   was written, by `fec44d2`. `wireChart()` in `insights.js` has set `data-reading` and
   `data-on` since then and picks up the shared rules. The entry survived because nobody
   re-checked it. *Check the code before ranking the item.*
4. ~~**Filter chips on Insights**~~ — still open, still a data problem before a motion
   one, and still not on this list for that reason. Five `<select>`s of which only `range`
   changes anything visible. The honest fix is fewer controls.
5. **The `metric-axis` under a swapped plot.** The columns crossfade and regrow; the two
   date labels under them hard-cut. Nobody has noticed, which is roughly the point —
   listed so the next person does not "fix" it and add motion to something that reads
   fine still.

### New since that pass

1. **The chart readout is painted over by a `.metric-head`.** Measured while adding the
   card hover lift: the readout escapes its card upward and is not the topmost element at
   its own centre. It is **not** caused by the lift — it measures identically with the
   lift, with the lift and no `z-index`, and with no lift at all — so it is a pre-existing
   z-order bug and the best remaining item in the app. The lift carries a `z-index`
   anyway, so that whoever fixes this does not have to discover the lift first.
2. **The stat strip wraps to two rows at 1440px with the sidebar expanded.** Recorded in
   the guideline at §6.8. A spec question, not a motion one.

### Blocked on the render path

1. **Row enter/exit on filter.** Needs keyed reconciliation or FLIP. `@formkit/auto-animate` looks
   tailor-made and will not work: it observes a parent's children, and replacing `innerHTML`
   destroys the `<tbody>` and the observer with it.
2. **Skeleton → content crossfade.** Needs both layers in the DOM at once. The current `lazy-in`
   fade-up is a reasonable substitute; the gain does not justify the refactor on its own.

### Considered and rejected

**This list has been reversed** (Sep 2026). It said: *card entrance staggers, avatar hover,
empty-state entrances, device tilt — these animate things that do not change meaning, and
decorating rather than marking state is how a console starts feeling like a toy.* The reasoning was
sound and the call went the other way anyway; it was a product decision, not a technical one.

Built: **card entrance staggers** (`staggerCards()` in `core.js`, spread across one duration rather
than a flat per-card gap), **hover lift** on stat and radio cards and a hairline on table rows, and
**empty-state entrances**. Not built: avatar hover and device tilt, which still have no host worth
the name, and Kumo's own `float` and marquee keyframes, which loop with nothing happening.

The rule that replaced the ban is an ordering rather than a prohibition, and it is in the guideline
at §12.2 rule 7: motion that reveals something the reader could not otherwise see comes first,
motion that marks a change they caused second, motion that only makes the surface feel alive last —
and the last kind never justifies a technical compromise. That is why the lift is one pixel, why a
radio card that is already chosen does not lift, and why every one of these is stilled under
reduced motion.

**Three traps this set walked into, worth knowing before adding more:**

- **A transform makes a stacking context.** The hover lift needed a `z-index` for the same reason
  `.lazy-in` cannot use a `forwards` fill — see the comment on it in `supabase.css`.
- **A stagger reusing a keyframe is not covered by that keyframe's reduced-motion entry.** The card
  stagger uses `lazy-in` but reaches it through `.metric-grid[data-stagger] > *`, and was not
  stilled until that selector was named. Verified in the browser, not by reading the block.
- **An entrance cannot always ride on `entering`.** A workspace with no campaigns has nothing to
  fetch, so `lazySection` skips the wait and paints with `entering` false — the empty state had to
  detect that the *previous* paint had no empty state, the same change-detection the save footer
  needs.

**Page-to-page transitions were on this list and have been taken off it.** The argument for
rejecting them was that a navigation does not change meaning. The argument against was stronger
once the screen was watched rather than reasoned about: opening a campaign is the single longest
gap in the product between a click and anything happening, and it was the one gesture that gave
no acknowledgement at all. The fade is 120ms — the shortest gap that reads as a transition rather
than as lag — and it is paid on every navigation, which is why it is not longer.

---

## Needs a product decision

**The stepper's `attention` state cannot render.** `stepper()` computes
`needsAttention = ui.attention.has(s.n) && !isCurrent`, so a step never shows attention while it is
current. But `ui.attention` is only ever *added* for the current step, on a blocked forward
advance — and `advance()` **deletes** it on the one path that would stop that step being current.
The flag is always cleared before it could render. Verified by walking the path: fill a name, clear
it, hit a blocked advance, navigate away — the step comes back `ready`, never `attention`.

So `.step[data-state="attention"]` and its three CSS rules are unreachable in normal use. No
animation was added for it, because shipping motion for a state that never renders is the same dead
code as the `a.metric:hover` rule that was removed for exactly that reason.

Two ways out, both product calls rather than motion ones: delete the state and its styles, or stop
clearing the flag on a backward `goto` so a step you left broken stays marked. The inline
`.notice-danger` already carries the error for the current step, so the state may simply be
redundant.

---

## How to verify a change

No test suite. Everything here was verified by driving real Chromium.

```bash
python3 -m http.server 8099        # serve the repo root
```

Then Playwright against the pre-installed browser
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). **Three gotchas, each of which cost real
time:**

1. **Block the font CDN** — `page.route('**fonts.g**', r => r.abort())`. It is unreachable in some
   environments and holds the `load` event open for seconds.
2. **Use `waitUntil: 'commit'`.** The default resolves *after* a 1–1.5s skeleton has already
   finished, and you will conclude the skeleton never rendered.
3. **Scroll the target into view before hovering.** The insights chart sits at y≈779, below a
   720px viewport, so a synthetic mouse never reaches it and the component looks broken. If
   `document.elementFromPoint()` returns `none`, that is the tell.

To measure a skeleton against real content, capture `getBoundingClientRect().height` for both
states and diff them — that is how the current blocks were tuned to ~1px.

Check on every motion change: reduced motion (`newContext({ reducedMotion: 'reduce' })`), that
typing in search does not re-trigger a load, and that all four pages stay free of console errors.

---

## Rules that must not be silently broken

- **No animation library.** Motion, GSAP and anime were evaluated and rejected: this is a
  zero-build static prototype (`netlify.toml`: *"Static prototype — no build step"*), and its only
  external resource is loaded non-blocking specifically so a slow CDN cannot delay the page. A
  bundler-less CDN `import` sits in the module graph and would contradict that. If one is ever
  adopted, **vendor it** into `assets/vendor/`.
- **The global `prefers-reduced-motion` block stays last in the stylesheet** so it wins. Three
  earlier blocks are assistant-scoped; the last one covers the rest of the product. Every new
  animation goes in it.
- **Six assistant durations stay hardcoded** (400/500/600ms and the card's own `cubic-bezier`).
  They are ambient, deliberately tuned, and match no token usage. Forcing them onto the three-token
  scale would break motion someone already got right.
- **`transitions-dev` / `transitions-polish` are auditors, not authorities.** Both skills are
  installed (`.agents/skills/`, pinned by `skills-lock.json`) and their scan is genuinely good at
  finding ad-hoc values — but their token scale is **not ours**: `--duration-quick` is 150ms against
  our 120ms, `--duration-fast` 250ms against our 180ms, and `--ease-bounce-strong` directly
  contradicts DESIGN.md's *nothing overshoots*. Map their findings onto our scale. Note the repo has
  **no LICENSE file**, so prefer using it as reference for values over pasting blocks verbatim.
- **The builder gets no skeleton**, and step travel is wired to `advance()` only.
- **Settings panels do load** — workspace config is as much a fetch as campaigns are.
