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
  CHANNEL_LABEL, elementLabel, isBrush, rangeLabel, scaleMax, tabsFor, variantsOf,
  volumeLabel, volumeOf,
} from '../lib/insights-lib.js';
import { SEGMENTS, SCORE_DRIVERS, KIND_LABEL, campaignKind, isFeedback } from '../lib/data.js';
import { publishFilters } from '../lib/assistant-context.js';

const params = () => new URLSearchParams(window.location.search);

/* What every filter reads as when it is not filtering, so "is anything on"
   is one comparison rather than five special cases. */
const NO_FILTERS = {
  range: '30d', segment: 'all', app: 'all', variant: 'all', version: 'all', theme: 'all',
};

export function Insights() {
  const store = useStore();
  usePalette();
  const [tab, setTab] = useState(() => params().get('tab'));
  /* FR-92 — filters apply across all tabs and persist when switching. */
  const [filters, setFilters] = useState(NO_FILTERS);
  const [confirm, setConfirm] = useState(null);

  /* One writer for every filter, wherever it is set from — the controls, a
     value pressed inside a panel, a window drawn on the chart. They all mean
     the same thing, so they all go through the same door. */
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const id = params().get('id');
  const c = store.state.campaigns.find((x) => x.id === id)
    || store.state.campaigns.find((x) => x.status === 'Live')
    || store.state.campaigns[0];

  /* FR-92 keeps the filters across a tab switch — which means they also
     survive a move to a different campaign. A variant name or a version number
     carried over from the campaign you just left would silently filter this
     one down to nothing, so anything the current campaign cannot honour
     resets to `all`.

     A brushed window and a theme are two more of the same kind. The window is
     a pair of dates drawn on the series this campaign no longer has, and a
     theme is a cluster found in responses only a feedback campaign collects —
     both would survive as data and stop meaning anything. */
  useEffect(() => {
    if (!c) return;
    const names = variantsOf(c).map((v) => v.name);
    setFilters((f) => ({
      ...f,
      range: isBrush(f.range) ? NO_FILTERS.range : f.range,
      variant: f.variant !== 'all' && !names.includes(f.variant) ? 'all' : f.variant,
      version: f.version !== 'all' && Number(f.version) > (c.versions || 1) ? 'all' : f.version,
      theme: isFeedback(c) ? f.theme : 'all',
    }));
  }, [c?.id]);

  /* Escape drops a brushed window back to the preset it replaced. The plot is
     not focusable, so this is the one key the gesture answers to — and it is
     bound only while a brush is on, which is the only time it has anything to
     undo. `InsightChart` handles the other Escape, the one that abandons a
     drag before it has committed to anything here. */
  useEffect(() => {
    if (!isBrush(filters.range)) return undefined;
    const clear = (e) => { if (e.key === 'Escape') setFilter('range', NO_FILTERS.range); };
    window.addEventListener('keydown', clear);
    return () => window.removeEventListener('keydown', clear);
  }, [isBrush(filters.range)]);

  /* What the assistant is allowed to say this page is filtered to. The
     vanilla build read it back out of the rendered selects; publishing it is
     the same coupling with none of the guesswork. */
  useEffect(() => { publishFilters(filters); }, [filters]);

  const tabs = c ? tabsFor(c) : [];
  const active = tabs.includes(tab) ? tab : 'delivery';

  useCrumbs(
    c
      ? [{ label: 'Campaigns', href: 'index.html', icon: 'megaphone' }, { label: c.name }]
      : [{ label: 'Campaigns', href: 'index.html', icon: 'megaphone' }, { label: 'Not found' }],
    [c?.id, c?.name],
  );

  /* FR-88 — the tab lives in the URL so a view is shareable. Lifted out of the
     tab strip's own handler because the strip is no longer the only thing that
     moves between tabs: pressing a score driver opens the responses behind it,
     and a tab reached that way has to leave the same URL as one clicked. */
  const goTab = (key) => {
    const p = params();
    p.set('tab', key);
    if (!p.get('id')) p.set('id', c.id);
    window.history.replaceState(null, '', `?${p}`);
    setTab(key);
  };

  useTabs(c ? {
    label: 'Insights sections',
    items: tabs.map((t) => ({ key: t, label: t[0].toUpperCase() + t.slice(1) })),
    active,
    onSelect: goTab,
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

  /* A window drawn on the chart is still the Date range filter, so the Date
     range control is where it has to show. It joins the menu as its own
     option, named by its own bounds — which makes the control state what is
     on, and makes picking any preset the way back out of a gesture there is
     otherwise no button to undo. Selecting it while it is already selected is
     the only inert row in these menus, and it is inert because it is already
     true. */
  const brushed = isBrush(filters.range);
  const rangeItems = {
    ...(brushed ? { brush: rangeLabel(filters.range) } : {}),
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    all: 'All time',
  };

  // FR-92 — the version filter only exists where there is a boundary to filter
  // to, so a single-version campaign does not carry a control with one option.
  const filterDefs = [
    ['range', 'Date range', rangeItems],
    ['segment', 'Segment', { all: 'All segments', ...Object.fromEntries(SEGMENTS.map((s) => [s.id, s.name])) }],
    ['app', 'App', { all: 'All apps', android: 'Android', ios: 'iOS', web: 'Web' }],
    ['variant', 'Variant', { all: 'All variants', ...Object.fromEntries(variantsOf(c).map((v) => [v.name, v.name])) }],
    ...(c.versions > 1 ? [['version', 'Version', {
      all: 'All versions',
      ...Object.fromEntries(Array.from({ length: c.versions }, (_, i) => [String(i + 1), `Version ${i + 1}`])),
    }]] : []),
    // FR-106's themes, as a filter. Only a feedback campaign has open text for
    // a theme to have been found in.
    ...(feedback ? [['theme', 'Theme', {
      all: 'All themes',
      ...Object.fromEntries(SCORE_DRIVERS.map((d) => [d.themeId, d.name])),
    }]] : []),
  ];

  /* Every filter that is currently narrowing the page, in the order the
     controls above present them. The controls say what *can* be filtered; this
     says what *is*, which is the question a reader has after a click somewhere
     else in the page set one for them. */
  const activeFilters = filterDefs
    .filter(([key]) => filters[key] !== NO_FILTERS[key])
    .map(([key, label, items]) => ({
      key,
      label,
      value: key === 'range' ? rangeLabel(filters.range) : items[filters[key]] || filters[key],
    }));

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
              // A brushed window has no preset key to select by, so it answers
              // to the one the menu carries it under.
              value={key === 'range' && brushed ? 'brush' : filters[key]}
              items={items}
              onValueChange={(v) => {
                // Re-selecting the brush is the menu agreeing with itself.
                if (key === 'range' && v === 'brush') return;
                setFilter(key, v);
              }}
            />
          </label>
        ))}
        {feedback && <RatingLegend max={max} label={elementLabel(c)} />}
      </div>

      {/* What is actually narrowing the page. Cross-filtering makes a filter
          something you set by pressing a value three panels down, so the set
          of them has to be visible and removable somewhere that is not the
          control it came from. */}
      {activeFilters.length > 0 && (
        <div className="ih-xf-bar">
          <Text size="xs" variant="secondary">Filtered by</Text>
          {activeFilters.map((f) => (
            <button
              type="button"
              className="ih-xf-chip"
              key={f.key}
              aria-label={`Remove the ${f.label} filter, ${f.value}`}
              onClick={() => setFilter(f.key, NO_FILTERS[f.key])}
            >
              {f.label} <b>{f.value}</b>
              <Icon name="x" size={11} />
            </button>
          ))}
          {activeFilters.length > 1 && (
            <button
              type="button"
              className="ih-xf-clear"
              onClick={() => setFilters(NO_FILTERS)}
            >
              Clear all
            </button>
          )}
        </div>
      )}

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
        {active === 'delivery' && (
          <DeliveryTab
            campaign={c}
            filters={filters}
            onBrush={(window) => setFilter('range', window)}
            /* Settings → General → Keyboard. Threaded rather than read inside
               the chart, which has no other reason to know the store exists —
               and `undefined` from an older saved state has to read as on,
               since the setting was added after the navigation it governs. */
            keyboard={store.state.chartKeys !== false}
          />
        )}
        {active === 'responses' && (
          <ResponsesTab
            campaign={c}
            filters={filters}
            onFilter={setFilter}
            /* Settings → General → Interaction. Same shape as `keyboard`, and
               `undefined` from an older saved state reads as on for the same
               reason — the setting arrived after the behaviour it governs. */
            crossFilter={store.state.crossFilter !== false}
          />
        )}
        {active === 'engagement' && <EngagementTab campaign={c} filters={filters} />}
        {active === 'impact' && (
          <ImpactTab
            campaign={c}
            filters={filters}
            /* The theme and the tab move together, because the theme filter
               narrows one list and that list is on the other tab. Setting it
               and leaving the reader here would look like nothing happened. */
            onDrillTheme={(themeId) => { setFilter('theme', themeId); goTab('responses'); }}
            crossFilter={store.state.crossFilter !== false}
          />
        )}
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
