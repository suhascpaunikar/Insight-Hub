# InsightHub — Feedback Campaign Builder

An HTML prototype of the campaign creation flow described in
[`docs/prd-v5.md`](docs/prd-v5.md), built in the **Supabase design system, dark**.

Nothing to install to *look* at it — the dashboard ships as a committed bundle, and
every other page is plain HTML, CSS and ES modules:

```
git clone … && cd Insight-Hub
python3 -m http.server 8000     # or any static server
open http://localhost:8000
```

> A static server is recommended over `file://`: the pages are ES modules, which
> browsers block on the `file:` scheme.

The **campaign dashboard** (`index.html`) is built with **[shadcn/ui](https://ui.shadcn.com)**
on React + Vite + Tailwind v4; its source is in [`app/`](app) and editing it needs one
build step. See [Building the dashboard](#building-the-dashboard).

---

## Screens

| File | Screen | Requirements |
|---|---|---|
| `index.html` | Campaign dashboard — activity strip + campaign list (**React + shadcn/ui**, built from `app/`) | FR-71 – FR-85 |
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
index.html · builder.html · insights.html · settings.html
app/                   the dashboard, on React + Vite + Tailwind v4 + shadcn/ui
  components.json      shadcn config — `npx shadcn@latest add <component>` writes here
  src/
    index.css          Tailwind v4 theme: shadcn's token names, InsightHub's values
    legacy.css         supabase.css in a cascade layer, for the assistant's styles
    main.tsx           mounts the page into #root
    components/
      campaigns-page.tsx   the screen — state, dialogs, toasts, undo
      activity-strip.tsx   the four metric cards, on shadcn's chart component
      campaign-table.tsx   toolbar, rows, status pills, row menu
      app-sidebar.tsx      the nav rail, on shadcn's sidebar
      site-header.tsx      workspace / app / environment
      ui/                  shadcn components, as the CLI writes them
    lib/format.ts      counts, percentages, elapsed time, the rating ramp
assets/
  css/supabase.css     tokens + component primitives (the three vanilla pages)
  dashboard/           the dashboard's built bundle — committed, do not hand-edit
  js/
    core.js            DOM helpers, icons, formatting, rating ramp, dialog/toast/dropdown
    data.js            seeded campaigns, templates, segments, insights
    store.js           draft model, variant reconciliation, step validation, persistence
    shell.js           nav rail + context bar
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
```

---

## Building the dashboard

The campaign dashboard is a React app built with **shadcn/ui** — the components are
copied into `app/src/components/ui/` and owned here, which is the point of the library:
they are source, not a dependency to configure around.

```
cd app
npm install
npm run dev      # the dashboard on Vite's dev server
npm run build    # writes assets/dashboard/dashboard.{js,css}
```

`npm run build` is the only build step in the repository, and its output is **committed**.
That is deliberate: GitHub Pages publishes this repository as it stands and Netlify's
`publish` is the repository root, so the built bundle is what keeps `index.html` openable
from any static server — the promise every other page here already keeps. Edit `app/src`,
run the build, commit both.

Adding a component works the normal way:

```
cd app && npx shadcn@latest add <component>
```

### What is shared, and what is not

The dashboard reads the **same store the vanilla pages read** — `assets/js/store.js` and
`assets/js/data.js`, imported through the `@proto` alias. There is one campaign list, so
a campaign published in the builder appears here on the next load, and a rename here is
the rename the insights page sees.

Three things follow from that:

- **The theme is InsightHub's, in shadcn's names.** `app/src/index.css` maps
  `--background`, `--card`, `--primary` and the rest onto the palette in `DESIGN.md` —
  `#121212` canvas, `#1c1c1c` panels, the `#2e2e2e` hairline, `#3ecf8e` for the one
  filled CTA. The rebuilt page sits beside the other three without looking like a
  different product.
- **The rating ramp travels with the data.** `app/src/lib/format.ts` carries the same
  five stops normalised the same way, so `6.8 /10` is the colour it is on the insights
  page.
- **The assistant is still here.** It mounts itself into `<body>` from
  `assets/js/assistant.js` and is styled by `.asst-*` rules in `supabase.css`, so
  `app/src/legacy.css` imports that stylesheet into a **cascade layer** — declared above
  Tailwind's reset (the assistant's AI-accent border has to beat `* { border-color }`)
  and below its utilities (a utility on this page always wins). Nothing else on the page
  uses a class name the legacy sheet defines.

### What the rewrite changed

Behaviour is the one the prototype already specified — the same range picker, the same
status-adaptive row menu, the same undo on delete, the same first-run empty state, the
same ~1.2s section load with skeletons sized to what they stand in for. What changed is
underneath: menus, dialogs, the select, the table and the charts are now components with
real focus management, keyboard support and an accessible chart tooltip, instead of
hand-rolled markup and hand-bound `mousemove` handlers.

One fix came out of it: the footer's **Reset all prototype state** cleared
`insighthub.prototype.v1`, a key `core.js` stopped writing when the campaign shape gained
`goal`, `channel` and `reach`. It now clears `v2`, the key actually persisted.

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
