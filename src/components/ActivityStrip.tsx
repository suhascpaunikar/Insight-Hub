/* ==========================================================================
   ActivityStrip.tsx — what the workspace did over the selected window, above
   the list of what produced it (FR-71).

   Every figure is a sum over the same slice the sparkline draws, so the number
   and the shape can never disagree. The range picker re-slices both, and it
   re-slices them as one gesture: the old series leaves, the repaint happens,
   the figures count to the new window and the new series grows back from its
   own baseline. Out and back rather than a morph, deliberately — 7 days and
   30 days are not the same number of columns, so there is frequently no bar
   to travel between.
   ========================================================================== */
import { useLayoutEffect, useRef, useState } from 'react';
import { Button, ChartPalette, DropdownMenu } from '@cloudflare/kumo';
import { CaretDownIcon, ClockIcon } from '@phosphor-icons/react';
import { MetricCard } from './MetricCard';
import { countUp, growPlots, swapOut } from '../motion';
import {
  type Campaign, type DayRow, RANGES, WORKSPACE_SERIES, count, percent, ratingColor,
} from '../legacy';

/* Kumo's own data-viz palette, in its dark variant. `categorical(0)` is the
   series colour the library reaches for first; the two qualifying series take
   the semantic tones, so "failed" and "abandoned" read as what they are
   rather than as two more categories. */
const SERIES = ChartPalette.categorical(0, true);
const ATTENTION = ChartPalette.semantic('Attention', true);
const WARNING = ChartPalette.semantic('Warning', true);

const sum = (rows: DayRow[], key: keyof DayRow) =>
  rows.reduce((total, row) => total + (row[key] as number), 0);

/** The share of shown prompts that were finished, for one day. */
const dayRate = (row: DayRow) => (row.completed / (row.completed + row.abandoned)) * 100;

/** A banded card's axis states its low and high instead of its dates. */
const bandAxis = (values: number[], fmt: (v: number) => string): [string, string] =>
  [`${fmt(Math.min(...values))} low`, `${fmt(Math.max(...values))} high`];

/** How each headline figure renders mid-tween. */
const FIGURE_FORMAT: Record<string, (v: number) => string> = {
  responses: (v) => count(Math.round(v)),
  completion: (v) => percent(v),
  sent: (v) => count(Math.round(v)),
  collected: (v) => count(Math.round(v)),
  rate: (v) => percent(v, 0),
  rating: (v) => v.toFixed(1),
};

/** The figures as they stand right now, so the next render can tween from them. */
const readFigures = (host: HTMLElement) => Object.fromEntries(
  Array.from(host.querySelectorAll<HTMLElement>('[data-figure]'))
    .map((n) => [n.dataset.figure!, Number(n.dataset.value)]),
);

/** Tween each figure from where it was to where this render put it. */
function countFigures(host: HTMLElement, before: Record<string, number>) {
  host.querySelectorAll<HTMLElement>('[data-figure]').forEach((node) => {
    const from = before[node.dataset.figure!];
    const to = Number(node.dataset.value);
    if (from === undefined || Number.isNaN(from)) return;
    countUp(node, from, to, FIGURE_FORMAT[node.dataset.figure!]);
  });
}

export function ActivityStrip({ campaigns, entering }: { campaigns: Campaign[]; entering: boolean }) {
  const [range, setRange] = useState<string>('30d');
  const hostRef = useRef<HTMLElement>(null);
  const prior = useRef<Record<string, number> | null>(null);

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
  const held = campaigns.filter((c) => c.status === 'Paused' || c.status === 'Stopped').length;
  const axis: [string, string] = [rows[0].label, rows[rows.length - 1].label];

  async function changeRange(key: string) {
    if (key === range || !hostRef.current) return;
    prior.current = readFigures(hostRef.current);
    await swapOut(hostRef.current);
    setRange(key);
  }

  // Runs after the repaint that changed the window, so the number and the
  // shape it belongs to change as one event rather than two.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (prior.current) {
      countFigures(host, prior.current);
      prior.current = null;
      growPlots(host);
    } else if (entering) {
      growPlots(host);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, entering]);

  return (
    <section ref={hostRef} className={`mb-6 ${entering ? 'ih-lazy-in' : ''}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-baseline gap-2">
            <span
              className="text-2xl leading-none font-medium tabular-nums text-kumo-strong"
              data-figure="responses" data-value={completed}
            >
              {count(completed)}
            </span>
            <span className="text-sm text-kumo-subtle">Responses collected</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span
              className="text-2xl leading-none font-medium tabular-nums text-kumo-strong"
              data-figure="completion" data-value={completionRate}
            >
              {percent(completionRate)}
            </span>
            <span className="text-sm text-kumo-subtle">Completion rate</span>
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="secondary" size="sm" icon={<ClockIcon />}>
                {RANGES[range].label}
                <CaretDownIcon className="size-3" />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            {Object.entries(RANGES).map(([key, r]) => (
              <DropdownMenu.Item key={key} selected={range === key} onClick={() => changeRange(key)}>
                {r.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          name="Prompts sent"
          legend={[{ label: 'Failed', tone: ATTENTION }]}
          value={{ text: count(sent) }} figure="sent" figureValue={sent}
          subs={[count(failed)]}
          rows={rows} axis={axis}
          series={[
            { label: 'Delivered', of: (r) => r.sent - r.failed, fill: SERIES, opacity: '.34' },
            { label: 'Failed', of: (r) => r.failed, fill: ATTENTION },
          ]}
        />
        <MetricCard
          name="Responses"
          legend={[{ label: 'Abandoned', tone: WARNING }]}
          value={{ text: count(completed) }} figure="collected" figureValue={completed}
          subs={[count(abandoned)]}
          rows={rows} axis={axis}
          series={[
            { label: 'Completed', of: (r) => r.completed, fill: SERIES },
            { label: 'Abandoned', of: (r) => r.abandoned, fill: WARNING },
          ]}
        />
        <MetricCard
          name="Completion rate"
          value={{ text: percent(completionRate, 0) }} figure="rate" figureValue={completionRate}
          subs={[`${count(live)} live`]}
          rows={rows} band
          axis={bandAxis(rows.map(dayRate), (v) => percent(v, 0))}
          series={[{
            label: 'Completion', of: dayRate, read: (r) => percent(dayRate(r), 0),
            fill: SERIES, opacity: '.8',
          }]}
        />
        <MetricCard
          name="Average rating"
          // On the shared ramp, so this number means what it means everywhere else.
          value={{ text: rating.toFixed(1), color: ratingColor(rating, 10) }}
          figure="rating" figureValue={rating}
          subs={[`${count(held)} held`]}
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
