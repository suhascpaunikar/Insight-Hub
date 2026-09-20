/* ==========================================================================
   Campaigns.jsx — the campaign list, the product's landing screen
   (FR-71 … FR-85, list conventions per FR-63).
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Table, Button, Badge, Input, DropdownMenu, Pagination, Empty,
  LayerCard, Text, Tooltip, RefreshButton,
} from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { useStore, usePalette } from '../lib/useStore.js';
import { toast } from '../lib/toast.js';
import { useCrumbs } from '../app/ShellContext.jsx';
import { MetricCard } from '../app/MetricCard.jsx';
import { ConfirmDialog } from '../app/dialogs.jsx';
import { RenameDialog } from '../app/RenameDialog.jsx';
import { count, percent, relativeTime, absoluteTime, ratingText } from '../lib/format.js';
import { ratingColor } from '../lib/palette.js';
import { resetState } from '../lib/persist.js';
import {
  WORKSPACE_SERIES, RANGES, isFeedback, KIND_LABEL, campaignKind,
} from '../lib/data.js';

/* The four presets the sort menu offers, each a (column, direction) pair. The
   menu and the column headers drive the same two values, so a preset chosen
   from the menu lights up the header it sorts by, and a header clicked in the
   table shows in the menu as the preset it matches. */
const SORTS = {
  updated: { label: 'Most recently updated', key: 'updated', dir: 'desc' },
  responses: { label: 'Most responses', key: 'responses', dir: 'desc' },
  name: { label: 'Name A–Z', key: 'name', dir: 'asc' },
  rating: { label: 'Lowest average rating', key: 'rating', dir: 'asc' },
};

/* Which way a column sorts when you first click its header: names read A–Z,
   everything else opens on "most". */
const SORT_FIRST_DIR = { updated: 'desc', responses: 'desc', rating: 'asc', name: 'asc' };
const SORT_LABEL = { name: 'Campaign', responses: 'Responses', rating: 'Avg rating', updated: 'Updated' };

/* FR-73 — the two campaign states the page description names, plus the three
   in between. "All" first, then the order a campaign moves through. */
const STATUS_TABS = ['All', 'Live', 'Draft', 'Scheduled', 'Paused', 'Completed'];

const COLUMN_LABELS = {
  trigger: 'Trigger', responses: 'Responses', rating: 'Avg rating', updated: 'Updated',
};

/* §6.12 — a page holds five rows. Seven seeded campaigns against a page size
   of ten meant the second page did not exist; five gives the seeded list two
   pages, so the control is real. */
const PAGE_SIZE = 5;

const COMPARE = {
  name: (a, b) => a.name.localeCompare(b.name),
  responses: (a, b) => a.responses - b.responses,
  updated: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
  rating: (a, b) => {
    if (a.avgRating == null && b.avgRating == null) return 0;
    if (a.avgRating == null) return 1;
    if (b.avgRating == null) return -1;
    return a.avgRating - b.avgRating;
  },
};

/** FR-76 — a labelled badge with a state dot, legible without colour. */
const STATUS_VARIANT = {
  Live: 'success', Draft: 'neutral', Scheduled: 'info',
  Paused: 'warning', Completed: 'secondary', Stopped: 'secondary',
};
const StatusPill = ({ status }) => (
  <Badge variant={STATUS_VARIANT[status] || 'neutral'} size="sm">
    <span className="ih-dot" data-status={status} aria-hidden="true" />{status}
  </Badge>
);

/** FR-90 — one decimal, monospaced, coloured on the shared ramp. */
function RatingValue({ value, scaleMax = 5 }) {
  if (!value) return <Text size="sm" variant="mono-secondary">—</Text>;
  return (
    <>
      <span className="ih-rating-val" style={{ color: ratingColor(value, scaleMax) }}>
        {ratingText(value)}
      </span>
      <Text size="xs" variant="mono-secondary"> /{scaleMax}</Text>
    </>
  );
}

/** Deleting is for campaigns that are not currently sending to anyone. */
const canDelete = (c) => c.status !== 'Live' && c.status !== 'Paused';
/** Only a campaign that has run has anything to export. */
const hasData = (c) => c.status !== 'Draft' && c.status !== 'Scheduled';

export function Campaigns() {
  const store = useStore();
  usePalette();
  useCrumbs([{ label: 'Campaigns', icon: 'megaphone' }], []);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('updated');
  const [dir, setDir] = useState('desc');
  const [range, setRange] = useState('30d');
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState({ trigger: true, responses: true, rating: true, updated: true });
  const [dialog, setDialog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const source = store.state.emptyDashboard ? [] : store.state.campaigns;

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    // Name, ID and trigger are three ways of naming the same campaign, so
    // they are searched together rather than behind a select the reader has
    // to find first.
    return source.filter((c) => [c.name, c.campaignId, c.triggerLabel]
      .some((field) => String(field || '').toLowerCase().includes(q)));
  }, [source, query]);

  const matched = useMemo(() => {
    const filtered = searched.filter((c) => status === 'All' || c.status === status);
    const sorted = [...filtered].sort(COMPARE[sort] || COMPARE.updated);
    /* Descending reverses the comparator's order, except for the unrated,
       which stay at the bottom in both directions. */
    if (dir === 'desc') {
      const rated = sorted.filter((c) => sort !== 'rating' || c.avgRating != null);
      const rest = sorted.filter((c) => sort === 'rating' && c.avgRating == null);
      return [...rated.reverse(), ...rest];
    }
    return sorted;
  }, [searched, status, sort, dir]);

  // Clamped: a search that shortens the list must not strand the reader on a
  // page that no longer exists.
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const list = matched.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const openCampaign = (c) => {
    if (c.status === 'Draft' || c.status === 'Scheduled') {
      store.resumeCampaign(c.id);
      window.location.href = 'builder.html';
      return;
    }
    window.location.href = `insights.html?c=${encodeURIComponent(c.id)}`;
  };

  /** What the sort button says: a preset by name, anything else by column. */
  const sortLabel = () => {
    const preset = Object.values(SORTS).find((s) => s.key === sort && s.dir === dir);
    return preset ? preset.label : `${SORT_LABEL[sort]} ${dir === 'asc' ? 'ascending' : 'descending'}`;
  };

  return (
    <div className="ih-page ih-page-list">
      <header className="ih-page-head">
        <div>
          <h1 className="ih-page-head-title">Campaigns</h1>
          {/* FR-73 — what the two campaign states are actually for, in one line. */}
          <p className="ih-page-head-desc">
            Open a campaign to watch its responses arrive, or read the insights of a finished one.
          </p>
        </div>
        <div className="ih-page-head-actions">
          {/* FR-72 — the only route into campaign creation. */}
          <Button
            variant="primary" size="lg"
            onClick={() => { store.startNew(null); window.location.href = 'builder.html'; }}
          >
            <Icon name="plus" size={16} />New Campaign
          </Button>
        </div>
      </header>

      {source.length > 0 && (
        <ActivityStrip campaigns={source} range={range} onRange={setRange} />
      )}

      {source.length === 0 ? (
        /* FR-85 — explain what a campaign does rather than showing empty headers. */
        <LayerCard>
          <Empty
            icon={<Icon name="megaphone" size={24} />}
            title="No campaigns yet"
            description="A campaign asks your users a question at a moment you choose — after a delivery, after a cancellation, after they lapse — and collects the answers here so you can see what actually happened."
          >
            <Button
              variant="primary"
              onClick={() => { store.startNew(null); window.location.href = 'builder.html'; }}
            >
              <Icon name="plus" size={16} />New Campaign
            </Button>
          </Empty>
        </LayerCard>
      ) : (
        <>
          {/* FR-63 / FR-84 — one toolbar pattern across every list screen.
              Every control here acts on the list *before* the table draws it,
              which is why it sits outside the card rather than inside it.
              §11.4 had no entry for this; Kumo ships `Toolbar`, which renders
              its controls as one grouped card and locks them to one size. */}
          <div className="ih-toolbar">
            <Input
              size="sm"
              className="ih-toolbar-search"
              aria-label="Search campaigns"
              placeholder="Search by name, ID or trigger"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
            <DropdownMenu>
              <DropdownMenu.Trigger render={
                <Button size="sm" variant="secondary"><Icon name="columns" size={14} />Columns</Button>
              } />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Group>
                  <DropdownMenu.Label>Visible columns</DropdownMenu.Label>
                  {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                    <DropdownMenu.CheckboxItem
                      key={key}
                      checked={columns[key]}
                      onCheckedChange={(on) => setColumns((c) => ({ ...c, [key]: on }))}
                    >
                      {label}
                    </DropdownMenu.CheckboxItem>
                  ))}
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenu.Trigger render={
                <Button size="sm" variant="secondary"><Icon name="sort" size={14} />{sortLabel()}</Button>
              } />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Group>
                  <DropdownMenu.Label>Sort by</DropdownMenu.Label>
                  {Object.values(SORTS).map((preset) => (
                    <DropdownMenu.Item
                      key={preset.key + preset.dir}
                      selected={sort === preset.key && dir === preset.dir}
                      onClick={() => { setSort(preset.key); setDir(preset.dir); setPage(1); }}
                    >
                      {preset.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu>
            {/* §9.1's last toolbar control. Kumo ships RefreshButton with the
                spin already on it, which is what the vanilla build reproduced
                by hand off Kumo's `refresh` keyframe. */}
            <RefreshButton
              size="sm"
              aria-label="Refresh the list"
              loading={refreshing}
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 700);
              }}
            />
          </div>

          <LayerCard className="ih-list-card">
            {/* The status filter, above the table rather than in the toolbar:
                it changes which campaigns the list is *about*, where everything
                in the toolbar changes how the same set is shown. Counts come
                off the search results. */}
            <div className="ih-list-tabs" role="tablist" aria-label="Filter campaigns by status">
              {STATUS_TABS.map((tab) => {
                const many = tab === 'All'
                  ? searched.length
                  : searched.filter((c) => c.status === tab).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    className="ih-list-tab"
                    aria-selected={status === tab}
                    onClick={() => { setStatus(tab); setPage(1); }}
                  >
                    {tab}<span className="ih-list-tab-count">{count(many)}</span>
                  </button>
                );
              })}
            </div>

            {matched.length === 0 ? (
              <Empty description={`No campaigns match “${query}”.`}>
                <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setPage(1); }}>
                  Clear search
                </Button>
              </Empty>
            ) : (
              <div className="ih-table-scroll">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <SortHead label="Campaign" col="name" {...{ sort, dir, setSort, setDir }} />
                      <Table.Head>Status</Table.Head>
                      {columns.trigger && <Table.Head>Trigger</Table.Head>}
                      {columns.responses && <SortHead label="Responses" col="responses" right {...{ sort, dir, setSort, setDir }} />}
                      {columns.rating && <SortHead label="Avg rating" col="rating" right {...{ sort, dir, setSort, setDir }} />}
                      {columns.updated && <SortHead label="Updated" col="updated" {...{ sort, dir, setSort, setDir }} />}
                      <Table.Head><span className="ih-sr-only">Open</span></Table.Head>
                      <Table.Head><span className="ih-sr-only">Actions</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {list.map((c) => (
                      <CampaignRow
                        key={c.id}
                        campaign={c}
                        columns={columns}
                        onOpen={() => openCampaign(c)}
                        onAction={(kind) => setDialog({ kind, campaign: c })}
                      />
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}

            {/* FR-63 — the sort note stays in the card; the count it used to
                sit beside is the pager's, below the table (§6.12 / §9.1). */}
            <div className="ih-card-foot">
              <Text size="xs" variant="secondary">
                {query
                  ? `${count(matched.length)} of ${count(source.length)} campaigns match “${query}”`
                  : 'Default sort: most recently updated'}
              </Text>
            </div>
          </LayerCard>

          {matched.length > 0 && (
            <Pagination
              className="ih-pager"
              page={current}
              perPage={PAGE_SIZE}
              totalCount={matched.length}
              setPage={setPage}
            />
          )}
        </>
      )}

      {/* A <div>, not a <p>: Kumo's Text renders its own <p>, and a paragraph
          inside a paragraph is one the browser closes early — React says so
          on every render of this page. */}
      <div className="ih-proto-note">
        <Text size="xs" variant="secondary">Prototype data. </Text>
        <Button
          variant="ghost" size="xs"
          onClick={() => store.set({ emptyDashboard: !store.state.emptyDashboard })}
        >
          {store.state.emptyDashboard ? 'Show the seeded campaigns' : 'Preview the first-run empty state'}
        </Button>
        <Text size="xs" variant="secondary"> · </Text>
        <Button variant="ghost" size="xs" onClick={() => setDialog({ kind: 'reset' })}>
          Reset all prototype state
        </Button>
      </div>

      <CampaignDialogs
        dialog={dialog}
        store={store}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

/* FR-63 — the column headers sort the list, which is the gesture anyone
   reading a table reaches for first. The menu above keeps the four named
   presets, because "lowest average rating" is a question and "rating,
   ascending" is only a direction. Both write the same two values.

   Kumo's Table has no sorting of its own — §11.4 did not say so — so the
   button, the arrow and the aria-sort are the product's. */
function SortHead({ label, col, right, sort, dir, setSort, setDir }) {
  const on = sort === col;
  const next = on ? dir : SORT_FIRST_DIR[col];
  return (
    <Table.Head
      className={right ? 'ih-ta-r' : undefined}
      aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="ih-th-sort"
        data-on={on ? '' : undefined}
        aria-label={`Sort by ${label}, ${next === 'asc' ? 'ascending' : 'descending'}`}
        onClick={() => {
          if (on) setDir(dir === 'asc' ? 'desc' : 'asc');
          else { setSort(col); setDir(SORT_FIRST_DIR[col]); }
        }}
      >
        {label}
        <span className="ih-th-arrow" aria-hidden="true">
          <Icon name={next === 'asc' ? 'up' : 'down'} size={12} />
        </span>
      </button>
    </Table.Head>
  );
}

function CampaignRow({ campaign: c, columns, onOpen, onAction }) {
  /* FR-72 — the whole row opens the campaign, not just a button at the end of
     it. The name is still a button, because a pointer target is not an
     accessible one: it is the node that carries the name into the tab order
     and tells a screen reader what pressing it does. */
  const verb = c.status === 'Draft' || c.status === 'Scheduled' ? 'Resume' : 'Open';
  const running = c.status === 'Live' || c.status === 'Paused';

  return (
    <Table.Row className="ih-row-open" onClick={onOpen}>
      <Table.Cell className="ih-cell-campaign">
        <div className="ih-campaign-cell">
          <span className="ih-campaign-line">
            <button
              type="button"
              className="ih-row-name truncate"
              aria-label={`${verb} ${c.name}`}
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
            >
              {c.name}
            </button>
            {!isFeedback(c) && (
              <Tooltip content="Collects no responses — opens on reach, engagement and conversion">
                <Badge variant="outline" size="sm">{KIND_LABEL[campaignKind(c)]}</Badge>
              </Tooltip>
            )}
            {c.versions > 1 && (
              /* FR-83 — the reader knows the aggregate spans a change before opening. */
              <Tooltip content={`Edited after publish — responses span ${c.versions} versions`}>
                <Badge variant="outline" size="sm"><Icon name="layers" size={11} />v{c.versions}</Badge>
              </Tooltip>
            )}
          </span>
          {/* FR-75 — the ID is selectable for support and debugging. */}
          <span className="ih-campaign-id">{c.campaignId}</span>
        </div>
      </Table.Cell>
      <Table.Cell><StatusPill status={c.status} /></Table.Cell>
      {columns.trigger && (
        <Table.Cell>
          <Text size="xs" variant="mono-secondary">{c.triggerLabel}</Text>
          {c.divergentTriggers && (
            <Tooltip content="Variants run different triggers — results are not like-for-like">
              <Badge variant="warning" size="sm" className="ih-ml-6">multiple</Badge>
            </Tooltip>
          )}
        </Table.Cell>
      )}
      {columns.responses && (
        <Table.Cell className="ih-ta-r">
          {isFeedback(c) ? (
            <span className="ih-num">{count(c.responses)}</span>
          ) : (
            <Tooltip content={`An announcement collects no responses — ${count(c.reach || 0)} people reached`}>
              <Text size="sm" variant="mono-secondary">—</Text>
            </Tooltip>
          )}
        </Table.Cell>
      )}
      {columns.rating && (
        <Table.Cell className="ih-ta-r">
          <RatingValue value={c.avgRating} scaleMax={c.ratingScaleMax || 5} />
        </Table.Cell>
      )}
      {columns.updated && (
        <Table.Cell>
          <Tooltip content={absoluteTime(c.updatedAt)}>
            <Text size="xs" variant="secondary">{relativeTime(c.updatedAt)}</Text>
          </Tooltip>
        </Table.Cell>
      )}
      {/* Where the "Open" button stood. The row is the button now, so a second
          target inside it would be a button inside a button. What the column
          keeps is the chevron, which is the row saying it goes somewhere. */}
      <Table.Cell className="ih-ta-r ih-cell-tight">
        <span className="ih-row-chev" aria-hidden="true"><Icon name="chevron" size={15} /></span>
      </Table.Cell>
      <Table.Cell className="ih-ta-r ih-cell-tight" onClick={(e) => e.stopPropagation()}>
        <RowMenu campaign={c} running={running} onAction={onAction} />
      </Table.Cell>
    </Table.Row>
  );
}

/**
 * Everything you can do to a campaign without opening it (FR-74, FR-81).
 *
 * Status-adaptive rather than uniform. A Draft has never sent anything, so
 * Pause and Stop are not "disabled" for it — they are meaningless, and a menu
 * of greyed rows the reader has to read past is worse than a short one. Delete
 * is the exception that stays visible while disabled: a reader who cannot find
 * it assumes the product cannot do it.
 */
function RowMenu({ campaign: c, running, onAction }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={
        <Button variant="ghost" size="sm" shape="square" aria-label={`Actions for ${c.name}`}>
          <Icon name="ellipsis" size={16} />
        </Button>
      } />
      <DropdownMenu.Content align="end">
        {/* The campaign's name heads every action under it, so the whole menu
            is the group it labels. */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>{c.name}</DropdownMenu.Label>
          <DropdownMenu.Item icon={<Icon name="pencil" size={14} />} onClick={() => onAction('rename')}>Rename…</DropdownMenu.Item>
          <DropdownMenu.Item icon={<Icon name="clone" size={14} />} onClick={() => onAction('clone')}>Clone…</DropdownMenu.Item>
          <DropdownMenu.Item icon={<Icon name="copy" size={14} />} onClick={() => onAction('copy-id')}>Copy campaign ID</DropdownMenu.Item>
          {hasData(c) && (
            <DropdownMenu.Item icon={<Icon name="download" size={14} />} onClick={() => onAction('export')}>Export…</DropdownMenu.Item>
          )}
          {/* FR-79 — the run controls, on the row rather than one screen inside it. */}
          {running && <DropdownMenu.Separator />}
          {c.status === 'Live' && (
            <DropdownMenu.Item icon={<Icon name="pause" size={14} />} onClick={() => onAction('pause')}>Pause</DropdownMenu.Item>
          )}
          {c.status === 'Paused' && (
            <DropdownMenu.Item icon={<Icon name="play" size={14} />} onClick={() => onAction('resume')}>Resume</DropdownMenu.Item>
          )}
          {running && (
            <DropdownMenu.Item icon={<Icon name="stop" size={14} />} onClick={() => onAction('stop')}>Stop…</DropdownMenu.Item>
          )}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            variant="danger"
            icon={<Icon name="trash" size={14} />}
            disabled={!canDelete(c)}
            title={canDelete(c) ? undefined
              : `A ${c.status.toLowerCase()} campaign is still enrolling users. Stop it first.`}
            onClick={() => onAction('delete')}
          >
            Delete…
          </DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/* ---------- The activity strip (FR-71) ----------
   What the workspace did over the selected window, above the list of what
   produced it. The range picker re-slices every figure and every shape. */

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
/** The share of shown prompts that were finished, for one day. */
const dayRate = (row) => (row.completed / (row.completed + row.abandoned)) * 100;
/** A banded card's axis states its low and high instead of its dates. */
const bandAxis = (values, fmt) => [`${fmt(Math.min(...values))} low`, `${fmt(Math.max(...values))} high`];

function ActivityStrip({ campaigns, range, onRange }) {
  const rows = WORKSPACE_SERIES.slice(-RANGES[range].points);
  const sent = sum(rows, 'sent');
  const failed = sum(rows, 'failed');
  const completed = sum(rows, 'completed');
  const abandoned = sum(rows, 'abandoned');
  const started = completed + abandoned;
  // Completion is measured against what was actually shown, not what was sent:
  // a delivery failure never reached a person and cannot be abandoned.
  const completionRate = started ? (completed / started) * 100 : 0;
  const rating = rows.reduce((t, r) => t + r.rating, 0) / rows.length;
  const live = campaigns.filter((c) => c.status === 'Live').length;
  const paused = campaigns.filter((c) => c.status === 'Paused' || c.status === 'Stopped').length;
  const axis = [rows[0].label, rows[rows.length - 1].label];

  return (
    <section className="ih-activity">
      {/* What this row is for is the range, so the range is what is in it. */}
      <div className="ih-activity-head">
        <DropdownMenu>
          <DropdownMenu.Trigger render={
            <Button size="sm" variant="secondary">
              <Icon name="clock" size={14} />{RANGES[range].label}<Icon name="down" size={12} />
            </Button>
          } />
          <DropdownMenu.Content align="end">
            <DropdownMenu.RadioGroup value={range} onValueChange={onRange}>
              <DropdownMenu.Label>Range</DropdownMenu.Label>
              {Object.entries(RANGES).map(([key, r]) => (
                <DropdownMenu.RadioItem key={key} value={key}>{r.label}</DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      <div className="ih-metric-grid">
        <MetricCard
          name="Prompts sent"
          legend={[{ label: 'Failed', tone: 'danger' }]}
          value={{ text: count(sent) }}
          subs={[count(failed)]}
          rows={rows} axis={axis}
          series={[
            { label: 'Delivered', of: (r) => r.sent - r.failed, fill: 'var(--chart-1)', opacity: '.32' },
            { label: 'Failed', of: (r) => r.failed, fill: 'var(--destructive)' },
          ]}
        />
        <MetricCard
          name="Responses"
          legend={[{ label: 'Abandoned', tone: 'warning' }]}
          value={{ text: count(completed) }}
          subs={[count(abandoned)]}
          rows={rows} axis={axis}
          series={[
            { label: 'Completed', of: (r) => r.completed, fill: 'var(--chart-1)' },
            { label: 'Abandoned', of: (r) => r.abandoned, fill: 'var(--warning)' },
          ]}
        />
        <MetricCard
          name="Completion rate"
          value={{ text: percent(completionRate, 0) }}
          subs={[`${count(live)} live`]}
          rows={rows} band
          axis={bandAxis(rows.map(dayRate), (v) => percent(v, 0))}
          series={[{
            label: 'Completion', of: dayRate, read: (r) => percent(dayRate(r), 0),
            fill: 'var(--chart-1)', opacity: '.75',
          }]}
        />
        <MetricCard
          name="Average rating"
          // On the shared ramp, so this number means what it means everywhere else.
          value={{ text: rating.toFixed(1), color: ratingColor(rating, 10) }}
          subs={[`${count(paused)} held`]}
          rows={rows} band
          axis={bandAxis(rows.map((r) => r.rating), (v) => v.toFixed(1))}
          // Each bar takes its own point's ramp colour: the trend is readable
          // as colour before the heights are read as a shape.
          series={[{
            label: 'Rating', of: (r) => r.rating, read: (r) => r.rating.toFixed(1),
            fill: (r) => ratingColor(r.rating, 10),
          }]}
        />
      </div>
    </section>
  );
}

/* ---------- The row menu's dialogs ---------- */

/**
 * An action with nothing to confirm: it fires and the dialog state closes
 * behind it.
 *
 * In an effect rather than in render, which is where it used to be. `toast()`
 * updates the toast list and `onClose()` updates the page, and a component
 * that updates another while it is rendering is a bug React logs on sight —
 * this one fired on every Export, Pause, Resume and Copy ID chosen from a row.
 * The ref keeps it to once per choice, since an effect can run twice for one
 * mount and two toasts for one click is the other half of the same bug.
 */
function ImmediateAction({ run, onClose }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    run();
    onClose();
  }, [run, onClose]);
  return null;
}

function CampaignDialogs({ dialog, store, onClose }) {
  const c = dialog?.campaign;

  if (dialog?.kind === 'rename') {
    return (
      <RenameDialog
        open
        name={c.name}
        onClose={onClose}
        onRename={(name) => {
          store.renameCampaign(c.id, name);
          toast('Campaign renamed', `Now “${name}”.`);
          onClose();
        }}
      />
    );
  }

  const act = {
    clone: {
      title: `Clone “${c?.name}”?`,
      confirmLabel: 'Clone campaign',
      destructive: false,
      body: 'Content, audience and trigger are copied into a new draft. The schedule and the collected responses are not.',
      run: () => {
        store.cloneCampaign(c.id);
        toast('Campaign cloned', 'Content, audience and trigger copied. Schedule and responses were not.');
      },
    },
    stop: {
      title: `Stop “${c?.name}”?`,
      confirmLabel: 'Stop campaign',
      body: 'Enrolment ends now and cannot be restarted. Responses already collected stay on the campaign.',
      run: () => {
        store.setCampaignStatus(c.id, 'Stopped');
        toast('Campaign stopped', 'Enrolment has ended. Collected responses remain here.');
      },
    },
    delete: {
      title: `Delete “${c?.name}”?`,
      confirmLabel: 'Delete campaign',
      body: 'The campaign and its collected responses are removed from the list. You can undo this from the confirmation.',
      run: () => {
        const record = store.deleteCampaign(c.id);
        toast('Campaign deleted', `“${c.name}” was removed.`, 'danger', {
          label: 'Undo',
          onClick: () => {
            store.restoreCampaign(record);
            toast('Campaign restored', `“${record.row.name}” is back in the list.`);
          },
        });
      },
    },
    reset: {
      title: 'Reset all prototype state?',
      confirmLabel: 'Reset state',
      body: 'Saved campaigns, the in-progress draft and every setting go back to their seeded values. The page reloads.',
      run: () => { resetState(); location.reload(); },
    },
  }[dialog?.kind];

  /* The ones that need no confirmation run on the spot and close. */
  if (dialog && !act) {
    const immediate = {
      'copy-id': async () => {
        // The clipboard is refused outside a secure context and in some
        // embedded frames, so the failure has a way out rather than a shrug.
        try {
          await navigator.clipboard.writeText(c.campaignId);
          toast('Copied', `${c.campaignId} is on your clipboard.`);
        } catch {
          toast('Could not copy', `Select ${c.campaignId} on the row to copy it by hand.`, 'warning');
        }
      },
      export: () => toast('Export queued',
        `A download link for “${c.name}” will arrive by email when it is ready.`),
      pause: () => {
        store.setCampaignStatus(c.id, 'Paused');
        toast('Campaign paused', 'No new users are enrolled. Responses already in flight still arrive.');
      },
      resume: () => {
        store.setCampaignStatus(c.id, 'Live');
        toast('Campaign resumed', 'Enrolment has started again.');
      },
    }[dialog.kind];
    if (immediate) return <ImmediateAction run={immediate} onClose={onClose} />;
    return null;
  }

  return (
    <ConfirmDialog
      open={Boolean(act)}
      title={act?.title}
      confirmLabel={act?.confirmLabel}
      destructive={act?.destructive !== false}
      onClose={onClose}
      onConfirm={() => { act.run(); onClose(); }}
    >
      {act?.body}
    </ConfirmDialog>
  );
}
