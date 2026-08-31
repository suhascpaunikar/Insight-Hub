# The assistant

A companion card docked bottom-right on every screen. It reads the campaign
data already in the prototype and answers questions about it, streaming the
reply a word at a time. Open it from the **Assistant** entry in the nav rail,
the buddy button in the corner, or `Ctrl + /`.

The shape of the interaction is borrowed from
[clicky](https://github.com/farzaa/clicky) — a small buddy that speaks first
about what it can see, then offers the next question instead of waiting for
one.

---

## What it is not

**There is no model behind this.** Every answer is composed by
`assistant-answers.js` from the seeded data, deterministically, at the moment
the question is asked. Nothing leaves the browser; there is no API key, no
proxy, no network call.

That is a deliberate choice for a prototype that has to demo offline from two
different static hosts, but it means the assistant can only answer the
questions it has composers for. It is a query engine wearing a chat interface,
and the documentation says so plainly because the violet accent it renders in
means "machine claim" — a prototype that implies more intelligence than it has
would mislead exactly the audience this repository is built for.

What it is *not* faking is the data. The answers are computed from
`data.js` and the live store on every call, so changing the seed numbers
changes the answers. No sentence below is a stored string.

---

## The pointer

Press **`?`**, or the target button in the card header, and a companion drops
onto the page and starts trailing your cursor. Rest it on any panel for a beat
and that panel tells you **what its numbers say** — not how the chart is built,
but what it currently reads.

This is clicky's cursor, walking rather than flying. Clicky's cursor goes where
the model sends it; this one goes where you take it.

> 18,422 of 41,200 sent finished — 44.7% end to end. The bleed is Shown →
> Started, losing 12,120 there alone, 36% of that step. Recovering half of it
> would be worth about 5,135 more completions. They saw it and did not start,
> which points at timing and relevance rather than the questions themselves.

Every figure there is computed at the moment the pointer settles, including the
counterfactual — change the seed numbers and the sentence changes with them.

`Escape` puts the pointer away; a second `Escape` closes the card. The two
follow-ups under each reading lead back to the intent registry.

### Why a dwell, and why a mode

Sweeping across a dense page passes over several panels, and firing on each one
would be noise — so a panel only speaks once the pointer has **settled on it for
600ms**, with a ring closing around the companion so the wait reads as
deliberate rather than as a hang.

It is a mode for the same reason it is a dwell: the panels underneath already
own the pointer — routing a driver to a team, opening a response, a select.
Making hover meaningful is only safe once the user has asked for it. With the
pointer stowed, every panel behaves exactly as it did before.

A pointer that cannot hover has no dwell, so on touch a tap stands in for it.

### The panels

Nine, across the three insights tabs:

| Tab | Panels |
|---|---|
| Delivery | delivery funnel, delivery over time, failure reasons |
| Responses | the rating question, follow-up by band, open text |
| Impact | score drivers, variant comparison, intelligent A/B weighting |

To add one, put `data-insight="key"` on its container and write a composer in
`assistant-insights.js`. Composers read `data.js` and return
`{ title, text, followUps }` — compute the figures, never hardcode them, and use
`share()` for anything divided by a response base so `LOW_SAMPLE` still holds.

---

## Why there is no screenshot

Clicky's hardest problem is that it is a bystander to the app it describes: it
has no access to the data, so it photographs the screen with ScreenCaptureKit,
sends the pixels to a vision model, and animates a cursor to coordinates the
model estimated.

InsightHub *is* the app. The campaigns, themes and drivers are structured
objects one import away, so `assistant-context.js` reads them directly. Same
position in the pipeline, but exact instead of inferred — and no screenshot,
no vision call, no coordinate guessing.

Two things it reads from the DOM rather than by importing another module's
internals: the insights filters, and the active tab (via its `aria-selected`
state). Both keep the assistant reporting what the page actually rendered — a
stale `?tab=` for a tab that no longer exists falls back on the page, and would
otherwise leave the assistant describing a panel the reader cannot see.

| clicky | here |
|---|---|
| ScreenCaptureKit screenshot | `assistant-context.js` reads state directly |
| Vision model reads pixels | structured objects, no inference |
| Cloudflare Worker holding keys | nothing — no network call at all |
| `ctrl + option` global hotkey | `Ctrl + /` |
| cursor flies where the model sends it | companion walks where you take it (`?`) |

---

## Layout

The card is a fixed **320 × 240**. The answer region scrolls inside it and the
follow-ups stay pinned to the bottom edge, so an answer never changes the
card's footprint or shifts the console behind it. While text streams, the view
follows the caret; when the answer lands it settles back to the top so it reads
from the first line. Whichever edge the content overflows is faded, so a cut
line reads as "more this way" rather than as a clipped render.

It mounts on `document.body`, not `#app` — `renderShell()` replaces
`#app.innerHTML` on every rerender, which is the same reason `toastHost()`
lives there. `renderBuilder()` mounts it separately, because the wizard is
full-screen focus mode and renders its own chrome instead of calling
`renderShell()`.

---

## Two rules it inherits

- **`LOW_SAMPLE`** (`core.js`) — under 100 responses the console shows counts,
  never percentages. `share()` in `assistant-answers.js` enforces the same
  rule, so the assistant cannot quote a share off a base of six.
- **FR-91** — violet (`#a78bfa`) is reserved for machine inference and appears
  nowhere in the rating ramp or the status palette. The card is violet
  throughout, so it always reads as a claim and never as a measurement.

---

## Files

| File | Purpose |
|---|---|
| `assets/js/assistant.js` | the card, the state machine, the word-by-word reveal |
| `assets/js/assistant-context.js` | what the assistant can see — page, campaign, tab, filters, draft |
| `assets/js/assistant-answers.js` | the intent registry and the answer composers |
| `assets/js/assistant-insights.js` | what each panel's data says — one composer per panel |
| `assets/js/assistant-pointer.js` | the cursor companion, dwell detection and panel arming |

Styles live at the end of `assets/css/supabase.css` under *Assistant*.

---

## Adding an answer

Add an entry to `INTENTS` in `assistant-answers.js`:

```js
myIntent: {
  label: 'Question as it appears in follow-ups',
  keywords: ['words', 'that', 'route', 'here'],
  run: (context) => ({
    text: `Composed from data, never hardcoded.`,
    followUps: ['drivers', 'themes'],   // two intent ids
  }),
},
```

`label` is what a follow-up button reads. `run` receives the context snapshot
and returns the answer plus the two questions offered next. Use `count()`,
`percent()` and `ratingText()` from `core.js` so figures are formatted the way
the rest of the console formats them, and `share()` for anything that divides
by a response base.

---

## If you want a real model behind it

The seam is already in place: replace the body of `answer()` in
`assistant-answers.js` with a call to a proxy that holds the API key, and
stream its tokens into `streamAnswer()` in place of the local word list. The
context builder and the entire card carry over untouched — `snapshot()` is
already the prompt payload.

That would mean adding a serverless function, since a key must never ship in a
static bundle. GitHub Pages cannot run one; Netlify can.
