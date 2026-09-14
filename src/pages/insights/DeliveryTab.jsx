/* ==========================================================================
   Delivery tab (FR-95 … FR-97) — drawn for either campaign kind.

   Both kinds start Sent and end in their own definition of success: Completed
   for a feedback campaign, Tapped for an announcement. Delivered is the step
   only a push needs — the OS can accept one and never surface it.
   ========================================================================== */
import { LayerCard, Banner, Badge, Text } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { InsightChart, DistRow } from '../../app/InsightChart.jsx';
import { count, percent } from '../../lib/format.js';
import {
  CHART_H, RANGE_LABEL, chartTop, share, sliceRange,
} from '../../lib/insights-lib.js';
import { isFeedback } from '../../lib/data.js';
import {
  DELIVERY_FUNNEL, DELIVERY_SERIES, DELIVERY_STEP_DAYS, FAILURE_REASONS,
  ANNOUNCE_FUNNEL, ANNOUNCE_SERIES, ANNOUNCE_STEP_DAYS, ANNOUNCE_FAILURE_REASONS,
} from '../../lib/data.js';

export function DeliveryTab({ campaign: c, filters }) {
  const feedback = isFeedback(c);
  const wholeFunnel = feedback ? DELIVERY_FUNNEL : ANNOUNCE_FUNNEL;
  const wholeFailures = feedback ? FAILURE_REASONS : ANNOUNCE_FAILURE_REASONS;
  const doneLabel = wholeFunnel[wholeFunnel.length - 1].label;
  const wholeSeries = (feedback ? DELIVERY_SERIES : ANNOUNCE_SERIES).map((p) => ({
    date: p.date, sends: p.sends, done: feedback ? p.completions : p.taps, version: p.version,
  }));
  // FR-92 — the Date range control at the top of the page reaches this chart.
  const { rows: series, full: wholeRun } = sliceRange(
    wholeSeries, feedback ? DELIVERY_STEP_DAYS : ANNOUNCE_STEP_DAYS, filters.range);
  // Whether a version change actually falls inside the window on show. The
  // notice under the chart points at a dashed rule, so it must not be printed
  // when the slice starts after the boundary and there is no rule to point at.
  const boundaryShown = series.some((p, i) => i > 0 && p.version !== series[i - 1].version);

  /* The window, applied to the rest of the tab. Slicing the chart and leaving
     the funnel above it on lifetime totals would put two disagreeing answers
     on one screen. One factor, applied to everything: the seed carries a
     per-day breakdown for sends and completions only, so the rest is read
     proportionally — one stated assumption rather than several invented
     series, and because it is a single linear factor every relationship the
     seed preserves survives it exactly. */
  const windowShare = wholeRun ? 1
    : series.reduce((t, p) => t + p.sends, 0) / wholeSeries.reduce((t, p) => t + p.sends, 0);
  const scale = (n) => Math.round(n * windowShare);
  const funnel = wholeFunnel.map((step) => ({ ...step, value: scale(step.value) }));
  const failures = wholeFailures.map((f) => ({ ...f, count: scale(f.count) }));

  const top = funnel[0].value;
  let biggestDrop = { label: '', pct: 0 };
  funnel.forEach((s, i) => {
    if (i === 0) return;
    const prev = funnel[i - 1];
    const drop = ((prev.value - s.value) / prev.value) * 100;
    if (drop > biggestDrop.pct) biggestDrop = { label: `${prev.label} → ${s.label}`, pct: drop };
  });

  const maxSend = Math.max(...series.map((p) => p.sends));
  // Rules and bars share one scale, so the top rule is the top of the box.
  const plotTop = chartTop(maxSend);
  const failTotal = failures.reduce((s, f) => s + f.count, 0);

  const points = series.map((p, i) => ({
    key: p.date,
    label: p.date,
    boundary: i > 0 && p.version !== series[i - 1].version,
    // The sends that never got there sit above the ones that did.
    segs: [
      { height: ((p.sends - p.done) / plotTop) * CHART_H, fill: 'var(--chart-0)', opacity: '.38' },
      { height: (p.done / plotTop) * CHART_H, fill: 'var(--chart-1)' },
    ],
    readout: [
      { label: 'Sends', value: count(p.sends), fill: 'var(--chart-0)', opacity: '.38' },
      { label: doneLabel, value: count(p.done), fill: 'var(--chart-1)', opacity: '1' },
      ...(c.versions > 1 ? [{ label: 'Version', value: `v${p.version}`, fill: 'transparent', opacity: '1' }] : []),
    ],
  }));

  return (
    <div className="ih-stack-lg">
      <LayerCard className="ih-card" data-insight="delivery-funnel">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Delivery funnel</h3>
          {/* Says which window the counts belong to, and that the conversions
              under them do not move with it. */}
          <Text size="xs" variant="secondary">
            {wholeRun
              ? 'Absolute counts with step-to-step conversion'
              : `${RANGE_LABEL[filters.range]} · conversion is the whole run`}
          </Text>
        </div>
        <div className="ih-card-body ih-stack">
          {/* FR-95 — the count is the headline; conversion is its caption. */}
          <div className="ih-figures">
            {funnel.map((s, i) => {
              const prev = i === 0 ? null : funnel[i - 1];
              const isWorst = prev && `${prev.label} → ${s.label}` === biggestDrop.label;
              const endToEnd = i === funnel.length - 1;
              const note = !prev
                ? 'Top of the funnel'
                : `${percent((s.value / prev.value) * 100, 0)} of ${prev.label}`
                  + (endToEnd ? ` · ${percent((s.value / top) * 100, 0)} of ${funnel[0].label}` : '');
              return (
                <div className="ih-figure" data-flag={isWorst ? 'worst' : undefined} key={s.label}>
                  <span className="ih-figure-label">
                    {isWorst && <Icon name="warn" size={12} />}{s.label}
                  </span>
                  <span className="ih-figure-value">{count(s.value)}</span>
                  <span className="ih-figure-note">{note}</span>
                </div>
              );
            })}
          </div>
          <Banner
            variant={biggestDrop.pct > 30 ? 'alert' : 'secondary'}
            icon={<Icon name="warn" size={16} />}
            description={
              <>
                Largest drop-off: <strong>{biggestDrop.label}</strong>, losing{' '}
                <span className="ih-mono">{percent(biggestDrop.pct, 0)}</span> of the previous step.
              </>
            }
          />
        </div>
      </LayerCard>

      <LayerCard className="ih-card" data-insight="delivery-series">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Delivery over time</h3>
          <span className="ih-legend-row">
            <span className="ih-legend-key"><i style={{ background: 'var(--chart-0)' }} />Sends</span>
            <span className="ih-legend-key"><i style={{ background: 'var(--chart-1)' }} />{doneLabel}</span>
          </span>
        </div>
        <div className="ih-card-body">
          <InsightChart top={plotTop} points={points} />
          {/* The window between its own bounds. A range control the reader
              cannot see the effect of is one they stop trusting. */}
          <div className="ih-chart-axis">
            <Text size="xs" variant="mono-secondary">{series[0].date}</Text>
            <Text size="xs" variant="secondary" className="ih-ta-c">
              {wholeRun && filters.range !== 'all'
                ? `Whole run — shorter than ${RANGE_LABEL[filters.range]}`
                : `${RANGE_LABEL[filters.range]} · ${count(series.length)} points`}
            </Text>
            <Text size="xs" variant="mono-secondary">{series[series.length - 1].date}</Text>
          </div>
          {/* FR-93 — the notice that explains the rule only prints where the
              rule is on screen. */}
          {c.versions > 1 && boundaryShown && (
            <div className="ih-notice-ai ih-mt-12">
              <Icon name="layers" size={16} />
              <span>
                The dashed rule marks where <strong>version 2</strong> begins. This series spans a
                question change — filter to a single version above to read either side on its own.
              </span>
            </div>
          )}
        </div>
      </LayerCard>

      <LayerCard className="ih-card" data-insight="failure-reasons">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Failure reasons</h3>
          <Text size="xs" variant="mono-secondary">{count(failTotal)} failed sends</Text>
        </div>
        {!wholeRun && (
          <div className="ih-card-inset">
            <Banner
              variant="secondary"
              icon={<Icon name="info" size={16} />}
              description="Read at this window’s share of the run. The seed behind this prototype breaks down sends and completions by day but not failures, so these are proportional rather than counted — the mix between reasons is exact, the totals are an estimate."
            />
          </div>
        )}
        <div className="ih-card-body ih-dist">
          {failures.map((f) => (
            <DistRow
              key={f.reason}
              label={f.reason}
              value={f.count}
              share={share(f.count, failTotal)}
              fill="var(--foreground-muted)"
              pct={(f.count / failTotal) * 100}
              columns="220px 1fr 120px"
            />
          ))}
        </div>
      </LayerCard>
    </div>
  );
}
