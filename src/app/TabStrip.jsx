/* ==========================================================================
   TabStrip.jsx — the band under the bar (§5.4), on Kumo's Tabs.

   §11.4's note holds: `variant="segmented"` is the console's tab group and
   `underline` is the sub-tabs inside a panel. Kumo animates the active
   indicator itself, which is what `.tabgroup-tab[aria-selected]`'s transition
   was reimplementing.

   Two things about Kumo's API shaped this. `Tabs` takes a `tabs` array rather
   than children, so the strip is data in and nothing else. And `TabsItem` has
   no `disabled` — but its `label` is a ReactNode and it takes a `render`, so
   the glyph/label/badge composition goes in the label and a step the wizard
   has not unlocked yet is rendered as a disabled button.
   ========================================================================== */
import { Tabs, Badge } from '@cloudflare/kumo';

export function TabGroup({ spec }) {
  if (!spec) return null;

  const tabs = spec.items.map((tab) => ({
    value: tab.key,
    label: (
      <span className="ih-tab-label">
        {tab.glyph && <span className="ih-tab-glyph">{tab.glyph}</span>}
        {tab.label}
        {tab.badge && <Badge variant="neutral" size="sm">{tab.badge}</Badge>}
      </span>
    ),
    // FR-69 — a step that is not reachable yet is present but inert, so the
    // wizard's length stays legible from step 1.
    ...(tab.disabled ? { render: <button type="button" disabled /> } : {}),
  }));

  return (
    <Tabs
      variant="segmented"
      size="sm"
      tabs={tabs}
      value={spec.active}
      onValueChange={(key) => { if (key !== spec.active) spec.onSelect?.(key); }}
      aria-label={spec.label || 'Page sections'}
    />
  );
}
