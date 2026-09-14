# InsightHub — Feedback Campaign Builder

A prototype of the campaign creation flow described in
[`docs/prd-v5.md`](docs/prd-v5.md), built on
**[@cloudflare/kumo](https://www.npmjs.com/package/@cloudflare/kumo)** — the
Cloudflare dashboard's own component library.

**Live:** <https://suhascpaunikar.github.io/Insight-Hub/> — GitHub Pages, published
from `main` by [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

```
git clone … && cd Insight-Hub
pnpm install
pnpm dev                        # or `pnpm build && pnpm preview`
```

> This used to be four static HTML documents with no build step, mirroring Kumo by
> hand. It now uses the real components, which are React — so there is a build. See
> [§11.5 of the guideline](docs/ui-guidelines-cloudflare-dark.md) for what that
> changed and why the mirror could not stay.
>
> **That build is still here**, on the `html-prototype` branch — the last commit
> before the port. `scripts/revert-to-html.sh` restores it;
> [`docs/revert-to-html.md`](docs/revert-to-html.md) covers both routes and what
> reverting costs.

```bash
git switch html-prototype && python3 -m http.server 8000   # the old build, no install
scripts/revert-to-html.sh --check                          # what reverting would change
```

---

## Screens

| URL | Screen | Requirements |
|---|---|---|
| `index.html` | Campaign dashboard — activity strip + campaign list | FR-71 – FR-85 |
| `builder.html` | Four-step creation wizard | FR-1 – FR-57 |
| `insights.html` | The campaign data screen — Delivery / Responses / Impact for a feedback campaign, Delivery / Engagement / Impact for an announcement | FR-86 – FR-110 |
| `settings.html` | Workspace settings — General / Delivery / Alerts | FR-63 |

Each is a separate Vite entry, so the URLs are real page loads rather than routes.

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

### What it was

`DESIGN.md` is the output of `npx getdesign@latest add supabase`, plus a **Dark product
surface** section appended for this repository — `#121212` canvas, `#1c1c1c` panels, the
`#2e2e2e` hairline ladder, `#ededed` type, and `#3ecf8e` kept scarce for the single
filled CTA per view. It is **superseded** and kept as the record of what was replaced.

Two ideas from it survive the restyle, at new values:

- **The rating ramp** — five stops, red → emerald, normalised to whichever rating
  element the campaign uses (star 1–5, NPS 1–5, NPS 1–10), so one colour means one thing
  on every surface (FR-79, FR-89). It now has a set of stops per theme, and the
  stylesheet owns them: `readPalette()` in `core.js` reads them back, because the ramp is
  interpolated into markup as literal colours.
- **The AI accent** — reserved for machine inference, `#a78bfa` then and `#7367e5` now.
  It appears nowhere in the ramp and nowhere in the status palette, so a violet element is
  always a claim and never a measurement (FR-91). The documentation chip holds the same
  hex under its own token, `--docs-chip`, precisely so this rule keeps meaning what it
  says.

A third section, **Console settings and observability patterns**, documents the compositions
taken from the Supabase dashboard's own settings and reporting screens — the settings panel and
its row variants, inputs that carry their unit and derive what it works out to, the callout, the
metric card, and the charts' dashed rules and hover readout. The rule that matters most there:
counts are drawn from zero and rates are not, and a rate card prints the band it is scaled
against rather than hiding the zoom.

### What it is

**The console runs on Kumo itself, in two themes.** The specification — colour, type,
spacing, shell, every component, motion, and a map from the primitives it replaced — is
[`docs/ui-guidelines-cloudflare-dark.md`](docs/ui-guidelines-cloudflare-dark.md).
One stylesheet entry, `src/styles/app.css`, pulls in Kumo's styles, Tailwind, the token
bridge and what little CSS the product still owns.

**Dark is the default.** Light is the dashboard's own light scale, from Appendix B of the
guideline, switched from **Settings → General → Appearance** and remembered per browser.
The surfaces are measured; the three palettes that carry meaning — the semantic colours,
the rating ramp and the chart series — are re-derived, because a palette tuned to sit on
`#030303` falls under 3:1 against `#fbfbfb`.

The values are not guesses and they are no longer copied: the components *are* Kumo's,
and the tokens resolve live out of the package's own `@theme`. §11 of the guideline is
the component-by-component map, the reconciliation showing which measured values Kumo
confirmed and which it corrected, and — in §11.4b — the three places a Kumo component
is the right answer and still needs composing rather than dropping in.

```bash
npx @cloudflare/kumo ls            # the catalogued components
npx @cloudflare/kumo doc Button    # one component's props, sizes and variants
```

Note that `ls` reads a registry that is smaller than what the package exports; §11.3
lists the eleven components missing from it.

Work in progress on the restyle is handed over in [`docs/revamp.md`](docs/revamp.md) —
where it stands, how to verify it, what is left, and which decisions are already settled.

---

## Layout

```
index.html · builder.html · insights.html · settings.html   Vite entries
src/
  entries/           one per screen: mounts its page into #app
  styles/
    app.css          the entry: @source, Kumo, Tailwind, then the two below
    tokens.css       InsightHub's token names onto Kumo's, resolved live
    product.css      only what Kumo does not ship — §11.4's "(none)" list
  app/
    Shell.jsx        Kumo Sidebar + bar + tab strip + stat strip + footer
    WizardShell.jsx  the builder's own chrome, keeping the rail beside it
    ShellContext.jsx what a page tells the shell about its own chrome
    NavRail · TopBar · TabStrip · StatStrip · SiteFooter · QuickSearch
    dialogs · RenameDialog · settings-kit · wizard-kit
    MetricCard · InsightChart · PhonePreview · DateField · Orb · Assistant
  pages/
    Campaigns.jsx    campaign list
    Builder.jsx      wizard frame + builder/Step1 · Step2 · ContentStep · Step4
    Insights.jsx     tabs branch on kind + insights/Delivery · Responses · Engagement · Impact
    Settings.jsx     workspace settings
  lib/
    data.js          seeded campaigns, templates, segments, insights
    store.js         draft model, variant reconciliation, step validation, persistence
    useStore.js      the store, as React sees it
    format · palette · persist · csv · insights-lib · icons · toast
    assistant-context.js  what the assistant can see
    assistant-answers.js  intent registry + answer composers
    assistant-insights.js what each panel's data says
    assistant-pointer.js  the cursor companion and its dwell
    assistant-orb.js      the Siri-style orb — idle and thinking
scripts/
  verify.mjs         loads every built screen in Chromium and fails on any error
  revert-to-html.sh  restores the pre-port HTML prototype from its tag
docs/
  prd-v5.md            the source PRD
  prd-coverage.md      FR-by-FR map, the 21 open decisions, what changed vs Magic Patterns
  insights-data-plan.md  every data point the campaign data screen can carry, by kind
  assistant.md         the companion card — what it is, and what it isn't
  ui-guidelines-cloudflare-dark.md  the design system: tokens, components, motion, both themes
  revamp.md            the restyle handover — superseded by the port, kept as its record
  revert-to-html.md    how to get the no-build-step prototype back, and what it costs
DESIGN.md              the superseded Supabase system, kept as the record of what it replaced
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
