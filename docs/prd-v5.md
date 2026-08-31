# InsightHub — Feedback Campaign Builder
## Product Requirements Document — v2

**Product:** Netcore InsightHub
**Feature:** Campaign creation flow (feedback-first)
**Primary persona:** Prashant — PM at QuickEats, first-time InsightHub user
**Status:** Draft v2 — updated against InsightHub UI references
**Requirements:** 110 · **Open decisions:** 21 (see Section 10)

> Requirement IDs are **append-only**. New requirements take the next free number regardless of where they sit in the document, so existing references never shift. Section order is the reading order; numeric order is the history.

**Changes from v1:** template picker specified against live UI patterns; weightage moved ahead of component selection; delay changed to text input; NPS set as default rating element with branching off by default; MCQ editor specified; schedule rebuilt as Now/Later + Never/End-on; test-account selector added to step 6; application shell and horizontal stepper added (Section 2A); campaign dashboard and insights page added (Sections 1A and 12).

**Changes in this revision:** rating model changed from a split food-quality/delivery-experience pair to a single generic app-experience rating, reflecting a use case beyond order feedback. Revised: FR-74, FR-79, FR-89 (generic "Avg rating," scale-agnostic ramp), FR-99 (single rating block, replacing split rating blocks), FR-106–107 (score driver breakdown replacing the attribution matrix, since attribution now keys off theme rather than a second rating axis). OD-20 resolved as moot.

---

## 1. Overview

### 1.1 Problem

Prashant thinks in **questions** ("why are repeat orders dropping in Bandra?"). The tool thinks in **channels** ("create a push notification"). A first-time user arriving at a channel-first builder has to translate their question into a delivery mechanism before they can do anything, and most get it wrong.

### 1.2 Approach

The builder inverts the starting point. The user begins at a **template** representing an objective, and component selection is deferred to the Content step — by which point audience and campaign type are known, so the builder can hide components and elements that can't serve the configuration.

### 1.3 Scope

**In scope:** the six-step wizard, its branching logic, variant handling, post-publish edit versioning.

**Out of scope:** the Create Template authoring flow (present but disabled — FR-6), segment library management screens, the results dashboard (specified separately).

---

## 2. Flow architecture

```
1. Templates → 2. Campaign Details → 3. Audience → 4. Content → 5. Schedule → 6. Test & Publish
```

**FR-1 — Forward progression is gated.**
A user cannot advance to step N+1 until all required fields in step N hold valid values.
*Acceptance:* "Next" is disabled until validation passes. Clicking a future step in the rail while the current step is invalid does nothing and surfaces the blocking field.

**FR-2 — Backward navigation is unrestricted.**
*Acceptance:* Returning to step N and leaving without changes preserves all data in steps N+1 onward. Completed steps stay marked complete.

**FR-3 — Backward edits that invalidate downstream state must warn.**
*Acceptance:* A modal names what will be lost and requires explicit confirmation. Cancelling reverts.

**FR-4 — Progress persists as draft**, resumable at the step where the user left off.

---

## 1A. Campaign dashboard (home)

The default landing screen. Two jobs: start a new campaign, and get back into an existing one.

### 1A.1 Entry point

**FR-71 — The dashboard is the product's landing screen** for the campaigns area.

**FR-72 — New Campaign is the primary action.**
*Acceptance:* A single prominent button sits above the campaign list. Clicking it opens the template gallery, which begins the creation flow. It is the only route into campaign creation. Whether the gallery is step 1 of the stepper or a pre-step: see **OD-18**.

### 1A.2 Your Campaigns list

**FR-73 — Section framing.**
*Acceptance:* The list carries a heading and a one-line explanation of what the two campaign states are for — monitoring a live campaign versus reading a completed one's insights — so a first-time user knows what opening a row will give them.

**FR-74 — Columns.**
Campaign · Status · Trigger · Responses · Avg rating · Updated · Clone · Open.
*Acceptance:* Column set and order are consistent across all states.

**FR-75 — Campaign identity.**
*Acceptance:* Each row shows the campaign name in emphasis with its campaign ID beneath in a muted, smaller treatment. The ID is selectable for support and debugging.

**FR-76 — Status.**
Draft · Scheduled · Live · Paused · Completed · Stopped.
*Acceptance:* Status renders as a labelled pill with a state dot. It is legible without colour — the label carries the meaning, the dot reinforces it.

**FR-77 — Trigger column reads in plain language.**
*Acceptance:* Shows the event and delay as configured, e.g. `order_delivered + 20 min`, in a monospaced treatment so event names stay scannable. Where variants have divergent triggers (FR-45), the cell indicates multiple rather than showing only the first.

**FR-78 — Responses is a count, not a rate.**
*Acceptance:* Whole number, thousands-separated, in the numeral treatment used across the product.

**FR-79 — Avg rating uses the shared rating ramp.**
*Acceptance:* Rendered to one decimal place, coloured on the rating ramp used throughout the insights surfaces — scaled to whichever rating element the campaign uses, star or NPS (FR-39) — so a score reads identically here and inside the campaign.

**FR-80 — Updated is relative.**
*Acceptance:* Recent edits read as elapsed time ("4 minutes ago"); older ones fall back to an absolute date. Hovering reveals the exact timestamp.

**FR-81 — Clone.**
*Acceptance:* Clone creates a Draft copy with a distinguishing name, copying content, audience, and trigger configuration. Schedule and all collected response data are **not** copied. The user lands in the new draft. See **OD-21** on where clone drops the user.

**FR-82 — Open.**
*Acceptance:* Open takes a Live, Paused, Completed, or Stopped campaign to its insights page (Section 12). A Draft or Scheduled campaign opens the builder at the step where it was left instead — the label reflects this ("Resume").

**FR-83 — Row-level version indicator.**
*Acceptance:* Where a live campaign has been edited post-publish (FR-56), the row indicates that more than one version exists, so a reader knows the aggregate spans a change before they open it.

**FR-84 — List conventions.**
*Acceptance:* Search, sort, column visibility, and a total count follow FR-63. Default sort is most recently updated.

**FR-85 — Empty state.**
*Acceptance:* With no campaigns, the area explains what a campaign does and offers the New Campaign action directly, rather than showing an empty table with headers.


---

## 2A. Application shell

The builder sits inside a persistent SaaS console layout: navigation on the left, a horizontal step rail across the top of the working area.

### 2A.1 Left navigation

**FR-58 — Persistent primary navigation rail.**
A fixed left column carries the product's top-level destinations, each an icon plus label.
*Acceptance:* The rail is present on every screen including all six builder steps. The active destination is visually distinct through background, icon treatment, and weight — not colour alone. Related destinations are separated by hairline dividers into logical groups.

**FR-59 — Secondary contextual column.**
Where a destination has sub-sections, a second column lists them beside the rail, grouped under small-caps section headers (e.g. MANAGE, CONFIGURATION).
*Acceptance:* The column header names the parent destination. Group headers are non-interactive labels. Items link to a single sub-screen; items that navigate outside the current context carry an external-link affordance. See **OD-14** on whether the builder uses one column or two.

**FR-60 — Status badges on nav items.**
*Acceptance:* Items in limited release carry an inline badge (e.g. BETA) rendered in a distinct accent from the data palette, so a badge is never mistaken for a metric or a rating value.

**FR-61 — Collapsible navigation.**
*Acceptance:* A control collapses the panel to reclaim horizontal space. Collapse state persists across sessions. The Content step in particular needs the width.

**FR-62 — Context bar.**
A slim top bar carries the account/workspace and app switchers, environment indicator, global search, and help.
*Acceptance:* Switchers are dropdowns showing the current selection. The environment indicator is always visible, so a user configuring a live campaign can never mistake which environment they are publishing into.

**FR-63 — List-screen conventions.**
Campaign, segment, and template lists follow one pattern: scoped search with a field selector, a column visibility control, a sort control, a primary action button at top right, and a total count in a footer bar.
*Acceptance:* The footer count reflects filter and search state. Where the count is approximate it is labelled as estimated.

### 2A.2 Horizontal stepper

**FR-64 — The six steps render as a horizontal rail at the top of the working area.**
*Acceptance:* All six are visible simultaneously without scrolling at standard desktop widths. Each shows its number and label.

**FR-65 — Three step states, distinguishable without colour.**
Complete, current, and locked.
*Acceptance:* Complete steps carry a check affordance; the current step is emphasised; locked steps are visibly inert. State is legible in greyscale.

**FR-66 — Completed steps are clickable; locked steps are not.**
*Acceptance:* Clicking a completed step navigates there and preserves downstream data (FR-2). Clicking a locked step does nothing and surfaces the blocking field on the current step (FR-1).

**FR-67 — The stepper persists on scroll.**
*Acceptance:* The rail stays fixed while the Content step's long form scrolls beneath it, so the user never loses their position in the flow.

**FR-68 — Save-and-exit and draft state.**
*Acceptance:* A save-and-exit action is available from every step. A draft indicator shows unsaved or last-saved state near the stepper.

**FR-69 — Step-level validation summary.**
*Acceptance:* When a user attempts to advance from an invalid step, the blocking fields are surfaced inline and the step is marked as needing attention in the rail until resolved.

**FR-70 — Variant tabs are visually subordinate to the stepper.**
*Acceptance:* Inside the Content step, variant tabs sit below the step rail and read as a level down in the hierarchy, so the user never confuses "which variant am I editing" with "which step am I on."


---

## 3. Step 1 — Templates

**FR-5 — Template selection determines the downstream flow.**
Options: User Feedback, Sale Push Notification, Churn Rate.
*Acceptance:* Selecting a template sets defaults and available options for steps 2–5. Different templates produce demonstrably different Content-step option sets.

**FR-6 — Create Template is present but disabled.**
*Acceptance:* Visibly non-interactive, labelled "coming soon," cannot be selected or focused, does not count toward the required selection.

**FR-7 — Step-1 templates are labelled distinctly from step-4 content templates.**
*Acceptance:* Step 1 reads as "campaign goal" or "start from"; the word "template" is reserved for step 4. Neither users nor engineering should have to disambiguate two things sharing a name.

---

## 4. Step 2 — Campaign Details

**FR-8 — Campaign name.** Required, free text. Identifier across builder and dashboard.

**FR-9 — App selection.** Multi-select: Android, iOS, Web. At least one required.
*Acceptance:* Deselecting all blocks progression. App selection constrains which components appear in step 4.

**FR-10 — Campaign type.** Single-select: Regular, A/B Testing, Intelligent A/B. Required.
*Acceptance:* Determines tab structure (FR-19, FR-20) and whether weightage controls appear (FR-23, FR-24).

**FR-11 — Channel is not selected here.** Deferred to step 4 so the builder can hide unsupported elements at the moment of choice rather than locking a constraint three steps before its consequences are visible.

---

## 5. Step 3 — Audience

**FR-12 — Target audience selection.** One of: **All users**, **Segmented** (New / Repeat / Loyal / user-created), or **User Data Table**.

**FR-13 — Segment membership is rule-based.** e.g. a user becomes *Repeat* after 2 orders.
*Acceptance:* Rules are visible at the point of selection, so the user knows what "Repeat" means before targeting it.

**FR-14 — Inline segment creation.**
*Acceptance:* The inline creator offers the **full rule builder**, not a reduced version.

**FR-15 — Inline-created segments save to the shared library.**
*Acceptance:* A name is required before saving. The segment then appears in the Segmented list on subsequent campaigns.

**FR-16 — Exclusion is a dropdown.**
The user selects a list or segment to exclude from a dropdown control.
*Acceptance:* The dropdown lists existing lists and segments. Multi-select supported where more than one exclusion is needed. Empty state offers a path to create a segment.

**FR-17 — Exclusion is applied after inclusion.**
*Acceptance:* If exclusion empties the audience entirely, the user is warned before proceeding.

**FR-18 — Rolling enrolment with per-user lock at capture.**
The audience definition re-evaluates continuously. A user is enrolled the moment they first qualify; their assignment (including variant) locks at that point.
*Acceptance:* A user qualifying on day 30 of a running campaign is enrolled on day 30. A user enrolled as *New* who later becomes *Repeat* stays under their original assignment and is not re-bucketed. Re-enrolment behaviour: see **OD-2**.
*Rationale:* a start-time snapshot would make an evergreen campaign (FR-47) reach only launch-day users, then silently decay while appearing to run.

---

## 6. Step 4 — Content

### 6.1 Variant tabs

**FR-19 — Regular campaigns show one content tab.**

**FR-20 — A/B and Intelligent A/B show two tabs by default, extensible.**

**FR-21 — Each variant is independently configured** — content, component, template, questions, trigger, event, delay.

### 6.2 Variant name and weightage

**FR-22 — Variants are user-nameable, and the name drives the tab label.**
*Acceptance:* Editing the variant name updates the tab label live. Names are editable at any time including post-publish, and propagate to the results dashboard so variants read as "Free Delivery Coupon" rather than "Variant B."

**FR-23 — Renaming a variant does not create a new version** (contrast FR-56).

**FR-24 — Weightage is configured before component selection.**
*Acceptance:* Within a variant tab, weightage appears above the template/component picker in the visual order. Weights across variants must total 100%; default is an even split.

**FR-25 — Intelligent A/B: AI-managed weightage.**
Variants start at an even split; once a variant accumulates more engagement, the AI shifts weight toward it.
*Acceptance:* The even starting split is set before the campaign begins. Visibility/override: see **OD-6**.

### 6.3 Template and component picker

Modelled on the existing InsightHub template-selection pattern.

**FR-26 — Templates are organised under four category tabs.**
Basic Templates · Ratings Templates · Lead Generation Templates · Custom HTML Templates.
*Acceptance:* One tab is active at a time. For a User Feedback campaign, **Ratings Templates** is the default active tab.

**FR-27 — Within a category, templates are grouped by content composition.**
e.g. "Content with image notifications" and "Image only notifications," each rendered as a labelled row with a divider.

**FR-28 — Each template card represents a component/layout.**
Cover, Half-Interstitial, Interstitial, Header, Footer, Alert.
*Acceptance:* Each card shows a device-framed visual preview and the component name above it, so the user gets a visual sense of the format before selecting.

**FR-29 — Unsupported components and elements are hidden, not disabled.**
*Acceptance:* Where the selected channel or app selection cannot render a component (e.g. push notification cannot carry multiple choice or text input), that option does not appear in the grid at all. No error states for options the user could never have used.

**FR-30 — Template search.**
*Acceptance:* A search field filters by template ID or name. Results update as the user types.

**FR-31 — Template filter.**
*Acceptance:* A dropdown filters the grid (e.g. "Showing All Templates"). A count reads "Showing: N Templates" and updates with filter and search state.

**FR-32 — Hover reveals the primary action.**
*Acceptance:* Hovering a template card surfaces a "Use This Template" action over the preview.

**FR-33 — Empty state.**
*Acceptance:* When search or filter returns nothing, the grid shows a zero state rather than a blank area, with a route back to the unfiltered set.

**FR-34 — Switching template destroys existing content.**
*Acceptance:* A modal states that changing the template will result in loss of configured content and requires confirmation. Cancelling preserves the current template.

### 6.4 Element authoring

**FR-35 — Elements are added via an add-content modal.**
*Acceptance:* Clicking the add-content icon opens a modal listing all elements available for the current component. Clicking an element inserts it and closes the modal.

**FR-36 — Available elements.** Image, thumbs up/down, NPS rating, star rating, multiple choice, text field.

**FR-37 — The user edits values within the template, not layout.**
*Acceptance:* Template structure is fixed; the user changes copy, options, and media inside the provided slots.

### 6.5 Question logic

**FR-38 — NPS is the default rating element.**
*Acceptance:* On a Ratings template, NPS is pre-selected. The user can swap to star rating.

**FR-39 — NPS scale selection.** 1–5 or 1–10; the higher number is the more positive response.

**FR-40 — NPS conditional branching is off by default.**
A toggle asks whether follow-up questions should differ by rating band.
*Acceptance:* Default off. Enabling populates three multiple-choice question sets, one per band. Turning it off after configuring branch questions warns before discarding them.
*Rationale:* a 1–10 scale is used for more than feedback, so forced branching would be wrong in some campaigns.

**FR-41 — Branch bands by scale.**

| Scale | Detractor | Passive | Promoter |
|-------|-----------|---------|----------|
| 1–10 | 1–3 | 4–7 | 8–10 |
| 1–5 | 1–2 | 3 | 4–5 |

The 1–5 bands apply to a 5-point NPS scale and to the star rating element.

*Example:* a 1–3 response branches to "which areas can we improve?"; an 8–10 response to "how satisfied are you with the app?"

**FR-42 — Branch questions and their options are both editable.**
*Acceptance:* Each of the three branch questions exposes an editable question field (placeholder "Type here") and an editable list of choices. Each choice renders as a labelled chip (A, B, C…) with editable text. An "Add choice" action appends a new option. Choices can be removed and reordered.

**FR-43 — Standard question structure.**
- **Q1** — rating (NPS by default, or star)
- **Q2** — multiple choice, conditional on Q1's band when branching is enabled
- **Q3** — open text ("what can be done better?")

*Acceptance:* Q3 is always present regardless of branch. Ratings templates arrive with all three pre-populated and editable.

### 6.6 Trigger, event, delay

**FR-44 — Trigger, event, and delay are set per variant; delay is a text input.**
*Acceptance:* Each variant tab exposes its own trigger and event configuration. Delay is entered as a numeric text field with a unit, not selected from a fixed dropdown, so arbitrary values (e.g. 35 minutes) are possible. Invalid or non-numeric entry is blocked with inline validation.

**FR-45 — Triggers can be copied across variants.**
*Acceptance:* When configuring variant 2+, a dropdown lists existing triggers **by variant name**. Selecting one copies its trigger, event, and delay into the current variant.

> **Flagged risk:** different triggers per variant means an A/B test is no longer isolating content as the single variable — two variants on different triggers are effectively two campaigns sharing a name, and their results are not directly comparable. Confirmed as **intentional flexibility** for supporting different entry points to one goal. The results dashboard should flag variants with divergent triggers so the comparison isn't read as like-for-like.

---

## 7. Step 5 — Schedule

Modelled on the existing InsightHub entry-timelines pattern.

**FR-46 — Start is a radio pair: Now or Later.**
*Acceptance:* "Now" is the default. Selecting "Later" enables an adjacent date picker and time picker, both required. Date and time inputs are disabled while "Now" is selected.

**FR-47 — End is a radio pair: Never or End on.**
*Acceptance:* "Never" is the default and disables the end date/time inputs. Selecting "End on" enables and requires both. End must be after start.

**FR-48 — A "Never" campaign runs until manually stopped.**
*Acceptance:* An explicit manual stop control is available on the campaign after publish. Combined with rolling enrolment (FR-18), a Never campaign keeps enrolling users as they qualify, indefinitely.

**FR-49 — Re-entry control.** See **OD-2** — whether users can re-enter the campaign, and how that reconciles with the per-user lock in FR-18.

---

## 8. Step 6 — Test & Publish

**FR-50 — Mobile preview.**
*Acceptance:* Renders the configured content as it will appear on device, reflecting the selected component and the actual configured questions, not placeholders.

**FR-51 — Test send with recipient selector.**
*Acceptance:* A Test action sits alongside a dropdown offering saved **test accounts**, plus a field to enter a **user ID** directly. The test fires the configured campaign to that recipient only.

**FR-52 — Test sends are excluded from campaign results.**
*Acceptance:* Responses generated by a test send do not appear in the results dashboard or count toward delivery, response, or impact metrics. See **OD-4** if a visible test-response log is wanted instead.

**FR-53 — Publish is the terminal action of the wizard**, located on this step.

**FR-54 — Branch simulation in test.** See **OD-5** — whether preview is static or lets the builder tap through conditional branches to verify logic before publishing.

---

## 9. Post-publish editing and versioning

**FR-55 — Live campaigns remain editable** — content, audience, and schedule.

**FR-56 — Any edit creates a new version.**
*Acceptance:* Each edit to a live campaign increments the version and records a timestamp. Variant rename is exempt (FR-23).

**FR-57 — Versions are flagged on the results dashboard.**
*Acceptance:* Responses collected under different versions are distinguishable, so a question edited on day 10 of a 60-day campaign does not silently blend two different questions into one dataset.

> "Any edit" is a wide net — five copy polishes produce five versions. See **OD-3**.

---

## 10. Open decisions

| ID | Decision | Why it matters |
|----|----------|----------------|
| **OD-1** | Where is channel (push vs. in-app vs. web) chosen relative to the template grid? The reference screens show one grid scoped to push and another with Basic/Ratings/Lead-Gen/Custom-HTML tabs — implying channel is picked *before* the grid, not as a card inside it | Determines whether the Content step opens with a channel switch above the category tabs |
| **OD-2** | Re-entry: the reference schedule screen carries "Allow users to re-enter the journey." Does this exist here, and does enabling it override the per-user lock in FR-18? | Directly contradicts "never enrolled twice" if adopted unchanged |
| **OD-3** | Versioning granularity: per explicit save, post-publish only? Do pre-publish edits after a Test run count? | Determines dashboard version noise |
| **OD-4** | Does a **weightage change** (50/50 → 70/30) create a version? It shifts Impact-tab attribution without touching wording | Rename is exempt; weightage is a different case |
| **OD-5** | Is Test a hard gate before Publish, and does it simulate branches or only render static screens? | Static preview may not catch conditional-logic errors |
| **OD-6** | Intelligent A/B: can the user see or override live AI weighting, or is it autonomous? | Trust and control for a first-time user |
| **OD-7** | Version flag placement: Responses tab only, or must Impact (which drives team routing) also respect version boundaries? | Affects dashboard IA |
| **OD-8** | Segment thresholds ("2 orders = Repeat") — platform-wide or per-campaign? If per-campaign, does changing it re-bucket mid-flight? | Affects Audience UI and data model |
| **OD-9** | Confirm the stepper is 6 steps with Test & Publish as its own step | Sets the stepper rail on every screen |
| **OD-10** | Is there a cap on questions per campaign? | Unbounded add-content invites over-long surveys |
| **OD-11** | The push template grid shows a "Create New Push Notification" tile. Is that the same disabled Create Template from FR-6, or a live entry point? | Two conflicting states for the same affordance |
| **OD-12** | Star rating branching is always-on while NPS branching defaults off. Should star also get a toggle for consistency? | Two rating elements behaving differently is hard to explain |
| **OD-13** | Terminology: reference UI says "journey," this builder says "campaign" | Mixed vocabulary across one product |
| **OD-14** | One nav column or two? The reference pattern uses a primary rail plus a contextual column. A wizard has no sub-sections to fill a second column | Two columns costs ~250px the Content step needs |
| **OD-15** | Does the builder run inside the shell, or take over full-screen with only an exit control? | Full-screen protects focus; in-shell protects orientation |
| **OD-16** | Is the stepper purely a progress indicator, or also the primary means of navigating back? | Determines whether Back buttons are needed at all |
| **OD-17** | Does save-and-exit return to a campaign list, or to the dashboard? | Affects where drafts are discoverable |
| **OD-18** | Where does the top-level Templates step live — inside the wizard, or as a gallery screen the wizard launches from? | If it's a gallery, the stepper starts at Campaign Details and the flow is 5 steps, not 6 (bears on OD-9) |
| **OD-19** | Mobile/tablet: is the builder desktop-only? A six-step horizontal rail plus a template grid does not fold gracefully | Scope decision, cheaper to make now |
| **OD-21** | After Clone, does the user land in the new draft's builder, or stay on the dashboard with a new row added? | Affects whether clone is a bulk-prep action or a one-off |
| **OD-22** | On the response detail view, is the respondent identifiable, pseudonymous, or anonymous? | Privacy posture; also changes what Export may contain |

### Resolved this session

- Rating model is a single generic app-experience rating, not a split food/delivery pair — OD-20 is now moot (FR-74, FR-79, FR-89, FR-99, FR-106, FR-107)
- Campaign dashboard is the landing screen; New Campaign is the only route into creation (FR-71 – FR-85)
- Insights page opens from a campaign row, structured as Delivery / Responses / Themes / Impact (FR-86 – FR-110)
- Builder sits in a persistent left-nav SaaS shell with a horizontal step rail on top (FR-58 – FR-70)
- Exclusion is a dropdown (FR-16)
- Variant rename drives the tab label (FR-22)
- Weightage sits above component selection (FR-24)
- Template picker follows the tabbed card-grid pattern with search, filter, count, and hover action (FR-26 – FR-33)
- Delay is a text input, not a dropdown (FR-44)
- NPS is the default rating element; branching toggle defaults off (FR-38, FR-40)
- Branch questions and their choices are both editable, with add/remove (FR-42)
- Schedule uses Now/Later and Never/End-on radio pairs (FR-46, FR-47)
- Test send takes a test account from a dropdown or a directly entered user ID (FR-51)

### Resolved previously

- Star rating branching always on; NPS branching opt-in
- Rolling enrolment with per-user lock at capture
- Create Template disabled with "coming soon"


---

## 12. Insights page

Opened from a campaign row. This is where Prashant reads what users actually said, and decides who owns the problem.

### 12.1 Frame

**FR-86 — Header.**
*Acceptance:* Campaign name, ID, status pill, trigger, audience summary, and running dates. Actions: Pause / Resume, Stop, Edit, Export.

**FR-87 — Edit routes back into the builder.**
*Acceptance:* Edit opens the campaign in the wizard. Because live campaigns stay editable (FR-55), the user is warned that saving changes creates a new version (FR-56) and that responses will be split at that boundary.

**FR-88 — Four tabs.**
Delivery · Responses · Themes · Impact.
*Acceptance:* Tab state is preserved in the URL so a specific view can be shared.

**FR-89 — Persistent rating legend.**
*Acceptance:* The rating ramp — scaled to the campaign's configured rating element, star or NPS (FR-39) — renders as a shared colour legend visible across all four tabs, so a colour means the same thing in every chart on every tab.

**FR-90 — Numerals use a monospaced face.**
*Acceptance:* All figures — counts, ratings, percentages — align vertically in columns and tables.

**FR-91 — AI output is visually separated from data.**
*Acceptance:* AI-generated suggestions and clusters use a reserved accent that appears nowhere in the data palette, so a user can always tell a machine inference from a measurement.

**FR-92 — Global filters.**
*Acceptance:* Date range, segment, app, and variant filters apply across all four tabs and persist when switching between them.

**FR-93 — Version boundary handling.**
*Acceptance:* Where the campaign spans multiple versions, charts mark the boundary and the user can filter to a single version. Aggregates spanning a question change are labelled as such rather than presented as one continuous series. Which tabs must respect this: see **OD-7**.

**FR-94 — Low-sample suppression.**
*Acceptance:* Below a minimum response threshold, percentages are withheld and raw counts shown instead, with a note that the sample is too small to read as a rate.

### 12.2 Delivery tab

**FR-95 — Delivery funnel.**
*Acceptance:* Sent → Shown → Started → Completed, with absolute counts and step-to-step conversion. The largest drop-off is called out.

**FR-96 — Delivery over time.**
*Acceptance:* A time series of sends and completions at a granularity appropriate to the date range.

**FR-97 — Failure reasons.**
*Acceptance:* Where sends fail (opt-out, token invalid, app uninstalled, suppressed by exclusion), counts are broken out by reason.

### 12.3 Responses tab

**FR-98 — Per-question breakdown.**
*Acceptance:* Each configured question is a block showing its distribution. Rating questions render on the shared ramp; multiple choice renders as ranked options with counts and shares.

**FR-99 — Overall experience rating.**
The campaign's single configured rating element (star or NPS, FR-38/FR-39) is reported as one distribution and one average.
*Acceptance:* The rating block renders on the shared ramp (FR-89), showing full distribution, mean, and response count. No secondary or composite rating is implied or displayed.

**FR-100 — Branch path visibility.**
*Acceptance:* Where branching is enabled, the view shows how many respondents took each band's path, and each branch's follow-up results are readable within its own path rather than pooled.

**FR-101 — Open-text responses.**
*Acceptance:* A searchable, filterable list of free-text answers with their associated ratings and timestamp. Filterable by rating band.

**FR-102 — Response detail.**
*Acceptance:* Opening a single response shows that respondent's full answer set in order, with their segment and order context. Identity exposure: see **OD-22**.

### 12.4 Themes tab

**FR-103 — AI theme clustering.**
*Acceptance:* Open-text responses are clustered into named themes, each showing volume, trend against the previous period, associated average ratings, and representative example responses. Themes render in the reserved AI accent (FR-91).

**FR-104 — Theme drill-down.**
*Acceptance:* Selecting a theme filters the open-text list to its members, so every AI claim is traceable to the raw responses behind it.

**FR-105 — Theme reliability.**
*Acceptance:* Themes below a confidence or volume threshold are grouped as unclustered rather than presented as findings.

### 12.5 Impact tab

**FR-106 — Score driver breakdown.**
For each theme surfaced on the Themes tab (FR-103), shows what share of its responses fall in the low-rating band versus the high-rating band, ranked by how much the theme pulls the overall score down.
*Acceptance:* Each driver row shows its response volume and share, its rating-band split, a named owning team, and a one-click action. Owning team is configurable per theme (e.g. Performance → Engineering, Onboarding → Product, Support flow → CX), so attribution comes from theme rather than a second rating axis.

**FR-107 — Driver actions.**
*Acceptance:* Each driver's action routes the underlying response set to its owner — as an export, a filtered link, or a ticket — without the user reconstructing the filter by hand.

**FR-108 — Variant comparison.**
*Acceptance:* For A/B and Intelligent A/B, variants are compared side by side on completion rate and rating outcomes, labelled by variant name (FR-22). Where variants run divergent triggers (FR-45), the comparison is flagged as not like-for-like.

**FR-109 — Intelligent A/B weighting.**
*Acceptance:* Current AI-assigned weights per variant are visible with their history, so a shift in results can be read against a shift in traffic allocation.

**FR-110 — Export.**
*Acceptance:* The current filtered view exports with its filter state, version boundaries, and question wording included, so the file is interpretable away from the UI.


---

## 11. Requirement index

| Section | Requirements |
|---------|--------------|
| Campaign dashboard | FR-71 – FR-85 |
| Navigation | FR-1 – FR-4 |
| Application shell | FR-58 – FR-70 |
| Templates | FR-5 – FR-7 |
| Campaign Details | FR-8 – FR-11 |
| Audience | FR-12 – FR-18 |
| Content | FR-19 – FR-45 |
| Schedule | FR-46 – FR-49 |
| Test & Publish | FR-50 – FR-54 |
| Versioning | FR-55 – FR-57 |
| Insights page | FR-86 – FR-110 |
