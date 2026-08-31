# The campaign data screen — what can be on it

What happens when a user clicks a campaign row, and every data point that can
land on the screen that opens. Companion to [`prd-v5.md`](prd-v5.md) §12
(FR-86 – FR-110) and [`prd-coverage.md`](prd-coverage.md).

The screen is specified as **three layers**: a base every campaign shows, and
one of two payload layers chosen by what the campaign actually asked people to
do. A feedback campaign collects answers. An announcement campaign collects
none — nobody "responds" to a sale push — so half of the feedback screen is not
merely empty for it, it is meaningless.

Every row below carries a status:

| | |
|---|---|
| **Live** | rendered before this change |
| **Added** | built and seeded in this change |
| **Needs data** | specified here, no source yet — requires SDK or backend instrumentation |

---

## 0. What a click resolves to

`Open` on a campaign row routes on **status** first, then the screen routes on
**kind** (FR-82).

| Status | Click goes to |
|---|---|
| Draft, Scheduled | Builder, at the step where it was left — the button reads *Resume* |
| Live, Paused, Completed, Stopped | This data screen, at `insights.html?id=<id>&tab=<tab>` |

**Kind** is derived from the campaign's goal (step 1 of the builder), not from a
separate field the user has to set:

| Goal | Kind | Because |
|---|---|---|
| `user-feedback` | `feedback` | Rating element + question logic |
| `churn-rate` | `feedback` | Same, with branching pre-enabled |
| `sale-push` | `announcement` | Push channel; rating and text elements are hidden at authoring time |

The kind decides the tab set, the funnel's terminal step, the headline metric,
and whether the rating ramp is on screen at all.

| Kind | Tabs |
|---|---|
| Feedback | Delivery · Responses · Impact |
| Announcement | Delivery · Engagement · Impact |

Delivery and Impact are on both, but their contents differ — Impact especially:
for feedback it answers *what is pulling the score down and who owns it*, for an
announcement *did this campaign make anybody do anything*.

---

## Layer 0 — the base, on every campaign

### 0.1 Header — identity and state (FR-86)

| Data | Status | Note |
|---|---|---|
| Campaign name | Live | |
| Campaign ID `CMP-xxxx` | Live | Selectable for support (FR-75) |
| Status pill | Live | Draft · Scheduled · Live · Paused · Completed · Stopped |
| **Kind badge** | Added | Feedback / Announcement — a reader must know which screen they are on before the tabs surprise them |
| Version count | Live | Badge when > 1 (FR-83) |
| Trigger | Live | `order_delivered + 20 min`, or `multiple triggers` when variants diverge (FR-45, FR-77) |
| Audience summary | Live | Segments and exclusion count |
| Running dates | Live | |
| **Channel** | Added | Push / In-app / Web — decides which engagement metrics can exist at all |
| **Apps** | Needs data | Android · iOS · Web; on the draft, not yet on the campaign row |
| Campaign type | Live (implicit) | Regular / A-B / Intelligent A-B — drives the variant panels |
| Headline volume | Live | Responses (feedback) · Reach (announcement) |
| Actions | Live | Pause / Resume · Stop · Edit · Export |

### 0.2 Filters — apply across every tab and persist between them (FR-92)

Date range · Segment · App · Variant · Version. All **Live**.

### 0.3 Cross-cutting rules

| Rule | Status | Note |
|---|---|---|
| Version boundary notice (FR-93) | Live | An aggregate spanning a question change is labelled, never presented as one series |
| Low-sample suppression (FR-94) | Live | Under 100 responses, percentages are withheld and raw counts shown |
| Rating legend (FR-89) | Live | Feedback only — an announcement has no rating, so the ramp must not appear |
| AI accent (FR-91) | Live | `#a78bfa`, machine inference only, never a measurement |
| Monospaced numerals (FR-90) | Live | |
| Export carries filter state, version boundaries, question wording (FR-110) | Live | |

### 0.4 Delivery tab — shared shape, different steps

The funnel's first two steps are the same for every campaign; the tail is the
kind's own definition of success.

| Data | Status | Note |
|---|---|---|
| Funnel with step-to-step conversion (FR-95) | Live | Steps differ by kind — see 1.1 and 2.1 |
| Largest drop-off called out | Live | |
| Delivery over time (FR-96) | Live | Sends + the kind's terminal step, version boundary marked |
| Failure reasons (FR-97) | Live | Opt-out · invalid token · uninstalled · suppressed by exclusion |
| Delivery by app / OS version | Needs data | The seeded themes already blame Android 12–13; the delivery data cannot confirm it |
| Delivery by city / segment | Needs data | |
| Send throughput and rate limiting | Needs data | Whether a slow send, not a bad message, explains a weak first day |
| Quiet-hours suppression | Needs data | Distinct from opt-out: sent later, or not at all |

---

## Layer 1 — feedback campaigns

The rating element (FR-38/FR-39) is the spine: one rating, one distribution, one
average. No composite or secondary score is ever displayed (FR-99).

### 1.1 Delivery funnel steps

`Sent → Shown → Started → Completed` — **Live**.

### 1.2 Responses tab

| Data | Status | Note |
|---|---|---|
| Rating question wording | Live | |
| Rating element and scale | Live | Star 1–5 · NPS 1–5 · NPS 1–10 |
| Full distribution per score, on the ramp (FR-98, FR-99) | Live | |
| Mean rating | Live | |
| Response count | Live | |
| Band split — detractor / passive / promoter | Live (implicit) | Visible through the branch blocks; not stated as three figures |
| **True NPS score** (% promoters − % detractors) | Needs data | For an NPS 1–10 campaign the mean is *not* the metric the business reports. Worth deciding: see OQ-1 |
| Branch paths, count per path (FR-100) | Live | Each band's follow-up read inside its own path, never pooled |
| Per-branch option distribution | Live | |
| Multiple-choice blocks, ranked with counts and shares (FR-98) | Live | Currently only as branch follow-ups |
| Open-text list, searchable (FR-101) | Live | |
| Open-text filters: rating band, version | Live | |
| Per-response: rating, band, segment, variant, version, timestamp | Live | |
| Response detail — full answer set in order (FR-102) | Live | Pseudonymous, with order context (OD-22) |
| Rating trend over time | Needs data | The average is a single number today; whether it is moving is unanswerable |
| Partial vs complete responses, drop-off per question | Needs data | The funnel stops at Completed and cannot say which question lost them |
| Time to complete | Needs data | |
| Response rate against audience size | Needs data | Responses ÷ eligible, not ÷ sent |
| Rating split by segment / app / version | Needs data | The filters imply it; there is no per-cut breakdown panel |

### 1.3 Impact tab

| Data | Status | Note |
|---|---|---|
| Score drivers, one row per theme (FR-106) | Live | |
| Per driver: volume, share, low/high band split, avg rating, score drag | Live | |
| Owning team, configurable per theme (FR-106) | Live | Engineering · Product · CX · Growth · City Ops |
| Route action (FR-107) | Live | Export · filtered link · ticket |
| Variant comparison — completion rate, avg rating, responses (FR-108) | Live | Flagged not-like-for-like on divergent triggers |
| Intelligent A/B weight history (FR-109) | Live | |
| AI suggestions | Live | In the reserved accent |
| Themes tab — clusters with volume, trend, examples (FR-103) | Needs data | Removed from the prototype; `THEMES` is seeded and unused by the page |
| Theme drill-down to member responses (FR-104) | Needs data | Removed with it — every AI claim should be traceable to raw text |
| Theme reliability / unclustered bucket (FR-105) | Needs data | `confidence` is seeded; nothing reads it |

---

## Layer 2 — announcement campaigns

No rating, no questions, no respondents. The reader's question is not *what did
people say* but *did anybody act, and was it worth what it cost*. Everything in
this layer is **Added** unless marked otherwise.

### 2.1 Delivery funnel steps

`Sent → Delivered → Shown → Tapped`. Delivered is the step feedback campaigns
never needed: a push can be accepted by the OS and still never be surfaced.

### 2.2 Engagement tab — replaces Responses

| Data | Status | Note |
|---|---|---|
| Impressions | Added | |
| Unique reach | Added | Distinct users, not sends — a user hit twice is one reach |
| Taps | Added | |
| Tap-through rate | Added | Of shown, not of sent — the honest denominator |
| Dismissals and dismissal rate | Added | The deliberate no, distinct from silence |
| Ignored | Added | Neither tapped nor dismissed: the residual |
| Time-to-tap distribution | Added | Under a minute … over a day. Tells you whether the trigger delay is right |
| Tap destination breakdown | Added | Primary CTA · secondary CTA · body — which part of the creative did the work |
| Engagement by app | Added | Android · iOS · Web |
| Engagement by segment | Added | |
| **Opt-outs caused by this campaign** | Added | The cost side of reach. A campaign that converts 2% and mutes 4% is a loss |
| Frequency — users who saw it more than once | Needs data | |
| In-app view duration / scroll depth | Needs data | Interstitials only; push has no such signal |
| Engagement by hour of day | Needs data | |

### 2.3 Impact tab — replaces score drivers

| Data | Status | Note |
|---|---|---|
| Post-tap conversion funnel | Added | `Tapped → Landed → Added to cart → Order placed` |
| Conversion count and rate | Added | |
| Attributed revenue and AOV | Added | |
| Attribution window | Added | Stated on the panel — an unstated window makes the number unreadable |
| **Holdout lift** | Added | Converted % in the audience vs. a held-back control. The only figure that survives the question *would they have ordered anyway* |
| Offer redemption — code, redemptions, rate, discount cost | Added | |
| Net revenue after discount | Added | |
| Revenue per recipient | Added | The metric that makes two variants with different reach comparable |
| Variant comparison — CTR, conversion, revenue per recipient (FR-108) | Added | Same not-like-for-like flag on divergent triggers |
| Intelligent A/B weight history (FR-109) | Live | Shared with the feedback layer, unchanged |
| AI suggestions | Added | Announcement-specific readings |
| Uninstalls in the attribution window | Needs data | The other cost signal |
| Cost per conversion / campaign spend | Needs data | Needs a cost input the builder does not collect |
| Repeat-purchase effect beyond the window | Needs data | Whether the offer bought a habit or a discount |

---

## What this change ships

1. `goal` on every seeded campaign and carried through publish, clone and resume
   — the field existed on the draft and was dropped at publish, so the screen
   had nothing to branch on.
2. `campaignKind()` — one derivation, imported by every screen that needs it.
3. Kind-aware header: kind badge, channel, and a headline metric that reads
   *Reach* instead of *Responses* where responses do not exist.
4. Kind-aware tab set, and the rating ramp suppressed on announcements.
5. Announcement seed data and two new tabs built on it.
6. A seeded announcement campaign in a readable state — the only one before this
   was Scheduled, which routes to the builder, so the announcement screen was
   unreachable by clicking.
7. Assistant composers for the new panels, so the companion reads them rather
   than going silent.

## Open questions

- **OQ-1 — NPS.** For an NPS 1–10 campaign, is the headline the mean (6.8) or
  the NPS score (% promoters − % detractors)? The two move independently and the
  business almost certainly reports the second. FR-99 says one distribution and
  one average; it does not say the average is the right headline.
- **OQ-2 — Themes.** FR-103 – FR-105 are specified, seeded, and not rendered.
  Restore the Themes tab, or fold clusters into Impact and close the FRs?
- **OQ-3 — Holdout.** Lift is the only trustworthy impact number, but nothing in
  the builder reserves a control group. Does the Audience step need a holdout %?
- **OQ-4 — Mixed campaigns.** A push that carries a thumbs-up element is an
  announcement that collects one answer. Two kinds may eventually need to be a
  capability set rather than an enum.
