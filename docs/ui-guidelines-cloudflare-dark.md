# InsightHub UI guidelines — Cloudflare dashboard, dark

> The specification for restyling the InsightHub console to read like the Cloudflare
> dashboard in dark mode. It is derived from 15 screenshots of dash.cloudflare.com
> (14 dark, 1 light), measured rather than eyeballed, and it maps every existing
> primitive in `assets/css/supabase.css` to its new value. Where this document and
> `DESIGN.md` disagree, this document wins for the console; `DESIGN.md` remains the
> record of the Supabase-derived system it replaces.

**Decisions this document is built on** (agreed 10 Sep 2026):

| Question | Decision |
| --- | --- |
| Deliverable | This Markdown guideline. No token file or reference page yet. |
| Accent | Cloudflare blue for every action and link. Emerald is retired as the action colour and survives only as the *Live* / success status green. |
| Shell | The full Cloudflare shell: 56px icon rail, 58px breadcrumb bar, pill tab strip, centred content widths, footer. |
| Depth | Visual spec plus a migration map from the current CSS primitives. No implementation plan. |

**Not in scope:** light mode (values recorded in Appendix B for later), motion (the
existing scale in `DESIGN.md` → *Motion* stays as it is; only colours inside animated
pieces change), the assistant's orb and border beam, and content or copy changes.

---

## 1. How to read this document

Values are **CSS pixels**. The screenshots are 2× captures of a 1710×931 viewport, so
every measurement below is a 2× pixel count halved; expect ±1px. Type sizes are inferred
from measured cap heights (Inter's cap height is 0.727em) and then snapped to the nearest
size on the scale in §3; the measured value is given wherever it is not obvious.

Colours were sampled from flat fills, never from anti-aliased text, except where a text
colour is explicitly marked *(text sample)*. Where a state was **not observed** in any
screenshot (hover, focus, dropdown menus, toasts), the spec says so and gives a value
derived from the system rather than a measured one.

The screenshots are **not committed**: they show a real account (ID, email, billing
address, card). They are referred to by capture time so the source of each rule can be
checked against the originals:

| Capture | Screen | What it establishes |
| --- | --- | --- |
| 06.39.55 | R2 Object Storage overview — **light mode**, sidebar expanded | Expanded sidebar anatomy, light palette (Appendix B) |
| 08.18.10 · 08.24.46 | Bucket › Objects | Tab strip, stat strip, labelled search form, checkbox table, footer |
| 08.18.34 | Bucket › Metrics | Stat cards, chart cards, legend, dashed grid, empty chart, range button |
| 08.18.51 | Bucket › Settings | Settings sub-nav, section headers, doc chips, panels, mono field, Beta pills, danger text |
| 08.19.06 | Billing › Subscriptions | Underline sub-tabs, filter select, promo card, grouped table, status pills, card-with-header, danger button |
| 08.19.19 | R2 Data Catalog | Page header with Beta pill, empty state, 2×2 usage cards, suggestions card |
| 08.19.31 | Create a bucket | Form column, labels, radio cards, dividers, form footer, disabled primary, neutral Cancel |
| 08.20.04 | Bucket › Settings, scrolled | Tab group docking into the top bar, sticky sub-nav, rules table with mono cell and status text |
| 08.20.45 | Object Lifecycle Rules drawer | 400px drawer, toggle on, form inputs, select, checkboxes, footer |
| 08.21.20 | Workers & Pages | Full-bleed two-column page, compact title with pill, filter selects, progress bar, billing ring, CTA card |
| 08.22.48 | Create a meeting | 960px form dialog, code block, toggle off, dialog footer |
| 08.23.11 | RealtimeKit › Presets | Tab strip with a Beta tab, search + refresh, 52px rows, icon actions, pagination |
| 08.23.22 | RealtimeKit list | Eyebrow + title, list card with footer link, pagination |
| 08.23.29 | Delete app | Framed confirm dialog, type-to-confirm, disabled danger button |

---

## 2. Principles — what makes it read as Cloudflare

1. **Near-black canvas, white-alpha ramp.** The page is `#030303`, not a dark grey, and
   every neutral above it is white at a fixed opacity over black (§2.1). Surfaces are
   separated by *lightness steps of 2–6%*, never by shadow.
2. **Hairlines do all the structural work.** One border colour, `#333333`, on cards,
   tables, inputs, buttons and dividers. A softer `#262626` where separation is merely
   implied (card headers, panel edges). No drop shadows anywhere in the product surface.
3. **One chromatic event: blue.** Buttons, links, selected borders, underlines, checks.
   Green means *on / live*, red means *destructive*, amber and pink are chart series.
   Purple is a documentation chip. Nothing else is coloured.
4. **Big, calm type on a 14px base.** Titles are 30px semibold; body is 14px; the scale
   has few steps and wide gaps between them, so hierarchy is obvious at a glance.
5. **Generous, even spacing.** 16px inside cards, 20px inside table cells, 32px between
   sections, 40px under the page header. Rows are 40 or 52px. Nothing is crammed.
6. **Restrained chrome.** A 56px icon rail, a 58px bar carrying only a breadcrumb and
   three utilities, and a tab strip; the content is centred at a fixed width and gets
   the screen.
7. **Neutral controls.** Checkboxes and radios are grey when checked. Status pills are
   grey with a coloured dot. Only the primary button and the links carry the accent.

### 2.1 Neutral ramp

The whole dark theme is white at these opacities over `#000`. Solid hexes are what to
ship (a border must not change with what it sits on); the alpha column explains the
ramp and is how to derive a step that is missing.

| Token | Hex | ≈ white α | Role | Seen in |
| --- | --- | --- | --- | --- |
| `--cf-well` | `#000000` | 0 | Inset well: settings panels, the bucket-page tab strip band, form inputs | 08.18.10, 08.18.51, 08.19.31 |
| `--cf-canvas` | `#030303` | 1% | Page, rail, top bar, footer, stat strip | everywhere |
| `--cf-band` | `#060606` | 2.5% | Chart-card header, table category rows, dialog preview column | 08.18.34, 08.19.06, 08.22.48 |
| `--cf-panel` | `#0a0a0a` | 4% | Drawer, card-with-header body, compact table header, dialog backdrop tone | 08.20.45, 08.19.06 |
| `--cf-raised` | `#0f0f0f` | 6% | Cards, stat cards, tables, dialogs, secondary buttons, tab (active), pills, code panel | most screens |
| `--cf-inset` | `#171717` | 9% | Search inputs, empty-state panels, active pagination cell, chart empty body | 08.18.10, 08.19.19, 08.23.11 |
| `--cf-hover` | `#1f1f1f` | 12% | Pagination cells, hover fill on raised surfaces *(hover not observed; derived)* | 08.23.11 |
| `--cf-line-soft` | `#262626` | 15% | Card-header divider, settings-panel border, message-panel border, top-bar border (`#252525`) | 08.18.34, 08.18.51 |
| `--cf-line` | `#333333` | 20% | Default 1px border: cards, tables, inputs, buttons, dividers, rail edge, footer | everywhere |
| `--cf-line-strong` | `#404040` | 25% | Objects-table row rules, progress track, toggle-off track, radio-card idle border (`#3d3d3d`) | 08.18.10, 08.21.20, 08.19.31 |
| `--cf-fill-muted` | `#595959` | 35% | Checked checkbox fill, disabled text | 08.18.10, 08.20.45 |
| `--cf-line-input` | `#797979` | 47% | Form-field border (inputs inside forms and drawers, not search), radio/checkbox ring, tertiary text | 08.19.31, 08.20.45 |

`#0b0b0b` (tab-group background) and `#1c1c1c` (tab-group border) also occur; both are
covered by `--cf-canvas` + `--cf-line-soft` at implementation time, see §5.3.

### 2.2 Text ramp

| Token | Hex | Use |
| --- | --- | --- |
| `--cf-text` | `#f5f5f5` | Titles, values, table cells, active tab, button labels, footer links. **Never `#ffffff` for text.** |
| `--cf-text-body` | `#d9d9d9` | Paragraph copy inside settings sections, radio-card bodies, form footers, key-value labels |
| `--cf-text-2` | `#a1a1a1` | Descriptions under titles, table headers, stat labels, inactive tabs, sub-nav, meta, icons at rest |
| `--cf-text-3` | `#797979` | Form field labels, drawer descriptions, "just now" style meta |
| `--cf-placeholder` | `#777777` | Placeholder text (measured `#777776`) |
| `--cf-text-disabled` | `#595959` | Disabled labels and icons |
| `--cf-axis` | `#9da3af` | Chart axis labels only — a cool grey, deliberately not in the neutral ramp |

Contrast on `#030303`: `#a1a1a1` is 7.6:1, `#797979` is 4.5:1 — the floor for anything
that must be read. `#595959` (2.7:1) is for disabled states only.

### 2.3 Blue — the action colour

| Token | Hex | Use |
| --- | --- | --- |
| `--cf-blue-900` | `#004dcc` | Primary-button outer border (measured `#024eca`/`#004dcc`) |
| `--cf-blue-700` | `#005fec` | Solid accents: sub-tab underline, check marks, Beta-pill dotted border (`#005aeb`), progress fill |
| `--cf-blue-600` | `#0870ff` | Links in prose (underlined), selected radio-card border, "Documentation ↗" links |
| `--cf-blue-500` | `#2674f0` | Top of the primary-button gradient |
| `--cf-blue-400` | `#4693ff` | Links inside tables and on raised surfaces; the primary chart series (`#4390f0`) |
| `--cf-blue-300` | `#82b6ff` | Text-only action buttons ("Enable", "+ Add"), link hover |
| `--cf-blue-200` | `#52a2ff` | Highlighted tokens inside code blocks |
| `--cf-blue-tint` | `rgba(8,112,255,.12)` | Selected-row / selected-card fill *(derived; Cloudflare uses the border alone)* |

**Primary button fill** is a vertical gradient, not a flat colour:
`linear-gradient(180deg, #2674f0 0%, #1169ee 50%, #005eec 100%)`, a 1px `#004dcc`
border, and a 1px inner highlight `inset 0 1px 0 rgba(255,255,255,.28)` (measured
`#5893f6` on the top row). Label `#ffffff`. Disabled: flat `#425d81`, no gradient, label
`#d9d9d9`, border none.

### 2.4 Semantic colours

| Role | Hex | Notes |
| --- | --- | --- |
| Success / on / Live | `#00d492` | Status dot for *Active*; the one green in the UI |
| Toggle on — track | `#1a6535` | Knob and check glyph `#55d484` |
| Danger button | `linear-gradient(180deg, #f03c37, #e90817)` | Same gradient construction as primary; label `#ffffff` |
| Danger button, disabled | `#7b211e` | Flat |
| Danger text / icon | `#fe9f97` text · `#ff6467` icon | "Disable" links, trash icons |
| Warning / amber series | `#f0b620` | Chart series, warning text |
| Pink series | `#e7639d` | Second chart series |
| Neutral series | `#848589` | "Total" series in charts |
| Docs chip | `#7367e5` | Purple pill beside section titles, white glyph |
| Chart grid | `#2b2d2e` | 1px dashed |

**InsightHub semantics carried over** (they encode meaning and are not decoration):

- Rating ramp stays five stops but is re-tuned to this palette: `#ff6467` → `#f76b15`
  → `#f0b620` → `#7cc47f` → `#00d492`. The top stop is now the status green, so a
  5-star cell and a Live dot share one colour: both mean *as good as it gets*.
- AI accent moves from `#a78bfa` to the Cloudflare purple `#7367e5` (`--ai-fg`
  `#a9a2f0`, `--ai-200` `rgba(115,103,229,.12)`). Still only for machine inference.
- Status dots: Draft `#797979` · Scheduled `#4693ff` · Live `#00d492` · Paused
  `#f0b620` · Completed `#a1a1a1` · Stopped `#ff6467`. The pill itself is always
  neutral (§6.13); the dot is the only carrier of hue, and the label the carrier of
  meaning.

---

## 3. Typography

**Family:** Inter for everything, JetBrains Mono for IDs, code and figures. Both are
already loaded; nothing changes in the `<head>`. The Cloudflare dashboard's sans is
visually Inter (single-storey *g*, flag-and-no-base *1*), so no substitution is needed.

**Weights:** 400 body · 500 labels, tabs, buttons, table headers, navigation · 600 titles
and stat values. Nothing heavier than 600, nothing lighter than 400.

| Role | Size / weight / line-height | Colour | Where | Measured |
| --- | --- | --- | --- | --- |
| Page title | 30px · 600 · 1.2 · −0.02em | `#f5f5f5` | Product overview pages (08.19.19, 08.23.22) | 30.3 / 32.3 |
| Section title | 24px · 600 · 1.2 | `#f5f5f5` | "Usage" column heading; also empty-state title | 24.8 / 24.1 |
| Stat value | 24px · 600 · 1.1 | `#f5f5f5` | Stat cards (08.18.34, 08.19.19); tabular-nums | 24.1 / 25.4 |
| Compact page title | 20px · 600 · 1.3 | `#f5f5f5` | Full-bleed pages ("Workers & Pages"), drawer titles, form titles ("Create a bucket") | 19.9 / 21.3 |
| Card / dialog title | 18px · 600 · 1.3 | `#f5f5f5` | List-card titles ("Test"), form-dialog titles | 17.2 |
| Eyebrow | 16px · 500 · 1.3 | `#999999` | Parent product name above a page title ("Realtime") | 15.8 |
| Body large | 16px · 400 · 1.5 | `#a1a1a1` / `#d9d9d9` | Empty-state description, form intro paragraph | 15.8 / 17.2 |
| Heading small | 16px · 600 · 1.4 | `#f5f5f5` | Settings section titles, radio-card titles, "Location:", "Rule scope:" | 16.5 / 15.8 |
| Body | 14px · 400 · 1.5 | per §2.2 | Everything not listed: descriptions, table cells, prose, help copy, breadcrumb | 14.4 (×14) |
| UI label | 14px · 500 · 1 | `#f5f5f5` | Buttons, tabs, top-bar utilities, chart-card titles, key-value labels | 14.4 |
| Confirm-dialog title | 16px · 600 · 1.3 | `#f4f4f4` | "Delete app" | 15.1 |
| Small | 13px · 400 · 1.5 | `#a1a1a1` | Settings sub-nav, suggestion rows, "Showing 1–9 of 9", table sub-lines | 13.1 |
| Small label | 13px · 500 · 1 | `#a1a1a1` | Table headers, table category rows | 13.1 / 12.4 |
| Caption | 12px · 400 · 1.4 | `#a1a1a1` | Stat labels, help text, chart legend labels and axis labels, "View docs" pill, Beta pill (500) | 12.4 |
| Form label | 12px · 500 · 1.3 | `#797979` | Above form fields | 11.7 |
| Mono | 13px · 400 · 1.5 | `#a1a1a1` (IDs) · `#f5f5f5` (code) | IDs with copy icon, code blocks, S3-style URL fields; tabular-nums | 11.7–13.1 |

**Rules**

- Sentence case everywhere, including table headers and tab labels. No uppercase
  tracking-out labels: the current `.t-micro` / `.stat-label` uppercase treatment goes.
- Titles keep tight tracking (−0.02em at 30px, −0.01em at 20–24px); everything 16px and
  under is at 0.
- Figures (counts, percentages, ratings) stay in JetBrains Mono with `tabular-nums`, as
  today. Cloudflare sets stat values in Inter; InsightHub keeps mono for column
  alignment, which is a documented local extension (FR-77, FR-90).
- Body copy blocks are capped at ~64ch (Cloudflare's section descriptions wrap at about
  720px).

---

## 4. Spacing, sizing, shape

**Grid:** 4px. **Tokens:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48.

| Use | Value |
| --- | --- |
| Card / stat-card padding | 16px |
| Table cell padding (horizontal) | 20px; first column with a checkbox 12px |
| Drawer and dialog body padding | 20px (dialog inner panel), 24px (drawer header) |
| Radio-card padding | 24px |
| Gap between stat cards | 16px in a main row (measured 14); 12px in a sidebar 2×2 |
| Gap between chart cards | 16px |
| Page header → first content row | 40px |
| Toolbar (search row) → table | 16px |
| Table → pagination row | 40px |
| Between settings sections | 32px (section title to previous panel) |
| Form: label → field | 6px; field → help text 6px; section divider 24px above and below |
| Rail item pitch | 35px (32px square + 3px) |
| Sidebar nav pitch (expanded) | 35px |

**Control heights**

| Size | Height | Used for |
| --- | --- | --- |
| sm | 30px | Dialog, drawer and form footers; "Show all"-type in-card buttons (measured 28–33) |
| md | 38px | Toolbars, filters, icon buttons, search inputs, pagination, table actions, tab group (measured 38 ×5) |
| lg | 42px | Page-header actions ("Documentation", "Create bucket") |

Form fields inside forms and drawers are **36px** (34 + borders); search fields are 38px.

**Radii:** 6px on controls (buttons, inputs, selects, active tab, code fields); 8px on
containers (cards, tables, dialogs, drawers' inner panels, tab group outer, radio cards,
empty states); 12px on the dialog frame; full on pills, badges, dots, avatars. Nothing
uses 4px any more except the inline code chip.

**Borders:** always 1px. Never 2px except the sub-tab underline and the 3px sub-nav bar.

**Icons:** 16px, 1.5px stroke, `#a1a1a1` at rest and `#f5f5f5` when active or inside a
button. Product icons beside a page title are 28px. Info glyphs (ⓘ) 14px `#a1a1a1`.

**Elevation:** none. Overlays (dialog, drawer, dropdown) separate from the page by
backdrop and border, not shadow. `--shadow-1/2/3` are removed from use; the assistant
card may keep its own.

---

## 5. Layout and shell

```
┌────┬────────────────────────────────────────────────────────────────────┐
│logo│ breadcrumb                              ● Production  ✦ Assistant  ? Help  ◯ │ 58px bar, border #252525
├────┼────────────────────────────────────────────────────────────────────┤
│ ⌕  │ [ Delivery | Responses | Impact ]                                   │ 58px tab strip (only on pages that have tabs)
│ ⌂  ├────────────────────────────────────────────────────────────────────┤
│ …  │  ┌ content, centred at a fixed width ──────────────────────────┐   │
│ ── │  │  Page title                              [Secondary] [Primary]│   │
│ ⚙  │  │  Description                                                 │   │
│    │  │                                                              │   │
│ ⊟  │  └──────────────────────────────────────────────────────────────┘   │
├────┴────────────────────────────────────────────────────────────────────┤
│                 Support · Docs · Status · Privacy · © InsightHub        │ 60px footer, border #333
└─────────────────────────────────────────────────────────────────────────┘
 56px rail, border-right #333
```

### 5.1 Rail (collapsed, the default)

- 56px wide: 55px + 1px `#333333` right border. Background `#030303`. Full height,
  including the top-bar row: the **logo cell** (56×58) is the top of the rail, with the
  IH mark centred (28px). Clicking it opens the workspace/app switcher popover (§5.6).
- Items: 32×32 squares centred on the rail's axis, icon 16px `#a1a1a1`, pitch 35px,
  first item 10px below the bar. Active: background `#171717`, radius 6px, icon
  `#f5f5f5`. Hover: icon `#f5f5f5`, no fill.
- Groups are separated by a 1px `#333333` rule 34px wide with 12px above and below
  (Cloudflare: search · home/recents/domains · observe · build · protect · settings).
  InsightHub's groups stay as they are: Campaigns, Insights · Segments, Templates, User
  data · AI themes, Assistant, Settings.
- The first item is **search** (opens the quick-search popover, `⌘K`). The last item, 26px
  above the bottom, is the **expand toggle** (panel icon), which switches to §5.2.
- No text and no badges in the collapsed state. The existing 1.5s-delayed rail tooltip
  carries the label ("AI themes · Beta").

### 5.2 Sidebar (expanded)

Matches the light-mode capture translated to the dark ramp:

- 260px wide, same border and background as the rail.
- Row 1 (58px): IH mark + workspace name (14px 500, truncating) + ⌃⌄ switcher glyph.
  This is the workspace switcher.
- Row 2: **Quick search** input, 38px, 16px margins, `#171717` fill, `#333333` border,
  search icon left, `⌘K` hint right in `#797979`.
- Nav items: 35px pitch, 13px 500, icon 16px + 12px gap, 16px side margin, radius 6px.
  Active: fill `#171717`, text `#f5f5f5`. Groups with children show a chevron and
  expand inline; children indent 32px. Section labels ("Observe", "Build") are 13px
  `#a1a1a1` with 24px above. InsightHub uses them only if it grows more than one
  level; today the three groups are separated by rules as in §5.1.
- Beta / New pills appear inline after the label (§6.13). Bottom: collapse toggle.

### 5.3 Top bar

- 58px: 57px + 1px `#252525` bottom border (softer than the rail edge, deliberately).
  Background `#030303`. Starts after the rail (the logo cell belongs to the rail).
- Left: **breadcrumb**, 20px from the rail. 14px; parent segments `#a1a1a1` with a 16px
  product icon before the first; separator chevron `#525252` with 12px either side;
  current segment `#f5f5f5` 500. Example: `⊞ Campaigns › Post-delivery feedback · Bandra`.
- Right, 32px from the edge, 32px apart, each icon 16px + 8px + 14px 500 `#f5f5f5`:
  **environment pill** (`● Production`, §6.13 — must stay visible, FR-62), **Assistant**
  (sparkle; opens the companion card, replacing the rail's "Assistant" being the only
  entry), **Help** (question-mark circle; docs), **avatar** (28px circle, `#171717`
  fill, `#333333` border, initials 11px).
- When a page has a tab strip and is scrolled past it, the tab group **docks into the
  bar** in place of the breadcrumb (08.20.04). The bar itself never grows.

### 5.4 Tab strip

- A 58px band under the bar (57px + 1px `#333333` bottom border), background `#000000`
  on detail pages that carry a stat strip beneath (08.18.10) and `#030303` elsewhere.
- The **tab group** sits 16px from the rail, vertically centred: 38px tall, background
  `#0b0b0b`, 1px `#1c1c1c` border, 1px padding, radius 8px. Tabs are 34px, padding
  0 12px, 14px 500. Active: fill `#0f0f0f`, 1px `#333333` border, radius 6px, text
  `#f5f5f5`. Inactive: transparent, `#a1a1a1`; hover `#f5f5f5`. A Beta pill inside a
  tab follows the label after 8px.
- The active marker does not slide: the group is a set of buttons, not an underline.
  The existing travelling `.tab-pill` is retired on this strip and kept for underline
  sub-tabs (§6.5).

### 5.5 Content widths

| Page type | Max width | Gutters | Example |
| --- | --- | --- | --- |
| Dashboard / metrics | 1352px, centred | 24px | Bucket › Metrics (08.18.34), overview with usage column (08.19.19) |
| List | 1024px, centred | 24px | RealtimeKit list (08.23.22) |
| Form | 800px, centred | 24px | Create a bucket (08.19.31) |
| Settings | 954px, centred = 187px sub-nav + 27px + 740px content | 24px | Bucket › Settings (08.18.51) |
| Full-bleed two-column | fluid | 32px | Workers & Pages (08.21.20): main + 400px sidebar split by a 1px `#333333` rule |

Content starts **40px** below the bar or tab strip (measured 32–48). A page is the
content plus the footer; the footer sits at the bottom of the viewport when the content
is short and after it when it is not.

Two-column overview (08.19.19): main column and a "Usage" column in a `1fr 446px` grid
with a 32px gap; the sidebar holds a 24px section title, a date range at 14px `#a1a1a1`,
a 2×2 grid of stat cards (12px gap), and further cards stacked with 24px gaps.

### 5.6 Where InsightHub's chrome goes

| Today | In the Cloudflare shell |
| --- | --- |
| Rail brand row (IH + "InsightHub") | Logo cell at the top of the rail; the name appears only in the expanded sidebar |
| Top-bar **Workspace** switcher | Expanded-sidebar row 1; from the collapsed rail, a popover from the logo cell |
| Top-bar **App** switcher | Second list inside the same popover (workspace → app). No Cloudflare equivalent; keep it two-level and small |
| Top-bar **search** input | Rail search icon / sidebar Quick search, opening a popover with the same input and `⌘K` |
| **Environment** pill | Top bar, right cluster, first item |
| **Help** icon button | Top bar "Help" |
| **Avatar** | Top bar, last item |
| Rail "Assistant" entry | Stays in the rail *and* becomes the top bar's "Assistant" utility |
| Rail "Collapse" button | Rail bottom toggle (icon only) |
| `.page-tabs` under the page header | Tab strip (§5.4) |
| Builder's own head + foot | Breadcrumb `Campaigns › New campaign` in the bar; stepper as the tab strip (§9.3); footer bar in the drawer-footer style |

### 5.7 Footer

60px: 1px `#333333` top border, links 14px `#f5f5f5` separated by 1px `#333333` rules
16px tall with 20px either side, copyright 13px `#a1a1a1` at the end. Centred within the
content width. InsightHub: `Support · Docs · Status · Privacy · © 2026 InsightHub`, plus
the prototype's "reset local state" link, which stays where it is today.

### 5.8 Responsive

Cloudflare's dashboard is desktop-first; these captures are all ≥1440px. Below 1280px
the usage column stacks under the main column; below 1024px the sidebar never expands
and content widths become fluid with 16px gutters; below 768px the tab group scrolls
horizontally inside its band and tables switch to the existing `.table-scroll`.

---

## 6. Components

Each entry gives anatomy, measurements, colours and states. "Derived" marks anything not
seen in a capture.

### 6.1 Buttons

| Variant | Fill | Border | Label | Where |
| --- | --- | --- | --- | --- |
| **Primary** | gradient §2.3 + inset highlight | `#004dcc` | `#ffffff` 14px 500 | One per view: Create, Save, Upload |
| **Secondary (outline)** | `#0f0f0f` | `#333333` | `#f5f5f5` | Documentation, Update, Add, Back, filter selects, icon buttons |
| **Neutral filled** | `#999999` | none | `#0a0a0a` | Cancel in form and drawer footers (08.19.31, 08.20.45) |
| **Text** | none | none | `#82b6ff` 14px 500 | "+ Add", "Enable", "Show more"; Cancel in confirm dialogs is `#f4f4f4` |
| **Danger** | red gradient §2.4 | `#a81212` (derived) | `#ffffff` | Delete, Delete app |
| **Danger text** | none | none | `#fe9f97` | "Disable" |
| **Icon** | as secondary | `#333333` | icon 16px `#f5f5f5` | Refresh, more (⋯) |
| **Pill button** | `#0f0f0f` | `#333333` | 12px `#f5f5f5` | "View docs" beside a compact title, 22px tall, radius full |

- Sizes per §4: sm 30 · md 38 · lg 42; padding 0 16px (md/lg), 0 12px (sm); icon + 8px.
- Radius 6px. Leading "+" in a primary label is a 16px plus glyph, not a character.
- Hover *(derived)*: primary gradient lifts one step (`#2f7cf2 → #0a66f0`); secondary
  fill `#171717`; text buttons underline. Active: primary `#005eec` flat.
- Disabled: primary `#425d81` / danger `#7b211e`, flat, label `#d9d9d9`; secondary
  keeps its border at `#262626` with label `#595959`.
- Focus *(derived, required)*: `outline: 2px solid #4693ff; outline-offset: 2px`.

### 6.2 Inputs, selects, textarea

| Field | Height | Fill | Border | Notes |
| --- | --- | --- | --- | --- |
| Search | 38 | `#171717` | `#333333` | 16px search icon at 12px, `#727272`; placeholder `#777777`; text 14px `#f5f5f5`; radius 6 |
| Form input | 36 | `#000000` | `#797979` | Inside forms, drawers, dialogs; padding 0 12px; radius 6 |
| Form select | 36 | `#000000` | `#797979` | Value + a 36px trailing cell separated by a 1px `#797979` rule holding a filled ▾ (08.20.45) |
| Filter select (toolbar) | 38 | `#0f0f0f` | `#333333` | Looks like a secondary button: label 14px `#f5f5f5` + ⌃⌄ glyph `#a1a1a1` 8px after; optional leading icon ("Category") |
| Textarea | auto, min 96 | `#000000` | `#797979` | Padding 10px 12px |
| Mono field | 36 | `#232628` | none | Read-only value 13px mono `#f5f5f5`, copy icon 16px `#a1a1a1` right; radius 6 (08.18.51) |

- Label above the field: 12px 500 `#797979`, 6px gap. Help below: 12px `#999999`, 6px gap.
  Required is stated in the label text, not with an asterisk colour.
- Focus: border `#a1a1a1` (measured `#7d7c7c` at 1.5px on the focused confirm field) plus
  the derived 2px `#4693ff` outline at 2px offset for keyboard users.
- Invalid *(derived)*: border `#ff6467`, help text `#fe9f97`.
- **Labelled search form** (08.18.10): label 12px above a 36px input 290px wide, then a
  secondary md button "Search" with a 16px search icon, 8px gap; an option checkbox
  right-aligned on the same row; 1px `#333333` rule under the whole row with 24px below.

### 6.3 Checkbox, radio, toggle

- **Checkbox** 16px, radius 4, `#797979` 1px ring on transparent. Checked: fill
  `#595959`, ring `#797979`, white 2px check. Neutral on purpose: a checked box is not
  an action.
- **Radio** 16px, `#797979` ring. Checked: 8px `#d9d9d9` dot, ring unchanged.
- **Toggle** 40×22, radius full. Off: track `#404040`, knob 18px `#1f1f1f` with a 1px
  `#595959` ring *(knob colour derived from the modal capture's mode; the off toggle reads
  as a dark disc on a grey track)*. On: track `#1a6535`, knob and a 12px check glyph on
  the track `#55d484`. Label 14px `#f5f5f5` to the left, 12px gap.
- Checkbox with control (08.20.45): checkbox + 14px label, then the dependent
  input/select row indented 48px beneath.

### 6.4 Radio cards

Two-up grid, 16px gap. Card: transparent fill, 1px `#3d3d3d` border, radius 8, padding
24px; radio at top-left, 16px gap to the text column; title 16px 600 `#f5f5f5`, body 14px
`#d9d9d9` 8px below; an optional disclosure link 14px `#0870ff` with a leading chevron.
Selected: border `#0870ff`, nothing else changes (no tint, no check icon). Hover
*(derived)*: border `#595959`.

### 6.5 Tabs

- **Tab group** (page-level): §5.4.
- **Underline sub-tabs** (within content, 08.19.06): 14px 500, `#a1a1a1`, active
  `#f5f5f5` with a 2px `#005fec` underline flush with a full-width 1px `#262626` rule;
  padding 0 12px 12px; 24px between tabs. The existing travelling marker stays here.
- **Settings sub-nav** (08.18.51): 187px column, 13px items on a 34px pitch, `#a1a1a1`;
  active `#f8f8f8` with a 3×16px `#f8f8f8` bar 14px to the left of the text; Beta pills
  inline. Sticky under the tab strip while the sections scroll; the active item follows
  the section in view.

### 6.6 Page header

- **Overview** (08.19.19, 08.23.22): optional 28px product icon + 30px title (+ Beta pill,
  12px gap) on one line; description 14px `#a1a1a1` 8px below; actions right-aligned to
  the title's centre line: secondary lg (icon + "Documentation") then primary lg, 12px
  apart. An **eyebrow** (16px 500 `#999999`, the parent product) may sit 8px above the
  title.
- **Compact** (08.21.20): 20px title + "View docs" pill (12px gap); description 14px
  `#a1a1a1`; primary md on the right. Used on full-bleed pages.
- **Detail** (08.18.10): the title moves into the breadcrumb; the page starts with the
  tab strip and a stat strip (§6.8). No repeated title.

### 6.7 Section header (settings pages)

16px 600 title + purple **docs chip** (30×20 pill, `#7367e5`, white 12px book glyph, 12px
gap) + optional Beta pill; description 14px `#d9d9d9` 8px below, max-width ~62ch; the
section's action right-aligned on the description's line — a text button ("Enable") or
"+ Add" (16px plus + label, `#82b6ff`). Content (panel, table or message panel) 16px
below. Sections are 32px apart.

### 6.8 Stat strip (detail pages)

76px band under the tab strip: `#030303`, 1px `#333333` bottom border, 20px side
padding, content vertically centred. Each column: label 12px `#a1a1a1` + 14px ⓘ, value
14px 600 `#f5f5f5` 6px below (a value may carry a 16px leading icon, e.g. "🌐 Enabled").
Columns are content-sized with an 80px gap. Five columns fit 1440px; beyond five, drop
the least important rather than shrink the gap.

### 6.9 Stat card

96px tall, `#0f0f0f`, 1px `#333333`, radius 8, padding 16px. Label 14px `#f5f5f5` (main
row) or 12px `#a1a1a1` + ⓘ (sidebar cards) at the top; value 24px 600 `#f5f5f5` with
`tabular-nums` at the bottom, 8px under the label. Five across a 1352px row, 16px gaps;
2×2 in a sidebar with 12px gaps.

InsightHub extension: the sparkline stays, right-aligned in the card at 32px tall,
drawn in the chart palette (§6.19). The card grows to 112px when it carries one.

### 6.10 Card and panel

- **Card**: `#0f0f0f`, 1px `#333333`, radius 8. Body padding 16px.
- **Card with header** (08.19.06 "Payment method", 08.19.19 "Suggestions"): header row
  44px, title 14px 500 `#f5f5f5` (muted `#a1a1a1` for grouping cards like "Payment
  method"), optional trailing glyph (→, ⌄) `#a1a1a1`; 1px `#262626` rule; body
  `#0a0a0a`. The header itself is transparent.
- **Chart card** (08.18.34): header 36px on `#060606`, title 14px 500 + ⓘ, 1px `#262626`
  rule; body `#0f0f0f` 16px.
- **List card** (08.23.22): the row (icon tile 24px blue play glyph, title 18px 600, 13px
  mono ID + copy, right: meta 13px `#a1a1a1` + ⋯) on `#0f0f0f` 20px padding; a footer
  band `#030303` with a 1px `#333333` rule above holding a link row ("View sessions ↗",
  14px `#a1a1a1`) at 14px padding.
- **Promo card** (08.19.06 "Upgrade to Workers Paid"): card with title 14px 500,
  description 13px `#a1a1a1`, actions right (text button + primary md), a 1px `#262626`
  rule, then a 3-column list of 14px `#d9d9d9` items with 16px `#005fec` check marks.
  Use for the one standing callout a screen may have (`.callout` today).
- **CTA card** (08.21.20 "Cloudflare Access"): title 14px 500, body 14px `#a1a1a1`,
  full-width secondary sm button.
- **Message panel** (08.18.51): 56px, `#000000`, 1px `#262626`, radius 8, one centred
  line 14px `#f8f8f8`: "There is no custom domain assigned to this bucket."
- **Settings panel** (08.18.51 "General"): `#000000`, 1px `#262626`, radius 8, padding
  16px; key-value rows on a 36px pitch, key 14px `#d9d9d9` in a 176px column, value 14px
  `#f5f5f5`; a mono field (§6.2) for copyable values.
- **Well** (nested inset): `#000000` with `#262626` border inside a card.

### 6.11 Table

- Container: `#0f0f0f`, 1px `#333333`, radius 8, `overflow: hidden`.
- Header row 36px: 13px 500 `#a1a1a1`, padding 0 20px, 1px `#333333` rule below. Sort
  glyph 16px after the label. Sticky inside a scrolling container.
- Rows: **52px** default (08.23.11) · **40px** compact for simple data (08.18.10) ·
  **56px** two-line (title 13px 500 + sub-line 12px `#a1a1a1`, 08.19.06). 1px `#333333`
  rules; the last row has none. Cell text 14px `#f5f5f5`, padding 0 20px.
- Category rows (grouped tables): 33px, `#060606`, 13px 500 `#a1a1a1`.
- Cells: links `#4693ff` (folders underlined, files not); mono IDs 13px `#a1a1a1` + 16px
  copy icon 8px after; mono values (`Abort uploads after 7 day(s)`) `#f5f5f5`; status
  text `Enabled` in `#00d492`; empty value `--` in `#a1a1a1`.
- Checkbox column 44px (checkbox 12px in). Row selection *(derived)*: fill
  `rgba(8,112,255,.08)`.
- Actions column right-aligned: either icon buttons (edit `#dadada`, delete `#ff6467`,
  24px apart) or a single ⋯ `#f4f5f5`.
- Row hover *(derived)*: `#171717`. Clickable rows keep the existing chevron-on-hover
  gesture.
- Drag-and-drop hint under a table (08.18.10): 14px `#77787a` with a cloud-upload
  icon, centred, 20px below.

### 6.12 Pagination

40px below the table, right-aligned: "Showing 1–9 of 9" 13px `#a1a1a1`, 20px gap, then a
38px button group of five 43px cells (⏮ ◀ page ▶ ⏭): fill `#1e1f1f`, 1px `#333333`
outer border, 1px `#2b2b2b` inner rules, radius 6; current page cell `#171717` with 14px
`#f5f5f5`; disabled arrows `#353535`. Compact variant (08.18.10): two cells only.

### 6.13 Pills, badges, dots

| Kind | Spec |
| --- | --- |
| **Status pill** | 22px, padding 0 10px, 1px `#333333`, transparent fill, radius full; 6px dot + 12px 500 `#f5f5f5` label, 8px gap. Dot colours per §2.4. `Live` keeps the pulse ring. |
| **Environment pill** | Status pill in the top bar: `● Production` green dot, `● Staging` amber dot |
| **Beta pill** | 22px, padding 0 8px, transparent, 1px **dotted** `#005aeb`, radius full, 12px 500 `#51a1fe`. Beside a page title the neutral variant: dotted `#595959`, text `#f6f6f6`. |
| **New pill** | As Beta, solid `#333333` border, `#f5f5f5` text (expanded sidebar) |
| **Docs chip** | 30×20, `#7367e5`, white book glyph, radius full |
| **Inline code chip** | Inline, 1px `#333333`, `#050505`, radius 4, padding 1px 6px, 14px text + 14px copy icon (08.23.29 "Test ⧉") |
| **Version / kind badge** | InsightHub's `v2`, `Announcement`, `Feedback` badges become 20px pills: `#0f0f0f`, `#333333`, 12px `#a1a1a1`, radius full, optional 14px leading icon |
| **AI badge** | As Beta but dotted `#7367e5` and text `#a9a2f0` |
| **Avatar** | 28px, `#171717`, 1px `#333333`, initials 11px 500 `#f5f5f5` |

### 6.14 Empty state

Panel `#171717`, 1px `#333333` border plus a 1px `#262626` inner ring (measured as a
double edge), radius 8, min-height 280px, padding 48px, centred column: 64px
illustration or 48px icon `#a1a1a1`, 24px gap, title 24px 600 `#f6f6f6`, description
16px `#a1a1a1` 8px below. No button inside the panel — the page header's primary is the
call to action. Same construction for an empty chart body, with a dashed `#333333` border
and 14px `#a1a1a1` text.

### 6.15 Dialog

One anatomy, two footer placements.

- **Backdrop**: `rgba(10,10,10,.85)` — the page goes to ~`#0a0a0a` and its text to
  ~`#2d2d2d`.
- **Frame**: 5px of `#080808` around the panel with a 1px `#333333` outer edge
  (measured `#050505`/`#333` on the confirm dialog, `#090909`/`#121212` on the form
  dialog), radius 12.
- **Panel**: `#0f0f0f`, 1px `#272727`, radius 8.
- **Confirm dialog** (08.23.29): 500px. Panel padding 20px: title 16px 600 `#f4f4f4`,
  body 14px `#a1a1a1` 12px below, a type-to-confirm line 14px `#f4f4f4` with the inline
  code chip, then a 38px input. **Footer in the frame**: 44px band, Cancel as a text
  button `#f4f4f4` at left, the danger/primary sm button at right, 16px side padding.
- **Form dialog** (08.22.48): 960px (lg 720px). Header 56px inside the panel: title 18px
  600, "View docs ↗" link `#4693ff` right, 1px `#333333` rule. Body: one column at 24px
  padding (Cloudflare's second, `#060606` preview column is optional). **Footer inside
  the panel**: 68px, 1px `#333333` rule, secondary md + primary md right-aligned, 12px
  gap.
- Open/close motion keeps the existing `pop` / asymmetric close.

### 6.16 Drawer

400px from the right, full height over the content (the bar and rail stay visible),
`#0a0a0a`, 1px `#2c2c2c` left edge, no shadow, backdrop as §6.15. Header: 24px
padding, title 20px 600, description 14px `#797979` 8px below, "Documentation ↗" link
14px `#0870ff` underlined 12px below, close × top-right 16px `#a1a1a1`, 1px `#303030`
rule. Body: 20px padding, form controls per §6.2–6.3, group headings 16px 600 with 24px
above. Footer: 72px, 1px `#303030` rule, neutral-filled Cancel + primary sm, right
aligned, 12px gap. Use for editing a rule, a segment, an alert — anything that today
opens a `.dialog-lg` with a form.

### 6.17 Dropdown menu *(derived)*

Not captured. Build from the pagination and select styles: `#0f0f0f`, 1px `#333333`,
radius 8, 4px padding, items 36px 14px `#f5f5f5` with 16px icons `#a1a1a1`, hover
`#171717`, separators `#262626`, danger item `#fe9f97`. Opens 4px under its trigger with
the existing `dd-in` motion.

### 6.18 Toast and tooltip *(derived)*

Toast: 340px, `#0f0f0f`, 1px `#333333`, radius 8, 12px 16px padding, title 14px 500,
body 13px `#a1a1a1`, a 6px status dot instead of the coloured left border. Tooltip:
`#171717`, 1px `#333333`, radius 6, 12px `#f5f5f5`, 6px 8px padding. Timings unchanged.

### 6.19 Charts

- Card per §6.10. **Legend row**: columns separated by 1px `#333333` vertical rules,
  each 20px padding: 8px series dot + 12px `#a1a1a1` label, value 16px 500 `#f5f5f5`
  8px below.
- **Plot**: 240px tall. Y labels 12px `#9da3af` right-aligned in a 48px gutter, one
  dashed 1px `#2b2d2e` rule per tick (4/4 dash). X labels 12px `#9da3af` under the
  plot; an axis title 12px `#9da3af` (rotated on Y, centred under X) when the unit is not
  obvious. No axis lines.
- **Series**: blue `#4390f0`, amber `#f0b620`, pink `#e7639d`, neutral `#848589` for
  "Total". Lines 2px, no area fill, no point markers. Bars 1px gap on `#0f0f0f`,
  radius 2 top.
- InsightHub's rating ramp (§2.4) is the palette for anything rating-coded; the status
  colours for anything status-coded; blue/amber for the rest (Sends / Completed).
- **Readout** (`.chart-tip`): `#0f0f0f`, 1px `#333333`, radius 8, 8px 12px padding,
  rows 12px with dot + label `#a1a1a1` + mono value `#f5f5f5`.
- **Range control**: secondary md button with a 16px calendar icon ("Last 24 hours"),
  right-aligned above the cards, 16px above them.
- **Progress bar** (08.21.20): 6px track `#404040`, radius full, fill `#005fec`; label
  13px `#a1a1a1` left and `0 / 100,000` 13px `#f5f5f5` right on the line above, 8px gap.
- **Ring** (08.21.20): 96px, 8px stroke `#333333` track, `#005fec` progress, centred 14px
  600 value.

### 6.20 Suggestions list

Card with header (title 14px 500 + ⌄). Rows on a 60px pitch: 16px icon `#a1a1a1`, title
13px 500 `#f6f6f6`, description 13px `#a1a1a1` 4px below, 16px gap between icon and
text. A full-width secondary sm "Show all" at the bottom, 16px inset.

### 6.21 Code block

`#313131` panel inside a `#0f0f0f` card with a copy icon top-right, radius 8, 16px
padding, 13px mono `#fbfbfb` at 1.6 line-height, highlighted tokens `#52a2ff`.

### 6.22 Skeleton *(derived)*

Blocks `#171717` with the existing sweep at `rgba(255,255,255,.04)`. Sized as today.

---

## 7. States

| State | Treatment |
| --- | --- |
| Hover, surface | fill one step up the ramp (`#0f0f0f` → `#171717`, `#030303` → `#0a0a0a`); text `#a1a1a1` → `#f5f5f5` |
| Hover, primary | gradient one step lighter |
| Hover, link | `#82b6ff`; prose links keep their underline |
| Active / pressed | primary flat `#005eec`; surfaces `#1f1f1f` |
| Selected | 1px `#0870ff` border; rows `rgba(8,112,255,.08)` fill; no check icon |
| Focus-visible | 2px `#4693ff` outline, 2px offset, on everything interactive — not observed in the captures; mandatory anyway |
| Disabled | flat desaturated fill (`#425d81` / `#7b211e`), text `#d9d9d9`; neutral controls `#595959` text on unchanged surfaces; `cursor: not-allowed` |
| Loading | skeleton; primary button keeps its label and shows a 16px spinner before it |
| Error | border `#ff6467`, message `#fe9f97` 12px under the field |
| Live | green dot with the existing pulse |

**Motion:** unchanged (`--motion-fast/base/slow`, `--ease-out`, asymmetric close). Nothing
in the captures shows motion; nothing here contradicts the existing rules.

---

## 8. Do and don't

**Do**

- Keep the canvas `#030303` and step surfaces up by lightness only. If a surface needs
  to stand out, give it a border, not a shadow.
- Use `#333333` for every default border and `#262626` only where a rule is implied
  (card header, settings panel).
- Spend blue on the primary button, links and the selected border — and on nothing
  decorative.
- Put page tabs in the tab strip and dock them into the bar on scroll.
- Give every table a container border and a 36px header; pick 40 or 52px rows per table
  and hold it.
- Keep controls at 30 / 38 / 42 and radius 6; containers at radius 8.
- Write the empty-state title as "No campaigns found" and the description as one plain
  sentence.
- Keep the status pill neutral and let the dot carry the colour.

**Don't**

- Don't use `#ffffff` for text, or `#000000` for the page.
- Don't tint pills, notices or buttons with the status colour at 12% — Cloudflare never
  fills with a tint; it borders and dots.
- Don't uppercase and track-out labels; sentence case at 12–13px does the job.
- Don't put more than one primary button in view. Secondary is the default.
- Don't reintroduce emerald as an action colour anywhere. It is a status now.
- Don't add shadows to dropdowns, dialogs or the assistant card to lift them; use the
  frame and backdrop.
- Don't shrink the 16px card padding or the 20px cell padding to fit more in — drop a
  column instead.
- Don't animate the tab group's active state across tabs; it is a set of buttons.

---

## 9. Page-by-page notes

### 9.1 Campaigns (`index.html`)

Overview page pattern (08.19.19 / 08.23.22) at 1352px: breadcrumb `Campaigns`; page
header — 30px title, description, actions `Docs` (secondary lg) + `New campaign`
(primary lg); the two headline figures and the range control become one row: figures as
14px `#a1a1a1` labels with mono values left, the "Last 30 days" range button right. The
four metric cards become §6.9 stat cards with sparklines, 16px gaps. Toolbar: search
(flex) + "Campaign name" filter select + "Columns" and sort selects as secondary md +
refresh icon button, 12px gaps. The table per §6.11 at 56px two-line rows (name +
ID/objective), status pill, mono trigger, mono figures, rating in the ramp colour,
relative time `#a1a1a1`, "Open →" secondary sm and ⋯. Pagination row beneath. Footer.

### 9.2 Insights (`insights.html`)

Detail page pattern (08.18.10 → 08.18.34): breadcrumb `Campaigns › <name>`; tab strip
`Delivery | Responses | Impact`; stat strip: Status (pill), Trigger (mono), Channel,
Audience, Started, Responses — six is one too many for 1352px, so Started folds into the
breadcrumb's meta or the strip shows five. The campaign actions (Pause, Stop, Edit,
Export) sit at the right end of the stat strip as secondary md buttons; Export may be a
split button. Filters row (Date range, Segment, App, Variant, Version) as filter selects,
12px gaps, right-aligned range control; the rating-ramp legend stays as a pill. The
version notice becomes a promo-style card (§6.10) without the 12% amber tint: `#0f0f0f`,
`#333333`, an amber icon. Funnel = four stat cards; charts = chart cards two-up. The
largest-drop-off callout is a message panel with the warning icon.

### 9.3 Builder (`builder.html`)

Form pattern (08.19.31) with the wizard kept: breadcrumb `Campaigns › New campaign`
(name once typed), right cluster shows `● Unsaved changes` as a status pill. The stepper
is the tab strip's group: four tabs, reached ones enabled, the current one active, later
ones disabled (`#595959`), each carrying its number. Body: 800px column, 40px top;
step title 20px 600 + intro 16px `#d9d9d9`; groups separated by 1px `#333333` dividers
with 24px above and below; template picker = radio cards (§6.4) two-up; fields per §6.2
with 12px labels; the objective textarea per §6.2; examples as pill buttons. Footer bar:
fixed at the bottom of the content column, 72px, `#0a0a0a`, 1px `#303030` rule, "Step 1
of 4" 13px `#a1a1a1` left, `Save draft` (neutral filled) + `Next` (primary sm) right.
The phone preview in the Content step keeps its device frame on `#0f0f0f`.

### 9.4 Settings (`settings.html`)

Settings pattern (08.18.51): breadcrumb `Settings`; tab strip `General | Delivery |
Alerts`; 954px layout with the 187px sub-nav listing the sections of the active tab
(Workspace, Campaign defaults, Prototype state …), sticky. Each `.ssection` becomes a
§6.7 section header (docs chip optional) with its panel: `.spanel`/`.srow` rows keep
their shape (label + description left, control right) on `#000000` with `#262626` rules;
the per-panel Save foot stays but uses neutral-filled → primary sm. The "prototype state"
reset is a danger text button in a message panel.

### 9.5 Assistant

The companion card is Cloudflare's "Ask AI" surface: opened from the top bar and the
rail, docked bottom-right as today, `#0f0f0f`, 1px `#333333`, radius 8, no shadow; the
ask box is a 38px search-style input; orb and border beam unchanged; message bubbles
`#171717` / transparent. The pointer companion's ring turns `#4693ff`.

---

## 10. Migration map

### 10.1 Token remap (`assets/css/supabase.css` `:root`)

Keep the names so nothing downstream breaks; change the values. Add the new ones.

| Token | Now | Becomes | Note |
| --- | --- | --- | --- |
| `--background-200` | `#121212` | `#030303` | canvas |
| `--background-100` | `#1c1c1c` | `#0f0f0f` | cards, tables, dialogs |
| `--surface-100` | `#232323` | `#171717` | inputs, inset, hover |
| `--surface-200` | `#282828` | `#1f1f1f` | pressed, pagination |
| `--surface-300` | `#323232` | `#262626` | scrollbar thumb |
| *(new)* `--well` | — | `#000000` | settings panels, form fields |
| *(new)* `--band` | — | `#060606` | chart-card header, category rows |
| *(new)* `--panel` | — | `#0a0a0a` | drawer, card body under a header |
| `--border-muted` | `#232323` | `#262626` | |
| `--border-default` | `#2e2e2e` | `#333333` | |
| `--border-strong` | `#3e3e3e` | `#404040` | |
| `--border-overlay` | `#4d4d4d` | `#333333` | overlays no longer lift by border |
| *(new)* `--border-input` | — | `#797979` | form fields |
| `--foreground-muted` | `#707070` | `#797979` | |
| `--foreground-lighter` | `#898989` | `#a1a1a1` | |
| `--foreground-light` | `#b4b4b4` | `#d9d9d9` | |
| `--foreground-default` | `#ededed` | `#f5f5f5` | |
| `--brand-default` | `#3ecf8e` | `#005fec` | "brand" now means action blue |
| `--brand-600` | `#24b47e` | `#004dcc` | button border, pressed |
| `--brand-400` | `rgba(62,207,142,.35)` | `rgba(8,112,255,.35)` | focus, selected borders |
| `--brand-200` | `rgba(62,207,142,.12)` | `rgba(8,112,255,.12)` | selected fills |
| `--on-brand` | `#121212` | `#ffffff` | |
| *(new)* `--brand-gradient` | — | `linear-gradient(180deg,#2674f0,#1169ee 50%,#005eec)` | |
| *(new)* `--link` / `--link-soft` / `--link-action` | — | `#0870ff` / `#4693ff` / `#82b6ff` | |
| *(new)* `--success` | — | `#00d492` | Live dot, toggle |
| `--destructive` | `#e5484d` | `#ec2527` | button mid-stop |
| `--destructive-fg` | `#ff9592` | `#fe9f97` | |
| `--destructive-400` / `-200` | red tints | keep values | only for the error border/fill on fields |
| `--warning` | `#ffb224` | `#f0b620` | |
| `--warning-fg` | `#ffcb62` | `#f6c75a` | |
| `--info` | `#3e9bff` | `#4693ff` | |
| `--ai` | `#a78bfa` | `#7367e5` | |
| `--ai-fg` | `#c4b5fd` | `#a9a2f0` | |
| `--rating-1…5` | `#e5484d … #3ecf8e` | `#ff6467 · #f76b15 · #f0b620 · #7cc47f · #00d492` | |
| `--radius-xs` | 4px | 4px | inline chip only |
| `--radius-sm` / `-md` / `-lg` | 6 / 8 / 12 | 6 / 8 / 12 | unchanged; usage changes (§4) |
| `--shadow-1/2/3` | shadows | `none` | keep the tokens, stop using them |
| `--rail-w` | 212px | 260px | expanded sidebar |
| `--rail-w-collapsed` | 60px | 56px | |
| `--rail-item` | 30px | 32px | |
| `--bar-h` | 48px | 58px | top bar and tab strip |
| *(new)* `--strip-h` | — | 76px | stat strip |
| *(new)* `--foot-h` (site footer) | — | 60px | the wizard's `--foot-h` becomes 72px |
| `--content-max` | 1400px | 1352px | plus `--content-list` 1024, `--content-form` 800, `--content-settings` 954 |
| *(new)* `--control-sm/md/lg` | — | 30 / 38 / 42px | |

### 10.2 Primitives

| Primitive | Now | Becomes | Spec |
| --- | --- | --- | --- |
| **Type** `.t-display` | 22px 500 | 30px 600 −0.02em | §3 page title |
| `.t-h1` | 18px 500 | 20px 600 | compact title |
| `.t-h2` | 15px 500 | 16px 600 | heading small |
| `.t-h3` | 13px 500 | 14px 500 | UI label |
| `.t-body` | 13px | 14px / 1.5 | body |
| `.t-sm` / `.t-xs` | 12 / 11px | 13 / 12px | small / caption |
| `.t-micro` | 10px uppercase tracked | 12px sentence case, `#a1a1a1` | drop uppercase |
| `.mono` `.num` | JetBrains 13px | unchanged; IDs `#a1a1a1` | §3 |
| **Shell** `.app` | flex, 100vh | grid: `56px 1fr` columns, `58px auto 1fr 60px` rows | §5 |
| `.rail` | 212 / 60px, `#1c1c1c` | 56 / 260px, `#030303`, border `#333333` | §5.1–5.2 |
| `.rail-brand` | 48px row with name | 56×58 logo cell; name only when expanded | §5.1 |
| `.rail-link` | 30px, 12.5px, inset 2px emerald bar when current | 32px square (collapsed) / 35px pitch 13px 500 (expanded); current = `#171717` fill, `#f5f5f5` icon, no bar | §5.1 |
| `.rail-group + .rail-group` | 8px + rule | 12px + 34px `#333333` rule + 12px | §5.1 |
| `.rail-collapse` | text button | icon-only toggle, 26px from bottom | §5.1 |
| `.rail-tip` | body-level tooltip | unchanged, restyled per §6.18 | |
| `.topbar` | 48px, switchers + search + env + help + avatar | 58px, breadcrumb + env pill + Assistant + Help + avatar; border `#252525` | §5.3 |
| `.switcher` (workspace / app) | inline in top bar | popover from the logo cell / sidebar row 1 | §5.6 |
| `.search-wrap` in `.topbar` | 260px input | quick-search popover from the rail's search item | §5.6 |
| `.env` | tinted emerald pill | neutral status pill with green/amber dot | §6.13 |
| `.avatar` | 26px | 28px, `#171717`, `#333333` | §6.13 |
| *(new)* `.crumbs` | — | breadcrumb per §5.3 | |
| *(new)* `.tabstrip` | — | 58px band + tab group; docks into the bar on scroll | §5.4 |
| *(new)* `.stat-strip` | — | 76px band of label/value columns | §6.8 |
| *(new)* `.site-foot` | — | 60px footer | §5.7 |
| `.page` | 1400px, 24px padding | 1352 / 1024 / 800 / 954px per page type, 40px top | §5.5 |
| `.page-head` / `-title` / `-desc` / `-actions` | 22px title, 13px desc, actions | 30px 600 title (+icon, +pill), 14px `#a1a1a1` desc 8px, lg actions | §6.6 |
| `.page-tabs` | underline tabs under the header | removed; tabs live in `.tabstrip` | §5.4 |
| `.section-head` | 17px h2 + 12.5px p | 16px 600 + docs chip, 14px `#d9d9d9`, right action | §6.7 |
| **Buttons** `.btn` | 30px, 13px, radius 6 | 38px md, 14px 500, radius 6; `.btn-sm` 30px, `.btn-lg` 42px | §6.1 |
| `.btn-primary` | emerald flat, dark text | blue gradient, `#004dcc` border, inset highlight, white text; disabled `#425d81` | §6.1 |
| `.btn-default` | `#232323` / `#3e3e3e` | `#0f0f0f` / `#333333` / `#f5f5f5` (this is the secondary) | §6.1 |
| `.btn-outline` | transparent / `#3e3e3e` | merge into `.btn-default` | |
| `.btn-ghost` | transparent | text button `#82b6ff`; `.btn-ghost` on icons = icon button `#a1a1a1` → `#f5f5f5` | §6.1 |
| *(new)* `.btn-neutral` | — | `#999999` fill, `#0a0a0a` text — Cancel in footers | §6.1 |
| `.btn-danger` | red 12% tint | red gradient, white text; disabled `#7b211e` | §6.1 |
| `.btn-link` | underlined ink | `#0870ff` underlined in prose | §2.3 |
| `.btn-icon` | 30px | 38px (md), 30px (sm) | §6.1 |
| `.split` | seam border | unchanged, secondary styling | |
| **Forms** `.input` | 32px, 13px, `#121212` / `#3e3e3e`, emerald focus ring | search: 38px `#171717` / `#333333`; form: 36px `#000000` / `#797979` (`.input-form`); focus border `#a1a1a1` + 2px `#4693ff` outline | §6.2 |
| `.input-sm` | 28px | 30px | |
| `.select` | chevron bg image | toolbar: secondary-button look with ⌃⌄; form: `#000000` with rule + ▾ cell | §6.2 |
| `.textarea` | 68px min | 96px min, form style | §6.2 |
| `.label` | 12px 500 `#b4b4b4` | 12px 500 `#797979`, 6px gap | §6.2 |
| `.hint` | 11px | 12px `#999999` | §6.2 |
| `.check` | 15px, emerald when checked | 16px, `#797979` ring, `#595959` fill + white check | §6.3 |
| `.radio` | 15px, emerald | 16px, `#797979` ring, `#d9d9d9` dot | §6.3 |
| `.switch` | 34×19 emerald | 40×22, `#404040` / `#1a6535` + `#55d484` | §6.3 |
| `.opt` (radio card) | `#1c1c1c`, 10px 12px | transparent, `#3d3d3d`, 24px, selected `#0870ff` | §6.4 |
| `.unit` / `.unit-suffix` / `.unit-note` | | form style; suffix `#797979`; note 12px | §6.2 |
| **Containers** `.card` | `#1c1c1c` / `#2e2e2e` | `#0f0f0f` / `#333333` / radius 8 | §6.10 |
| `.card-head` | 10px 16px, rule `#2e2e2e` | 44px, rule `#262626`, body `#0a0a0a` | §6.10 |
| `.card-body` / `.card-pad` | 16px | 16px (unchanged) | |
| `.card-foot` | 8px 16px | `#030303` band, 14px padding, rule `#333333` | §6.10 list card |
| `.well` | `#121212` | `#000000` / `#262626` | §6.10 |
| `.callout` | icon tile + text + button | promo card per §6.10, no tint | |
| `.icon-tile` | 28px `#282828` | 24px blue glyph (list card) or 28px `#171717` | §6.10 |
| `.notice` (`-info/-warning/-danger/-ai`) | tinted 12% fills | `#0f0f0f` + `#333333` + coloured 16px icon; text `#d9d9d9` | §6.10, §8 |
| `.spanel` / `.srow` / `.spanel-foot` | `#1c1c1c`, rules `#2e2e2e` | `#000000`, `#262626`, rows 16px; foot `#030303` band; save = neutral → primary sm | §6.10, §9.4 |
| `.ssection` / `-title` / `-desc` / `-actions` | 15px / 12.5px | section header §6.7 | |
| `.kv` | 11.5px | 14px keys `#d9d9d9` 176px column, values `#f5f5f5`, 36px pitch | §6.10 settings panel |
| `.zero` / `.zero-icon` | 56px padding, 40px circle | empty-state panel §6.14 | |
| `.toolbar` | 8px 10px, rule | no rule; 12px gaps; 16px below | §9.1 |
| **Table** `.table th` | 11px uppercase, `#232323` | 36px, 13px 500 `#a1a1a1` sentence case, `#0f0f0f`, 20px padding | §6.11 |
| `.table td` | 12.5px, 9px 12px, rule `#232323` | 14px, rows 40 / 52 / 56px, 20px padding, rule `#333333` | §6.11 |
| `.table-scroll` | | container gets `#333333` border + radius 8 | §6.11 |
| *(new)* `.pager` | — | pagination §6.12 | |
| **Tabs** `.tabs` / `.tab` | underline, emerald marker | `.tabs-group` (pill group §5.4) for page tabs; `.tabs` keeps the underline in `#005fec` for in-content sub-tabs | §6.5 |
| `.tabs-sub` | boxed tabs | settings sub-nav §6.5 | |
| `.tab-pill` | travelling emerald bar | `#005fec`, sub-tabs only | §6.5 |
| **Badges** `.badge` | 18px radius 4 | 20px pill, `#0f0f0f` / `#333333` / 12px `#a1a1a1` | §6.13 |
| `.badge-brand` / `-warning` / `-danger` | tinted | neutral pill + coloured dot, or text colour only | §6.13 |
| `.badge-ai` | violet tint | dotted `#7367e5` Beta-style | §6.13 |
| `.pill` (status) | tinted per status | neutral 22px pill, dot carries the colour; Live pulse kept | §6.13 |
| `.chip` | 24px `#232323` | 24px `#0f0f0f` / `#333333`, × `#a1a1a1` | |
| **Overlays** `.scrim` | `rgba(0,0,0,.6)` | `rgba(10,10,10,.85)` | §6.15 |
| `.dialog` | 480px, `#1c1c1c`, `#4d4d4d`, shadow | 500px framed panel, no shadow; `.dialog-lg` 720, `.dialog-xl` 960 | §6.15 |
| `.dialog-head` / `-body` / `-foot` | 12/16 padding, foot `#121212` | head 56px, body 20–24px, foot 68px (form) or 44px frame band (confirm) | §6.15 |
| *(new)* `.drawer` | — | 400px right drawer | §6.16 |
| `.dd-menu` / `.dd-item` | `#1c1c1c`, `#4d4d4d`, shadow-3 | `#0f0f0f`, `#333333`, no shadow, 36px items | §6.17 |
| `.toast` | emerald left border, shadow | dot + border, no shadow | §6.18 |
| `.tip::after` | `#282828` | `#171717` / `#333333` | §6.18 |
| **Data** `.stat` / `-label` / `-value` | 10px uppercase label, 18px mono | 96px stat card: 12–14px label, 24px 600 value | §6.9 |
| `.metric` / `-head` / `-value` / `-axis` | 26px mono, sparkline | stat card with sparkline at 112px; value 24px | §6.9 |
| `.figures` / `.figure` / `-value` | left-rule columns, 26px | four stat cards in a row, or legend-row style with `#333333` rules and 16px values | §6.19 |
| `.chart` / `.chart-grid` / `.chart-rule` | dashed rules, 46px gutter | dashed `#2b2d2e`, 48px gutter, labels `#9da3af`, 240px plot | §6.19 |
| `.chart-tip` | `#121212`, `#4d4d4d`, shadow | `#0f0f0f`, `#333333`, no shadow | §6.19 |
| `.legend` / `.legend-scale` | boxed ramp legend | unchanged, on `#0f0f0f` / `#333333` | |
| `.bar-track` / `.bar-fill` | 8px `#282828` | 6px `#404040`, fills per palette | §6.19 |
| `.dist-row` | grid | unchanged; values mono `#f5f5f5` | |
| `.rating-val`, `.rate-*`, `.star-btn` | ramp | re-tuned ramp §2.4 | |
| `.skel` | `#232323` | `#171717` | §6.22 |
| **Builder** `.builder-head` | `#1c1c1c` bar with stepper | top bar + tab strip carrying the stepper | §9.3 |
| `.stepper` / `.step` / `-num` / `-state` | boxed steps | tabs in the group; number as a 20px pill; states by enabled/active/disabled | §9.3 |
| `.builder-foot` | 51px | 72px, `#0a0a0a`, `#303030` rule, neutral + primary sm | §9.3 |
| `.tpl-grid` / `.tpl-card` / `.tpl-hover` | `#1c1c1c`, emerald on select | radio cards §6.4; selected border `#0870ff`; hover overlay stays but neutral | |
| `.phone` / `.device` / `.dv-*` | | unchanged; frame on `#0f0f0f` | |
| **Assistant** `.asst-card` | `#1c1c1c`, violet border, shadow | `#0f0f0f`, `#333333`, no shadow; orb, beam, streaming unchanged | §9.5 |
| `.asst-ask-*` | | 38px search-style input, primary send icon | |
| `.asst-pointer-ring` | violet | `#4693ff` | |

---

## Appendix A — measured anchors

Numbers a reviewer is most likely to challenge, with their source.

| Item | Measured | Capture |
| --- | --- | --- |
| Top bar | 57px + 1px `#252525` | 08.18.10 scan x=1000 |
| Rail | 55px + 1px `#333333`; icon pitch 41 disp = 35px; divider 34px | 08.18.10 scans |
| Tab strip | 57px + 1px, band `#000000` | 08.18.10 |
| Tab group | 38px; active tab 34px, `#0f0f0f` / `#333333`; group `#0b0b0b` / `#1c1c1c` | 08.18.10 |
| Stat strip | ~75px, 20px padding, 80px column gap | 08.18.10 |
| Primary button | 38px; gradient `#2674f0 → #005eec`; edge `#024eca`; top row `#5893f6` | 08.18.10, 08.23.11 |
| Secondary lg | 42px, `#0f0f0f` / `#333333` | 08.19.19, 08.23.22 |
| Footer buttons | 30px (form), 33px (drawer); Cancel `#999999` with `#0a0a0b` text | 08.19.31, 08.20.45 |
| Search input | 36px + borders, `#171717` / `#333333` | 08.18.10, 08.23.11 |
| Form input | 35–36px, `#000000` / `#797979` | 08.19.31, 08.20.45 |
| Table (Presets) | header 36px, rows 52px, rules `#333333`, cell padding 20px | 08.23.11 |
| Table (Objects) | header 39px + rule, rows 40px, rules `#404040`, rows `#000000` | 08.18.10 |
| Table (Billing) | rows 47–56px, category rows 33px `#060606` | 08.19.06 |
| Stat card | 96–98px, `#0f0f0f` / `#333333`, 16px padding; gaps 14px (row) / 12px (2×2) | 08.18.34, 08.19.19, 08.21.20 |
| Chart card header | 36px `#060606`, rule `#252626` | 08.18.34 |
| Empty panel | `#171717`, `#333333` + inner `#262626`, 230px inner height | 08.19.19 |
| Message panel | 55px, `#000000` / `#262626` | 08.18.51 |
| Settings panel | `#000000` / `#262626`; mono field `#232628` | 08.18.51 |
| Sub-nav bar | 3px `#f8f8f8`, 34px pitch | 08.18.51 |
| Radio card | idle `#3d3d3d`, selected `#0870ff`; radio 16px `#797979`, dot 8px `#d9d9d9` | 08.19.31 |
| Checkbox | checked fill `#595959`, ring `#797979` | 08.18.10, 08.20.45 |
| Toggle on | track `#1a6535`, knob/check `#55d484`; off track `#404040` | 08.20.45, 08.22.48 |
| Drawer | 400px, `#0a0a0a`, edge `#2c2c2c`, rules `#303030` | 08.20.45 |
| Confirm dialog | 500px; frame `#050505` / `#333333`; panel `#0f0f0f` / `#272727`; footer band 43px | 08.23.29 |
| Form dialog | 960px; header 56px; footer 68px; halo `#090909` / `#121212` | 08.22.48 |
| Backdrop tone | page `#030303` → `#0a0a0a` | 08.22.48, 08.23.29 |
| Pagination | cells `#1e1f1f`, current `#171717`, rules `#2b2b2b`, 5 × 43px | 08.23.11 |
| Status dot | `#00d492` | 08.19.06 |
| Danger button | `#f03c37 → #e90817`; disabled `#7b211e`; trash icon `#ff6467`; text `#fe9f97` | 08.19.06, 08.23.29, 08.23.11, 08.18.51 |
| Docs chip | `#7367e5` | 08.18.51 |
| Beta pill | dotted `#005aeb`, text `#51a1fe` | 08.18.51 |
| Chart series | `#4390f0`, `#f0b620`, `#e7639d`, `#848589`; grid `#2b2d2e`; axis text `#9da3af` | 08.18.34 |
| Content widths | 1321–1353 / 1025 / 800 / 954 (187 + 27 + 740) | 08.18.34, 08.19.19, 08.23.22, 08.19.31, 08.18.51 |
| Type | title cap 22–23.5px → 30–32px; body cap 10.5px → 14px; small cap 9.5px → 13px; caption cap 9px → 12px | many |

## Appendix B — light mode (recorded, not specified)

From 06.39.55, for when a light theme is wanted: page, sidebar and bar `#fbfbfb`; cards
`#ffffff`; card header band `#f9f9f9`; borders `#e3e3e3`; active nav item `#f3f3f3`;
tab group `#f3f3f3` with the active tab `#ffffff`; text `#171717` / `#737373`; icons
`#8a8a8a`; primary gradient `#3583ff → #0d70ff` with a `#055fde` edge. The expanded
sidebar is 260px with the account switcher on row 1 and "Quick search ⌘K" on row 2. The
neutral ramp is the dark ramp mirrored: black at the same opacities over white.
