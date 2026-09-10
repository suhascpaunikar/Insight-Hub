# InsightHub — Feedback Campaign Builder

A prototype of the campaign creation flow described in
[`docs/prd-v5.md`](docs/prd-v5.md), in two design systems at once:

- **The homepage** (`index.html`) is built in **[Cloudflare Kumo](https://github.com/cloudflare/kumo), dark**
  — React, real Kumo components, Kumo's own tokens and motion.
- **The other three screens** are the original **Supabase-dark** prototype: plain
  HTML and ES modules, no framework, unchanged.

```
git clone … && cd Insight-Hub
pnpm install
pnpm dev            # homepage on Vite, other screens served from the same root
```

```
pnpm build          # → dist/  (bundles the homepage, copies the rest verbatim)
pnpm preview
```

> The three prototype pages are ES modules, which browsers block on the `file:`
> scheme — serve them rather than opening the files.

---

## Screens

| File | Screen | Requirements |
|---|---|---|
| `index.html` | Campaign dashboard — activity strip + campaign list · **Cloudflare Kumo** | FR-71 – FR-85 |
| `builder.html` | Six-step creation wizard | FR-1 – FR-57 |
| `insights.html` | The campaign data screen — Delivery / Responses / Impact for a feedback campaign, Delivery / Engagement / Impact for an announcement | FR-86 – FR-110 |
| `settings.html` | Workspace settings — General / Delivery / Alerts | FR-63 |

The prototype is **clickable, with real state**. Validation actually gates the wizard,
the branching toggle populates the three bands, switching template warns before
discarding content, the mobile preview walks the branch you tap, and publishing adds a
live row to the dashboard. Settings save per panel and the rename reaches the workspace
switcher. Progress persists in `localStorage` — reset from the link in the dashboard footer,
or from **Settings → General**.

Step 1 also asks for a **campaign objective** — a plain-English sentence saying what
the campaign is for, which nothing else in the wizard records. It configures nothing:
it travels with the campaign through save, clone and publish, shows on the dashboard
row and the publish summary, and is what the assistant answers *"what is this campaign
for"* from. The wizard opens with the nav rail collapsed to its icon strip, since the
Content step wants the width; expanding it is one click and the wizard remembers that
separately from the console.

**Start here:** open `index.html` → *New Campaign* → walk the four steps → publish → open
the resulting row.

---

## Design system

### The homepage — Cloudflare Kumo

`pnpm add @cloudflare/kumo`. The dashboard is composed from Kumo's own components —
`Sidebar`, `Table`, `LayerCard`, `Surface`, `DropdownMenu`, `Select`, `InputGroup`,
`Badge`, `Tooltip`, `Toasty`, `CommandPalette`, `Empty` — with Kumo's default dark
theme untouched: the neutral scale, the `#f6821f` brand accent for the wordmark, the
blue primary action, `ChartPalette` for every data series, and Phosphor icons. The only
colour that is not Kumo's is the **rating ramp**, because that ramp is product
semantics: 6.8 has to mean the same thing on this screen as it does on Insights.

Nothing about the sidebar is reimplemented. Its collapse is Kumo's `Sidebar` as it
ships — **260px ↔ 57px over 250ms on `cubic-bezier(0.77, 0, 0.175, 1)`**
(`SIDEBAR_WIDTH`, `SIDEBAR_WIDTH_ICON`, `SIDEBAR_ANIMATION_DURATION_MS`,
`SIDEBAR_EASING`) — including the labels truncating as the width closes, the group
labels cross-fading into separator hairlines, the open sub-tree folding away, the
badges leaving before the labels, and the panel icon flipping on the same curve.

The page's own micro-animations are ported rather than replaced, because Kumo has no
equivalent of them: the skeleton sweep, the fade-up of what replaced it, the sparkline
growing one column behind the last, the whole-series swap on a range change, the
figures counting to the new window, the hover readout with its neighbours at .38, the
Live pill's pulse, the chevron's two-pixel lean, and the flash on a cloned, renamed or
restored row. They live in `src/app.css` and `src/motion.ts`.

The homepage reads and writes the same `assets/js/store.js` the other screens do, so a
campaign published from the builder lands on this list and a rename made here reads
through everywhere.

### The other three screens — Supabase, dark

`DESIGN.md` is the output of `npx getdesign@latest add supabase`, plus a **Dark product
surface** section appended for this repository. The generated document describes
Supabase's marketing track, which commits to a white canvas; a product console needs the
dashboard dark scale, so that section defines the tokens actually used —
`#121212` canvas, `#1c1c1c` panels, the `#2e2e2e` hairline ladder, `#ededed` type, and
`#3ecf8e` kept scarce for the single filled CTA per view.

Two additions the marketing brand has no answer for, both documented there:

- **The rating ramp** — five stops, red → emerald, normalised to whichever rating
  element the campaign uses (star 1–5, NPS 1–5, NPS 1–10), so one colour means one thing
  on every surface (FR-79, FR-89).
- **The AI accent** — `#a78bfa`, reserved for machine inference. It appears nowhere in
  the ramp and nowhere in the status palette, so a violet element is always a claim and
  never a measurement (FR-91).

A third section, **Console settings and observability patterns**, documents the compositions
taken from the Supabase dashboard's own settings and reporting screens — the settings panel and
its row variants, inputs that carry their unit and derive what it works out to, the callout, the
metric card, and the charts' dashed rules and hover readout. The rule that matters most there:
counts are drawn from zero and rates are not, and a rate card prints the band it is scaled
against rather than hiding the zoom.

Tokens and primitives: `assets/css/supabase.css`.

---

## Layout

```
index.html             the Kumo homepage (Vite entry)
src/                   the Kumo homepage's source
  main.tsx             mounts <Home> inside Kumo's toast provider
  Home.tsx             the campaign dashboard — layout, lazy load, ⌘K palette
  app.css              Kumo's tokens + this page's own ported motion
  motion.ts            countUp, growPlots, swapOut, placeChartTip, lazyLoad
  legacy.ts            typed bridge to store.js / data.js / core.js
  shell/
    AppSidebar.tsx     Kumo's Sidebar, composed with InsightHub's destinations
    TopBar.tsx         screen name, app switcher, environment (FR-62)
  components/
    ActivityStrip.tsx  the four cards + the range swap choreography
    MetricCard.tsx     one figure, its sparkline, and the hover readout
    CampaignTable.tsx  the list, the row menu, rename, delete → undo
    StatusPill.tsx     status dot; Live is the one that pulses
    Skeletons.tsx      what the screen shows while the list is on the way

builder.html · insights.html · settings.html    (the original prototype)
assets/
  css/supabase.css     tokens + component primitives
  js/
    core.js            DOM helpers, icons, formatting, rating ramp, dialog/toast/dropdown
    data.js            seeded campaigns, templates, segments, insights
    store.js           draft model, variant reconciliation, step validation, persistence
    shell.js           nav rail + context bar
    dashboard.js       campaign list — the pre-Kumo homepage, kept as the reference
    builder.js         wizard frame, steps 1·2·3·5·6
    content-step.js    step 4 — template picker, question logic, triggers
    insights.js        the campaign data screen — tabs branch on campaign kind
    settings.js        workspace settings — the console settings patterns
    assistant.js       companion card — 320×240, streaming answers
    assistant-context.js  what the assistant can see
    assistant-answers.js  intent registry + answer composers
    assistant-insights.js what each panel's data says
    assistant-pointer.js  the cursor companion and its dwell
    assistant-orb.js      the Siri-style orb — idle and thinking
docs/
  prd-v5.md            the source PRD
  prd-coverage.md      FR-by-FR map, the 21 open decisions, what changed vs Magic Patterns
  insights-data-plan.md  every data point the campaign data screen can carry, by kind
  assistant.md         the companion card — what it is, and what it isn't
DESIGN.md              Supabase design reference + dark product adaptation
vite.config.ts         builds index.html, copies the prototype pages verbatim
```

---

## The assistant

A companion card docked bottom-right on every screen, in the shape of
[clicky](https://github.com/farzaa/clicky): it speaks first about whatever is
on screen, streams the answer a word at a time, and offers the next question
rather than waiting for one. Open it from **Assistant** in the nav rail, the
buddy button in the corner, or `Ctrl + /`.

Its face is a Siri-style liquid orb with two states: **idle** — slow,
desaturated, barely breathing — and **thinking**, seven times faster and
saturated violet-cyan-magenta, which it holds from the first word of an answer
to the last. The launcher, the card's header mark and the cursor companion all
wear it and all share one state, so the card's own latency is legible instead
of being covered by a still icon.

While it composes, a soft rainbow comet also drifts around the card's edge — a
plain-CSS port of the `border-beam` package's `md`/`colorful` preset, blurred
and slowed to sit under the answer rather than compete with it, driven off the
same state.

**There is no model behind it.** Answers are composed deterministically from
`data.js` and the live store at the moment they're asked — nothing leaves the
browser, and there is no key, proxy or network call. What it does not fake is
the data: change the seed numbers and the answers change with them.

Press **`?`** and a companion drops onto the page and trails your cursor. Rest it
on any panel for a beat and that panel tells you what its numbers say — the
worst step in the funnel and what recovering half of it would be worth, which
theme is most of the drag on the score, whether an A/B gap is readable at all.
Clicky's cursor goes where the model sends it; this one goes where you take it.

Clicky screenshots the screen because it is a bystander to the app it
describes. InsightHub *is* the app, so `assistant-context.js` reads the state
directly — exact instead of inferred, and no vision call in the middle.

Full notes, including how to add an answer and where the seam for a real model
sits, are in [`docs/assistant.md`](docs/assistant.md).

---

## Reading the differences

The prototype is a rebuild of an earlier Magic Patterns export, checked flow-by-flow
against the PRD. Ten behavioural differences came out of that comparison — the largest
being that the Magic Patterns build still carries the **split food-quality /
delivery-experience rating pair**, which this revision of the PRD replaces with a
**single generic app-experience rating**. That change cascades into the dashboard column,
the ramp, the Responses block, the themes, and the Impact tab, where the 2×2 attribution
matrix becomes a **score driver breakdown** ranked by how far each theme pulls the score
down.

All ten, plus every open decision and how it was resolved, are in
[`docs/prd-coverage.md`](docs/prd-coverage.md).
