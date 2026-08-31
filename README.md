# InsightHub — Feedback Campaign Builder

An HTML prototype of the campaign creation flow described in
[`docs/prd-v5.md`](docs/prd-v5.md), built in the **Supabase design system, dark**.

No build step, no dependencies. Open `index.html` in a browser.

```
git clone … && cd Insight-Hub
python3 -m http.server 8000     # or any static server
open http://localhost:8000
```

> A static server is recommended over `file://`: the pages are ES modules, which
> browsers block on the `file:` scheme.

---

## Screens

| File | Screen | Requirements |
|---|---|---|
| `index.html` | Campaign dashboard — the landing screen | FR-71 – FR-85 |
| `builder.html` | Six-step creation wizard | FR-1 – FR-57 |
| `insights.html` | Delivery / Responses / Themes / Impact | FR-86 – FR-110 |

The prototype is **clickable, with real state**. Validation actually gates the wizard,
the branching toggle populates the three bands, switching template warns before
discarding content, the mobile preview walks the branch you tap, and publishing adds a
live row to the dashboard. Progress persists in `localStorage` — reset from the link in
the dashboard footer.

**Start here:** open `index.html` → *New Campaign* → walk the six steps → publish → open
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

Tokens and primitives: `assets/css/supabase.css`.

---

## Layout

```
index.html · builder.html · insights.html
assets/
  css/supabase.css     tokens + component primitives
  js/
    core.js            DOM helpers, icons, formatting, rating ramp, dialog/toast/dropdown
    data.js            seeded campaigns, templates, segments, insights
    store.js           draft model, variant reconciliation, step validation, persistence
    shell.js           nav rail + context bar
    dashboard.js       campaign list
    builder.js         wizard frame, steps 1·2·3·5·6
    content-step.js    step 4 — template picker, question logic, triggers
    insights.js        four insight tabs
    assistant.js       companion card — 320×240, streaming answers
    assistant-context.js  what the assistant can see
    assistant-answers.js  intent registry + answer composers
docs/
  prd-v5.md            the source PRD
  prd-coverage.md      FR-by-FR map, the 21 open decisions, what changed vs Magic Patterns
  assistant.md         the companion card — what it is, and what it isn't
DESIGN.md              Supabase design reference + dark product adaptation
```

---

## The assistant

A companion card docked bottom-right on every screen, in the shape of
[clicky](https://github.com/farzaa/clicky): it speaks first about whatever is
on screen, streams the answer a word at a time, and offers the next question
rather than waiting for one. Open it from **Assistant** in the nav rail, the
buddy button in the corner, or `Ctrl + /`.

**There is no model behind it.** Answers are composed deterministically from
`data.js` and the live store at the moment they're asked — nothing leaves the
browser, and there is no key, proxy or network call. What it does not fake is
the data: change the seed numbers and the answers change with them.

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
