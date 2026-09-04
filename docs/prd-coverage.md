# PRD coverage — where each requirement lives

Prototype: static HTML/CSS/JS, dark, Supabase design system (`DESIGN.md`).
PRD: `docs/prd-v5.md` — 110 requirements, 21 open decisions.

Files: `index.html` (dashboard) · `builder.html` (six-step wizard) · `insights.html`
(the campaign data screen). Logic in `assets/js/`, tokens and primitives in
`assets/css/supabase.css`. What the data screen can show, by campaign kind:
`docs/insights-data-plan.md`.

---

## 1. What changed against the Magic Patterns build

The Magic Patterns export implements an **earlier revision** of the PRD. It is built
throughout on a **split food-quality / delivery-experience rating pair**. The PRD's
current revision replaces that with a **single generic app-experience rating**, and the
prototype is rebuilt accordingly. Everything below is a real behavioural change, not a
restyle:

| # | Magic Patterns | This prototype | Requirement |
|---|---|---|---|
| 1 | Dashboard columns `Avg delivery rating` + `Avg food rating` | One `Avg rating` column | FR-74 |
| 2 | Rating ramp hardcoded to 1–5 stars (`RATING_RAMP` with `★` labels) | Ramp normalises to whatever the campaign uses — star 1–5, NPS 1–5, NPS 1–10 — and the legend names the element | FR-79, FR-89 |
| 3 | `RATING_BLOCKS` — two distribution blocks, "How was your delivery experience?" and "How was the food quality?" | One `RATING_BLOCK`, one distribution, one mean, no composite | FR-99 |
| 4 | Impact tab is a **2×2 attribution matrix** (`QUADRANTS`: food low/high × delivery low/high) | Impact tab is a **score driver breakdown** — one row per theme with its low-band/high-band split, ranked by score drag, owning team, and a route action | FR-106, FR-107 |
| 5 | Themes carry `avgDelivery` **and** `avgFood` | Themes carry one `avgRating` | FR-103 |
| 6 | Open responses carry `delivery` and `food` scores | One `rating` per response | FR-101, FR-102 |
| 7 | Variant results compared on `avgDelivery` and `avgFood` | Compared on one `avgRating` | FR-108 |
| 8 | Owning team fixed per quadrant | Owning team **configurable per theme**, since attribution now keys off theme | FR-106 |
| 9 | No low-sample handling anywhere | Below 100 responses, percentages are withheld and raw counts shown, with a note | FR-94 |
| 10 | Sort option labelled "Lowest delivery rating" | "Lowest average rating" | FR-84 |

Two further gaps closed: **FR-30/31/33** (template search, filter dropdown with a live
count, and a zero state with a route back) are present and wired, and **FR-110** exports
name their filter state, version boundaries and question wording explicitly.

The seed data was rewritten for the new model. It is no longer about food and riders —
the campaign now asks about the **app experience**, which is what a single generic rating
is for, and the themes (performance, tracking, onboarding, support) follow from it.

---

## 2. Requirement map

### Flow architecture

| FR | Where |
|---|---|
| FR-1 Forward progression gated | `builder.js` → `advance()`; Next surfaces `validateStep` issues instead of moving |
| FR-2 Backward navigation unrestricted | `store.setStep` recomputes `completedSteps` without clearing later data |
| FR-3 Destructive backward edits warn | `builder.js` → `guardedUpdate()`, names exactly what is lost |
| FR-4 Progress persists as draft | `store.js` → `localStorage`, resumes at `currentStep` |

### Campaign dashboard

| FR | Where |
|---|---|
| FR-71 Landing screen | `index.html` |
| FR-72 New Campaign is the only route in | `dashboard.js` → `[data-act="new"]`, present in the empty state too |
| FR-73 Section framing | Heading plus the one-line explanation of live-vs-completed |
| FR-74 Columns | Campaign · Status · Trigger · Responses · Avg rating · Updated · Clone · Open |
| FR-75 Campaign identity | Name in emphasis, ID beneath in mono, `user-select:all` |
| FR-76 Status pill | `.pill[data-status]` — label carries the meaning, dot reinforces |
| FR-77 Trigger in plain language | Mono `event + delay`; divergent variants show `multiple triggers` + a badge |
| FR-78 Responses is a count | `count()`, thousands-separated |
| FR-79 Avg rating on the shared ramp | `ratingValue(value, scaleMax)` — one decimal, scaled to the campaign's element |
| FR-80 Updated is relative | `relativeTime()` with the exact timestamp on hover |
| FR-81 Clone | Draft copy, content/audience/trigger only; schedule and responses dropped |
| FR-82 Open vs Resume | Draft/Scheduled → builder; Live/Paused/Completed/Stopped → insights |
| FR-83 Row-level version indicator | `v2` badge with a tooltip naming the version count |
| FR-84 List conventions | Scoped search, column visibility, sort, footer count; default sort most recent |
| FR-85 Empty state | Explains what a campaign does; toggle it via the footer link |

### Application shell

| FR | Where |
|---|---|
| FR-58 Persistent nav rail | `shell.js` → `navRail()`; active state uses background + weight + inset marker |
| FR-59 Secondary column | **Not built** — OD-14 resolved as one column (see §3) |
| FR-60 Status badges | `BETA` in the AI accent, never a data colour |
| FR-61 Collapsible | Persists in `store.state.navCollapsed` |
| FR-62 Context bar | Workspace / app switchers, always-visible environment indicator, search, help |
| FR-63 List conventions | `.toolbar` + `.card-foot` count that tracks filter state |
| FR-64 Six steps, no scrolling | `.stepper` with `flex:1` tracks |
| FR-65 Three states without colour | Fill, weight and glyph (check / lock / number) carry it |
| FR-66 Completed clickable, locked not | `advance()`; a locked click surfaces the blocking field |
| FR-67 Stepper persists on scroll | `.builder-head` is fixed, `.scroll` moves beneath it |
| FR-68 Save-and-exit + draft state | Header dot: unsaved / last-saved / nothing yet. `Save draft` in the footer saves and stays; save-and-exit is the exit dialog's primary action |
| FR-69 Validation summary | Inline list on a failed advance; the step is marked `needs attention` in the rail |
| FR-70 Variant tabs subordinate | `.tabs-sub`, a visible level below the step rail |

### Steps 1–3

| FR | Where |
|---|---|
| FR-5 Template determines the flow | `GOALS`; Sale Push hides Ratings and Lead-Gen categories, Churn pre-enables branching |
| FR-6 Create Template disabled | `aria-disabled`, `tabindex="-1"`, "Coming soon", not selectable |
| FR-7 Labelled distinctly | Step 1 reads "Start from" / "What do you want to find out?" |
| FR-8 Campaign name | Required, blocks advance |
| FR-9 App multi-select | At least one; drives which channels appear in step 4 |
| FR-10 Campaign type | Regular / A/B / Intelligent A/B → tab structure and weightage controls |
| FR-11 Channel not chosen here | Stated inline, with the reason |
| FR-12 Audience modes | All users / Segmented / User Data Table |
| FR-13 Rules visible at selection | Each segment card shows its rule and size |
| FR-14 Full rule builder inline | `openSegmentCreator()` — match all/any, add/remove conditions |
| FR-15 Saves to the shared library | Name required; appears in the list and is selected on save |
| FR-16 Exclusion is a dropdown | Multi-select by repeated selection, removable chips |
| FR-17 Exclusion after inclusion | Included / Excluded / Estimated reach; empty audience blocks publish |
| FR-18 Rolling enrolment, per-user lock | Explained on the step |

### Beyond the PRD — the campaign objective and the wizard rail

Two additions on the creation flow that the PRD does not ask for. Both are
listed here so a reader checking the map against `prd-v5.md` does not go
looking for the requirement behind them.

| Addition | Where | Why |
|---|---|---|
| **Campaign objective** — free text at the foot of step 1, carried through save, clone and publish, shown again on the step 6 summary and as a line on the dashboard row | `objectiveSection()` in `builder.js`; `objective` on the draft and on the campaign row in `store.js` | FR-5 records the goal a campaign starts *from*; nothing records what it is *for*. The assistant quotes it (`objectiveAnswer` in `assistant-answers.js`) instead of inferring intent from a goal id and a trigger, and the next person to open the draft reads it instead of guessing |
| **A keyword read of the objective**, offering the goal it matches | `suggestGoalFromObjective()` in `store.js`, `OBJECTIVE_SIGNALS` in `data.js` | Written as a word list, not a model, and consistent with the rest of the prototype: it is offered in the AI accent (FR-91), it names the goal it read, and it never changes the draft on its own. A tie between two goals is treated as no reading at all |
| **The wizard opens with the rail collapsed** to the icon strip, remembering its own state separately from the console's | `builderNavCollapsed` in `store.js`; `wireRailCollapse(root, rerender, key)` in `shell.js` | FR-61 makes the collapse persistent but says nothing about a default. The Content step is the widest surface in the product and the rail's 152px of labels are worth less there than anywhere else, so the builder starts collapsed rather than inheriting the console's answer |

The objective is deliberately **not** validated. FR-1 gates on configuration,
and a blocked advance on a free-text field is the fastest way to collect the
word "asdf". The cost of leaving it empty is stated instead — on step 1, on the
step 6 summary, and in what the assistant is able to answer.

### Step 4 — Content

| FR | Where |
|---|---|
| FR-19/20 Tab count by type | `reconcileVariants()` |
| FR-21 Independent variants | Every field is per-variant |
| FR-22 Nameable, drives the tab | Live on input |
| FR-23 Rename never versions | Stated under the field |
| FR-24 Weightage above the picker | Visual order enforced |
| FR-25 Intelligent A/B AI weightage | Even split shown, AI-managed, in the AI accent |
| FR-26 Four category tabs | Ratings default for User Feedback |
| FR-27 Grouped by composition | Labelled row with a divider per group |
| FR-28 Device-framed cards | `.device` preview per component |
| FR-29 Unsupported hidden, not disabled | Channels filtered by app; templates by channel; elements by `supports` |
| FR-30 Search | By name or ID, as you type |
| FR-31 Filter + count | "Showing All Templates" / "Showing: N Templates" |
| FR-32 Hover reveals the action | `.tpl-hover` → "Use This Template" |
| FR-33 Empty state | Zero state with "Clear search and filter" |
| FR-34 Switching template warns | Names both template IDs and what is lost |
| FR-35 Add-content modal | Lists only what the component can render; inserting closes it |
| FR-36 Element library | Image, thumbs, NPS, star, MCQ, text |
| FR-37 Values not layout | Copy and choices are editable; structure is fixed |
| FR-38 NPS default | Pre-selected; star is a swap |
| FR-39 NPS scale | 1–5 or 1–10, higher is more positive |
| FR-40 Branching off by default | Toggle; turning it off after configuring warns first |
| FR-41 Bands by scale | `bandRange()` — 1–3/4–7/8–10, or 1–2/3/4–5 |
| FR-42 Branch questions + choices editable | A/B/C chips, add, remove, reorder |
| FR-43 Q1 · Q2 · Q3 | Q3 always present regardless of branch |
| FR-44 Per-variant trigger, delay as text | Whole-number validation inline |
| FR-45 Copy triggers by variant name | Dropdown lists variants with their trigger; divergence is flagged |

### Steps 5–6 and versioning

| FR | Where |
|---|---|
| FR-46 Now / Later | Date and time disabled under Now |
| FR-47 Never / End on | End must be after start |
| FR-48 Never runs until stopped | Manual Stop on the insights page |
| FR-49 Re-entry | Toggle, off by default, reconciled against FR-18 |
| FR-50 Mobile preview | Real configured questions, not placeholders |
| FR-51 Test send | Saved-account dropdown **or** a directly entered user ID |
| FR-52 Test sends excluded | Stated on the step |
| FR-53 Publish is terminal | Step 6 only |
| FR-54 Branch simulation | Tap a rating to walk that band's path |
| FR-55 Live campaigns editable | Edit from the insights header |
| FR-56 Any edit versions | Publish on a live campaign increments and warns |
| FR-57 Versions flagged | Version filter, chart boundary, per-response `v` label |

### Insights

| FR | Where |
|---|---|
| FR-86 Header | Name, ID, status, kind, channel, trigger, audience, dates + Pause/Resume, Stop, Edit, Export |
| FR-87 Edit warns about versioning | Names the version it would create |
| FR-88 Tabs, state in the URL | `?id=…&tab=…`. **Three, and the set is the campaign kind's**: Delivery / Responses / Impact for feedback, Delivery / Engagement / Impact for an announcement. A tab the kind does not have falls back to Delivery |
| FR-89 Persistent rating legend | Scaled to the campaign's element, on every tab. Absent on an announcement, which has no rating for it to legend |
| FR-90 Monospaced numerals | `.num` / `.mono`, tabular figures |
| FR-91 AI visually separated | `--ai` violet, absent from ramp and status palettes |
| FR-92 Global filters | Date, segment, app, variant, version — persist across tabs |
| FR-93 Version boundaries | Dashed rule on the chart, banner while unfiltered |
| FR-94 Low-sample suppression | Under 100 responses — or, on an announcement, 100 reached — counts replace percentages |
| FR-95 Delivery funnel | Sent → Shown → Started → Completed (feedback); Sent → Delivered → Shown → Tapped (announcement). Largest drop called out |
| FR-96 Delivery over time | Stacked sends against the kind's terminal step, with the version boundary |
| FR-97 Failure reasons | Broken out by reason |
| FR-98 Per-question breakdown | Rating on the ramp, MCQ ranked with counts and shares |
| FR-99 One overall rating | One block, one distribution, one mean |
| FR-100 Branch path visibility | Per-band card with its own path count |
| FR-101 Open text | A word cloud over the whole response base — size is mention count, colour is the mean rating on the shared ramp — above a list searchable and filterable by rating band. Clicking a term filters the list |
| FR-102 Response detail | Full answer set in order, with response ID, user ID, segment and order context. A repeat respondent's other verbatims are listed with it |
| FR-103 AI theme clustering | **Not surfaced** — the Themes tab was removed from the prototype |
| FR-104 Theme drill-down | **Not surfaced** — removed with the Themes tab |
| FR-105 Theme reliability | **Not surfaced** — removed with the Themes tab |
| FR-106 Score driver breakdown | Low/high band split, ranked by score drag, owner per theme |
| FR-107 Driver actions | Export, filtered link, or ticket — filter pre-applied |
| FR-108 Variant comparison | Completion rate and rating (feedback); tap-through, orders and revenue per recipient (announcement). Flagged when triggers diverge |
| FR-109 Intelligent A/B weighting | Current weights with history |
| FR-110 Export | Carries filter state, version boundaries, and question wording — or creative and attribution window on an announcement |

---

## 3. How the 21 open decisions were resolved

Resolutions inherited from the Magic Patterns build are marked **(MP)**. Every one is a
prototype choice, not a PRD ruling — overrule any of them.

| OD | Resolved as | Why |
|---|---|---|
| OD-1 | Channel is a control **above** the category tabs, inside the Content step | The reference screens imply channel precedes the grid; keeps FR-11's deferral intact |
| OD-2 **(MP)** | Re-entry toggle on Schedule, **off** by default; re-entry keeps the original variant lock | Adds responses without re-bucketing, so FR-18 still holds. Flagged inline as unresolved |
| OD-3 | Versioning on publish, post-publish only | Pre-publish edits and tests do not version, so a draft cannot generate noise |
| OD-4 | A weightage change **is** an edit and versions | It shifts Impact attribution; rename stays exempt per FR-23 |
| OD-5 **(MP)** | Test is **not** a hard gate; the preview simulates branches | Stated on step 6; branch tap-through is live |
| OD-6 | AI weights visible, not overridable | Shown on Content and on Impact with history |
| OD-7 | Version boundaries respected on Delivery and Responses; Impact carries the banner | Impact drives routing, so it must not silently blend versions |
| OD-8 | Segment thresholds are platform-wide | Rules are shown read-only at selection; no per-campaign override |
| OD-9 **(MP)** | Six steps, Test & Publish its own step | Confirmed |
| OD-10 | No hard cap on questions | Add-content is unbounded; worth revisiting |
| OD-11 | The "create" tile is the same disabled Create Template as FR-6 | One affordance, one state |
| OD-12 **(MP)** | Star branching stays always-on; NPS stays opt-in | Preserved as-is, with the toggle disabled and explained under star |
| OD-13 | "Campaign" throughout; "journey" never appears | One vocabulary |
| OD-14 **(MP)** | **One** nav column | A wizard has no sub-sections; the Content step needs the ~250px |
| OD-15 **(MP)** | Builder is **full-screen**, outside the shell, with an exit control | Protects focus; the stepper supplies orientation |
| OD-16 | Stepper **and** a Back button | Stepper for jumps, Back for the linear path |
| OD-17 **(MP)** | Save-and-exit returns to the campaign list | Where drafts are discoverable |
| OD-18 **(MP)** | Templates is step 1 **inside** the wizard | Keeps the flow at six steps and OD-9 consistent |
| OD-19 | Desktop-first | Layouts reflow to tablet; the Content step is not designed for phones |
| OD-21 | Clone lands the user **in the new draft** | Confirmed in a dialog before cloning |
| OD-22 | Respondent is **pseudonymous** — response ID, segment, order context; no name or contact | Stated on the response detail; Export inherits it |

---

## 4. Known limits

- Data is seeded and in-memory; `localStorage` persists it per browser. The dashboard
  footer has a reset link.
- The insights page always renders the seeded `CMP-4821` dataset whichever campaign row
  opened it. Only the header, rating scale and version banner follow the row.
- Nested rule groups in the segment builder are stubbed with a toast.
- Export and Route describe what would happen; no file is produced.
- Webfonts (Inter, JetBrains Mono) load non-blocking from Google Fonts. Offline, the
  system stack renders and nothing else changes.
