# The assistant

A companion card docked bottom-right on every screen. It reads the campaign
data already in the prototype and answers questions about it, streaming the
reply a word at a time. Open it from the **Assistant** entry in the nav rail,
the buddy button in the corner, or `Ctrl + /`. Ask by clicking a follow-up, or
by typing into the box at the foot of the card.

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

## The one thing it is told rather than reads

Every composer in `assistant-answers.js` derives its answer from the seed data
— except `objectiveAnswer`, whose material is the **campaign objective** typed
on step 1 of the builder. The configuration a campaign carries says what it
does: a trigger, an audience, a rating element, a set of questions. None of it
says what the campaign is *for*, or what the reader is meant to do with the
answers, and that sentence usually lives in a ticket the console never sees.

So the wizard asks for it, and the assistant quotes it back verbatim rather
than paraphrasing it: the words are evidence of intent, and a summary of them
would be a claim about intent. Where a campaign has no objective the answer
says so and names what it can offer instead — never a guess assembled from the
goal id.

The field is optional. An assistant that can say *"nothing here records that"*
is more useful than a wizard that blocks on an essay box, which mostly
collects the word "asdf".

---

## The orb

The assistant's face is a Siri-style liquid orb, and it has two states:

| | Speed | Palette | Reads as |
|---|---|---|---|
| **idle** | 0.246 | muted indigo, slate, mauve | a machine at rest |
| **thinking** | 1.69 | violet, cyan, magenta | a machine composing |

It wakes on the first word of an answer and settles on the last, so the card's
own latency is legible — the alternative is a still icon sitting over moving
text, which says nothing about whether anything is happening.

Three surfaces wear it: the launcher in the corner, the mark in the card
header, and the cursor companion. They share one state through
`orbThinking(reason, on)`, because a header still idling while the answer
streams underneath it reads as two machines rather than one.

### What makes it think

Two things, counted by reason rather than set outright:

- **`answer`** — the word-by-word stream, from `streamAnswer()` to the last word.
- **`dwell`** — the 600ms a panel is being considered before it speaks.

They overlap on purpose. A dwell fires *into* an answer, so the handover has to
be seamless; and a dwell abandoned while an earlier answer is still streaming
must not put the orbs back to sleep. Counting reasons is what makes both true.

### Waking and settling are not the same curve

Waking is 800ms on a cubic ease-out — most of the distance is covered in the
first third, so the orb snaps to attention. Settling is 2000ms on a smoothstep,
easing in and out, so it drifts back down rather than switching off. Attention
arrives faster than it leaves, and the asymmetry is what stops the idle state
reading as "broken" every time an answer lands.

Interrupting either one re-aims from wherever the blend currently *shows*, not
from wherever the last transition started, so waking out of a half-finished
settle is continuous. Colours interpolate in linear light: sRGB is a perceptual
encoding, and lerping violet→cyan inside it drags the midpoint through a grey
neither end contains.

Speed changes sevenfold between the states, so the wave is driven by
accumulated phase rather than by `time · speed` — otherwise the crest would
jump forward by seconds at the moment of the change, and only its rate should
alter.

### Why it is Canvas 2D and not WebGPU

The reference implementation is a WebGPU shader that stops dead with "WebGPU is
not supported" when `navigator.gpu` is missing. This prototype has to demo
offline from two static hosts onto whatever browser is in the room, and a blank
circle where the assistant should be is a worse failure than a slightly
cheaper orb.

At 44px it is also barely a trade. The shader's five-octave noise, its
chromatic dispersion and its 221k-instance particle pipeline resolve to a few
pixels at this size, so what is ported is what you can actually see: the four
phase-separated wave bands, the cos² envelope that tapers them at the limbs,
the dominance-weighted spectrum, the rim refraction, and the two-lobe shell
lighting. All of it is the shader's own arithmetic, evaluated per pixel in
JavaScript. The one deliberate cut is the chromatic channel split — three
fluid evaluations to produce a fringe under a third of a pixel wide.

Three orbs at once hold 60fps with no dropped frames. The buffer is capped at
96px and the wave is a smooth field, so the browser's own smoothing does any
upscale.

### Palette, and one deviation from the reference

The reference's thinking state opens on gold. This console reserves violet
`#a78bfa` for machine inference (FR-91) and puts amber `#ffb224` in the rating
ramp, so a gold orb would read as a measurement on the same screen as the
measurements it is describing. Cyan, magenta and violet are the reference's
exactly; its gold becomes the console's own violet, and idle drops the
reference's warm sand for the same reason. Every value lives in `SEEDS` at the
top of `assistant-orb.js` — swapping back is an edit to two hex strings.

Idle exposure is the other change: the reference idles at 1.36 rendering
full-bleed at ~600px, where a faint crest still spans a hundred pixels. At 44px
it spans six, and the resting orb read as an unlit circle — wrong for the one
control that has to invite a click.

### Reduced motion

`prefers-reduced-motion: reduce` gets the orb without the animation: one frame
per state, repainted when the state changes. It still says which state it is in
— it just never moves to say it.

---

## The border beam

While the assistant thinks, a comet travels the card's edge. It is a port of
[`border-beam`](https://www.npmjs.com/package/border-beam) `1.3.0` at
`size="md" colorVariant="colorful" theme="dark"`, in plain CSS.

### Why it is CSS and not the package

The package is React + Tailwind + TypeScript, and it expects a shadcn project
with a `/components/ui` folder. This prototype is none of those — no
`package.json`, no bundler, and `netlify.toml` publishes the repo root as-is.
Adding that toolchain to ship one border animation would rewrite the prototype
and break the property the whole thing is built around, and GitHub Pages could
not run the build.

It also was not necessary. The React component's only job is to emit scoped CSS
with a generated id; every prop it takes is a variable in a stylesheet. So the
rules in `supabase.css` are the package's own — its conic gradients, its mask
composite chain, its nine pinned blobs, its 1.96s lap, its ±30° hue drift under
brightness 1.3 and saturate 1.2 — with the generated id replaced by the
`.asst-card` selector.

### The part that is not the obvious build

**The colour does not travel.** Nine radial-gradient blobs are pinned at fixed
points around the border — magenta at the top, blue upper-left, green on the
left flank, violet along the bottom, orange top-right — and what sweeps is a
white comet, a conic-gradient mask spun by the registered `--asst-beam-angle`.
The beam therefore *changes colour as it passes each blob* rather than carrying
a colour with it, which is why the same highlights land in the same places on
every lap.

Three composited masks pin it to the edge: the comet, INTERSECTed with the
border-ring trick (the full box EXCLUDEd against the content box, the ring's
thickness being the layer's own 1px padding).

### Two deviations, both written down

**The blob field is proportional, not pixel-sized.** The package authors its
blobs in fixed pixels — `70px`, `180px` — against its own demo card, which is
348×137. This card is 320×**240**, nearly twice as tall, so the blobs pinned to
the left and right edges covered a much smaller share of them and the beam
guttered out along the vertical runs. Each size is now that pixel value as a
percentage of the package's own card, which restores the intent — every blob
covers the same fraction of the edge it sits on — and makes the field scale
with whatever it wraps.

**It is blurred, slower, and re-levelled.** Three changes that travel
together, because each one moves the others:

| | Package | Here |
|---|---|---|
| Lap | 1.96s | **3.4s** |
| Stroke | 0.26, no blur | **0.58, blur 4px** |
| Inner glow | 0.42, no blur | **0.36, blur 9px** |
| Brightness | 1.30 | **1.20** |

The blur is what makes the rest necessary. Masking happens before filtering, so
`blur()` spreads the masked 1px line *outward* into a soft band rather than
being clipped back to it — the ring stays the geometry and the blur becomes the
light. But spreading the same light over more pixels makes it read brighter per
unit of opacity, so the gain and the opacity both come down or the "subtle"
version ends up louder than the hard one it replaced.

The stroke still sits above the package's `0.26`, for the reason it always did:
the package's demo is a hairline on near-black at full width, this is a soft
band on a 320px card over the console's `--background-200`. The inner glow now
sits *below* the stroke and blurs more than twice as wide, so the two read as
one light falling off rather than as two concentric rings.

The blur radius is carried per layer in `--asst-beam-blur` and repeated in
every hue keyframe. That repetition is load-bearing: `filter` is a single
property, so the hue drift animating it would otherwise animate the blur away
on the first frame.

### `fading` is a real state

`orbThinking()` publishes `body[data-asst-thinking]` with three values, not two.
The comet's angle is a spun custom property, so cutting the animation the
instant thinking ends would snap it back to 0° in full view. `fading` holds the
spin through the 500ms fade-out, so the comet keeps travelling while it dims —
which is what the React component's `data-fading` is for.

The card's own violet hairline goes transparent while the beam is lit, so the
beam owns the edge instead of running as a second ring just inside it.

### FR-91

This is the one place in the console where ramp colours appear off-ramp: the
beam sweeps through amber and green, which the rating ramp owns, and it is not
in the violet lane FR-91 reserves for machine claims. That was specified
deliberately after the trade-off was raised. It reads as chrome on the card's
edge rather than as a value in the data, and it only runs while the assistant
is composing. Switching to the violet lane means editing the nine blob colours
in the two `.asst-card::before` / `::after` gradient lists.

Under `prefers-reduced-motion: reduce` the beam does not run at all — an effect
whose entire content is motion has nothing to show without it, and the orb
still carries the state.

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
follow-ups under each reading lead back to the intent registry. The companion
wears the same orb as the card, so the dwell reads as consideration rather
than as a wait: the ring says how long is left, the orb says the time is being
spent on something.

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

Ten, across the three insights tabs:

| Tab | Panels |
|---|---|
| Delivery | delivery funnel, delivery over time, failure reasons |
| Responses | the rating question, follow-up by band, the word cloud, open text |
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

The card is a fixed **320 × 288**. The answer region scrolls inside it, and the
follow-ups and the composer stay pinned to the bottom edge, so an answer never
changes the card's footprint or shifts the console behind it. While text streams, the view
follows the caret; when the answer lands it settles back to the top so it reads
from the first line. Whichever edge the content overflows is faded, so a cut
line reads as "more this way" rather than as a clipped render.

It mounts on `document.body`, not `#app` — `renderShell()` replaces
`#app.innerHTML` on every rerender, which is the same reason `toastHost()`
lives there. `renderBuilder()` mounts it separately, because the wizard is
full-screen focus mode and renders its own chrome instead of calling
`renderShell()`.

---

## The typed question

The composer at the foot of the card routes through `route()` in
`assistant-answers.js`, which matches the typed text against each intent's
`keywords` and returns the first hit — falling back to `overview`, so it never
dead-ends. The reply is then composed by the same function a follow-up button
would have called, which is the point: **the box is a second way in, not a
second answer engine.** It cannot print a figure the buttons would not also
print, and it cannot answer a question no composer covers.

That is a real ceiling, and the placeholder is deliberately narrow about it
("Ask about this screen…") rather than inviting anything. The header takes the
question verbatim once it is sent — with the box cleared, it is the only thing
left saying what the answer below it answers.

Two interactions the box shares a keyboard with:

- **Escape** clears a half-typed question first, and only closes the card on a
  second press. A modal still owns Escape outright while one is open.
- **Arming the pointer** blurs the box, because the mouse has become the input
  device; sending a typed question disarms the pointer for the same reason.

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
| `assets/js/assistant-orb.js` | the Siri-style orb — the two states, the renderer, and the state broadcast |

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
