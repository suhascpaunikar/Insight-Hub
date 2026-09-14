/* ==========================================================================
   Insights.jsx — the campaign data screen (FR-86 … FR-110).

   Built on the current PRD revision: one generic app-experience rating, and a
   score driver breakdown in place of the old food-vs-delivery matrix.
   ========================================================================== */
import { useEffect, useState } from 'react';
import { LayerCard, Badge, Select, Banner, Text, Tooltip, Empty, Link } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { useStore, usePalette } from '../lib/useStore.js';
import { toast } from '../lib/toast.js';
import { useCrumbs, useTabs, useStrip } from '../app/ShellContext.jsx';
import { ConfirmDialog } from '../app/dialogs.jsx';
import { DeliveryTab } from './insights/DeliveryTab.jsx';
import { ResponsesTab } from './insights/ResponsesTab.jsx';
import { EngagementTab } from './insights/EngagementTab.jsx';
import { ImpactTab } from './insights/ImpactTab.jsx';
import { count } from '../lib/format.js';
import { RAMP, LOW_SAMPLE } from '../lib/palette.js';
import {
  CHANNEL_LABEL, elementLabel, scaleMax, tabsFor, variantsOf, volumeLabel, volumeOf,
} from '../lib/insights-lib.js';
import { SEGMENTS, KIND_LABEL, campaignKind, isFeedback } from '../lib/data.js';

const params = () => new URLSearchParams(window.location.search);

export function Insights() {
  const store = useStore();
  usePalette();
  const [tab, setTab] = useState(() => params().get('tab'));
  /* FR-92 — filters apply across all tabs and persist when switching. */
  const [filters, setFilters] = useState({
    range: '30d', segment: 'all', app: 'all', variant: 'all', version: 'all',
  });
  const [confirm, setConfirm] = useState(null);

  const id = params().get('id');
  const c = store.state.campaigns.find((x) => x.id === id)
    || store.state.campaigns.find((x) => x.status === 'Live')
    || store.state.campaigns[0];

  /* FR-92 keeps the filters across a tab switch — which means they also
     survive a move to a different campaign. A variant name or a version number
     carried over from the campaign you just left would silently filter this
     one down to nothing, so anything the current campaign cannot honour
     resets to `all`. */
  useEffect(() => {
    if (!c) return;
    const names = variantsOf(c).map((v) => v.name);
    setFilters((f) => ({
      ...f,
      variant: f.variant !== 'all' && !names.includes(f.variant) ? 'all' : f.variant,
      version: f.version !== 'all' && Number(f.version) > (c.versions || 1) ? 'all' : f.version,
    }));
  }, [c?.id]);

  const tabs = c ? tabsFor(c) : [];
  const active = tabs.includes(tab) ? tab : 'delivery';

  useCrumbs(
    c
      ? [{ label: 'Campaigns', href: 'index.html', icon: 'megaphone' }, { label: c.name }]
      : [{ label: 'Campaigns', href: 'index.html', icon: 'megaphone' }, { label: 'Not found' }],
    [c?.id, c?.name],
  );

  /* FR-88 — the tab lives in the URL so a view is shareable. */
  useTabs(c ? {
    label: 'Insights sections',
    items: tabs.map((t) => ({ key: t, label: t[0].toUpperCase() + t.slice(1) })),
    active,
    onSelect: (key) => {
      const p = params();
      p.set('tab', key);
      if (!p.get('id')) p.set('id', c.id);
      window.history.replaceState(null, '', `?${p}`);
      setTab(key);
    },
  } : null, [c?.id, active, tabs.join()]);

  const isRunning = c?.status === 'Live';
  const isPaused = c?.status === 'Paused';

  /* §6.8 / §9.2 — the five facts a reader checks before reading any panel, and
     the campaign's own actions. Five, not six: the spec says the sixth does not
     fit 1352px, so `Started` stays with the ID above the filters. */
  useStrip(c ? {
    // The campaign is the subject; a tab change inside it is not an arrival.
    key: c.id,
    items: [
      { label: 'Status', value: <Badge variant={STATUS_VARIANT[c.status] || 'neutral'} size="sm">{c.status}</Badge> },
      { label: 'Trigger', value: c.triggerLabel, mono: true },
      ...(c.channel ? [{ label: 'Channel', value: CHANNEL_LABEL[c.channel] || c.channel }] : []),
      // The longest value on the strip by some way, and the one most likely to
      // be cut — so it carries its own full text.
      { label: 'Audience', value: c.audienceLabel, hint: c.audienceLabel },
      {
        label: volumeLabel(c)[0].toUpperCase() + volumeLabel(c).slice(1),
        value: count(volumeOf(c)), mono: true,
      },
    ],
    actions: [
      ...(isRunning || isPaused ? [
        { key: 'toggle-status', label: isRunning ? 'Pause' : 'Resume', glyph: <Icon name={isRunning ? 'pause' : 'play'} size={14} /> },
        { key: 'stop', label: 'Stop', glyph: <Icon name="stop" size={14} /> },
      ] : []),
      { key: 'edit', label: 'Edit', glyph: <Icon name="pencil" size={14} /> },
      { key: 'export', label: 'Export', glyph: <Icon name="download" size={14} />, kind: 'secondary' },
    ],
    onAction: (key) => {
      if (key === 'toggle-status') {
        const next = c.status === 'Live' ? 'Paused' : 'Live';
        store.setCampaignStatus(c.id, next);
        toast(next === 'Paused' ? 'Campaign paused' : 'Campaign resumed',
          next === 'Paused'
            ? 'Enrolment is held. Nothing already sent is affected.'
            : 'Rolling enrolment has resumed.');
      } else if (key === 'stop') {
        setConfirm('stop');
      } else if (key === 'edit') {
        // FR-87 — Edit routes a live campaign back into the builder.
        store.editCampaign(c.id);
        window.location.href = 'builder.html';
      } else if (key === 'export') {
        toast('Export queued',
          `A download link for “${c.name}” will arrive by email when it is ready.`);
      }
    },
  } : null, [c?.id, c?.status, active]);

  if (!c) {
    return (
      <div className="ih-page">
        <LayerCard>
          <Empty description="This campaign no longer exists.">
            <Link href="index.html">Back to campaigns</Link>
          </Empty>
        </LayerCard>
      </div>
    );
  }

  const max = scaleMax(c);
  const feedback = isFeedback(c);

  // FR-92 — the version filter only exists where there is a boundary to filter
  // to, so a single-version campaign does not carry a control with one option.
  const filterDefs = [
    ['range', 'Date range', { '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time' }],
    ['segment', 'Segment', { all: 'All segments', ...Object.fromEntries(SEGMENTS.map((s) => [s.id, s.name])) }],
    ['app', 'App', { all: 'All apps', android: 'Android', ios: 'iOS', web: 'Web' }],
    ['variant', 'Variant', { all: 'All variants', ...Object.fromEntries(variantsOf(c).map((v) => [v.name, v.name])) }],
    ...(c.versions > 1 ? [['version', 'Version', {
      all: 'All versions',
      ...Object.fromEntries(Array.from({ length: c.versions }, (_, i) => [String(i + 1), `Version ${i + 1}`])),
    }]] : []),
  ];

  return (
    <div className="ih-page ih-page-insights">
      {/* FR-86 — identity is the breadcrumb's job on a detail page, and the
          five columns the reader checks first are the stat strip's (§9.2).
          What is left here is the rest: the kind, which decides the tab set,
          and the two facts that did not earn a column. */}
      <div className="ih-insights-head">
        <Tooltip content={feedback
          ? 'Collects answers — rating, follow-up questions, open text'
          : 'Collects no answers — reach, engagement and what it converted'}
        >
          <Badge variant="neutral" size="sm">{KIND_LABEL[campaignKind(c)]}</Badge>
        </Tooltip>
        {c.versions > 1 && (
          <Badge variant="outline" size="sm"><Icon name="layers" size={11} />{c.versions} versions</Badge>
        )}
        <span className="ih-kv">
          <span className="ih-mono">{c.campaignId}</span>
          <span>{c.runningDates}</span>
        </span>
      </div>

      {/* FR-92 — filters apply across all tabs and persist between them. */}
      <div className="ih-filters">
        {filterDefs.map(([key, label, items]) => (
          <label className="ih-filter" key={key}>
            <Text size="xs" variant="secondary">{label}</Text>
            <Select
              size="sm"
              aria-label={label}
              value={filters[key]}
              items={items}
              onValueChange={(v) => setFilters((f) => ({ ...f, [key]: v }))}
            />
          </label>
        ))}
        {feedback && <RatingLegend max={max} label={elementLabel(c)} />}
      </div>

      {/* FR-93 — an aggregate spanning a question change is labelled as such. */}
      {c.versions > 1 && filters.version === 'all' && (
        <Banner
          className="ih-mb-16"
          variant="alert"
          icon={<Icon name="layers" size={16} />}
          description={
            <>
              This view aggregates <strong>{c.versions} versions</strong>. A question edited
              mid-flight means the series is not one continuous dataset — filter to a single
              version to read either side on its own.
            </>
          }
        />
      )}

      {/* FR-94 */}
      {volumeOf(c) > 0 && volumeOf(c) < LOW_SAMPLE && (
        <Banner
          className="ih-mb-16"
          variant="alert"
          icon={<Icon name="info" size={16} />}
          description={
            <>
              Only <span className="ih-mono">{count(volumeOf(c))}</span> {volumeLabel(c)} so far —
              below the threshold to read as a rate. Percentages are withheld and raw counts shown
              instead.
            </>
          }
        />
      )}

      <div className="ih-insights-body">
        {active === 'delivery' && <DeliveryTab campaign={c} filters={filters} />}
        {active === 'responses' && <ResponsesTab campaign={c} filters={filters} />}
        {active === 'engagement' && <EngagementTab campaign={c} filters={filters} />}
        {active === 'impact' && <ImpactTab campaign={c} filters={filters} />}
      </div>

      <ConfirmDialog
        open={confirm === 'stop'}
        title={`Stop “${c.name}”?`}
        confirmLabel="Stop campaign"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          store.setCampaignStatus(c.id, 'Stopped');
          toast('Campaign stopped', 'Enrolment has ended. Collected responses remain here.');
          setConfirm(null);
        }}
      >
        Enrolment ends now and cannot be restarted. Responses already collected stay on the
        campaign.
      </ConfirmDialog>
    </div>
  );
}

const STATUS_VARIANT = {
  Live: 'success', Draft: 'neutral', Scheduled: 'info',
  Paused: 'warning', Completed: 'secondary', Stopped: 'secondary',
};

/** FR-89 — the ramp, with the scale it is normalised to stated beside it. */
function RatingLegend({ max, label }) {
  return (
    <div
      className="ih-legend"
      role="img"
      aria-label={`Rating ramp for the ${label} scale, 1 lowest to ${max} highest`}
    >
      <Text size="xs" variant="secondary">Rating ramp</Text>
      <Text size="xs" variant="mono-secondary">1</Text>
      <span className="ih-legend-scale">
        {RAMP.map((colour, i) => (
          <span className="ih-legend-swatch" style={{ background: colour }} key={i} />
        ))}
      </span>
      <Text size="xs" variant="mono-secondary">{max}</Text>
      <Text size="xs" variant="secondary">· {label}</Text>
    </div>
  );
}
