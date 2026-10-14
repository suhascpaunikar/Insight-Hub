/* ==========================================================================
   Engagement tab — the announcement kind's second tab, standing where
   Responses stands on a feedback campaign.

   Nobody answers an announcement, so the question is not what people said but
   whether the send earned anything. The three outcomes of an impression are
   exhaustive — tapped, dismissed, ignored — and the opt-outs are kept on the
   same screen deliberately: reach has a price, and a panel that reports only
   the taps is reporting half the result.
   ========================================================================== */
import { LayerCard, Banner, Text, Tooltip } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { DistRow } from '../../app/InsightChart.jsx';
import { count, percent } from '../../lib/format.js';
import { CHANNEL_LABEL, rate, share } from '../../lib/insights-lib.js';
import {
  ENGAGEMENT, TIME_TO_TAP, TAP_DESTINATIONS, ENGAGEMENT_BY_APP, ENGAGEMENT_BY_SEGMENT,
} from '../../lib/data.js';

export function EngagementTab({ campaign: c }) {
  const e = ENGAGEMENT;
  const outcomes = [
    { label: 'Tapped', count: e.taps, color: 'var(--chart-1)', note: 'Opened the app from the notification' },
    { label: 'Dismissed', count: e.dismissals, color: 'var(--foreground-muted)', note: 'Swiped away — a deliberate no' },
    // Silence is recessive but it is two thirds of the bar, so it has to be
    // legible — surface-300 disappears against the card at that width.
    { label: 'Ignored', count: e.ignored, color: 'var(--border-overlay)', note: 'Neither tapped nor dismissed' },
  ];
  const tapMax = Math.max(...TIME_TO_TAP.map((t) => t.count));
  const destMax = Math.max(...TAP_DESTINATIONS.map((d) => d.count));
  const fast = TIME_TO_TAP.slice(0, 2).reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="ih-stack-lg">
      <LayerCard className="ih-card" data-insight="engagement-summary">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Engagement</h3>
          <Text size="xs" variant="secondary">
            {CHANNEL_LABEL[c.channel] || 'Notification'} · one send per user
          </Text>
        </div>
        <div className="ih-card-body">
          <div className="ih-figures">
            <Figure label="Unique reach" value={count(e.uniqueReach)} note="People, not sends" />
            <Figure
              label="Impressions" value={count(e.impressions)}
              note={`${(e.impressions / e.uniqueReach).toFixed(2)} per person reached`}
            />
            <Figure
              label="Taps" value={count(e.taps)}
              note={`${rate(e.taps, e.uniqueReach)} of people reached`}
            />
            <Figure
              label="Tap-through rate"
              value={e.impressions ? percent((e.taps / e.impressions) * 100, 1) : '—'}
              note="Of impressions — the honest denominator"
            />
          </div>
        </div>
      </LayerCard>

      {/* The three outcomes are exhaustive, so they are shown as one bar the
          reader can see adding up rather than three unrelated figures. */}
      <LayerCard className="ih-card" data-insight="impression-outcome">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">What happened to the impression</h3>
          <Text size="xs" variant="mono-secondary">{count(e.impressions)} impressions</Text>
        </div>
        <div className="ih-card-body ih-stack">
          <span className="ih-stackbar">
            {outcomes.map((o) => (
              <Tooltip
                key={o.label}
                content={`${o.label} · ${count(o.count)} · ${rate(o.count, e.impressions)}`}
              >
                <span
                  style={{ width: `${(o.count / e.impressions) * 100}%`, background: o.color }}
                />
              </Tooltip>
            ))}
          </span>
          <div className="ih-dist">
            {outcomes.map((o) => (
              <div className="ih-dist-row" style={{ gridTemplateColumns: '16px 1fr 150px' }} key={o.label}>
                <span className="ih-swatch" style={{ background: o.color }} />
                <span className="ih-col">
                  <Text size="sm">{o.label}</Text>
                  <Text size="xs" variant="secondary">{o.note}</Text>
                </span>
                <span className="ih-dist-figures">
                  <span className="ih-num">{count(o.count)}</span>
                  <Text size="xs" variant="mono-secondary">{rate(o.count, e.impressions)}</Text>
                </span>
              </div>
            ))}
          </div>
          {/* Reach is not free. A panel that reports taps and not opt-outs is
              reporting half of what the send did. */}
          <Banner
            variant="alert"
            icon={<Icon name="warn" size={16} />}
            description={
              <>
                <strong>{count(e.optOuts)} users muted this channel</strong> after the send —{' '}
                <span className="ih-mono">{rate(e.optOuts, e.uniqueReach)}</span> of everyone
                reached. That audience is not reachable by the next campaign.
              </>
            }
          />
        </div>
      </LayerCard>

      <div className="ih-grid ih-g2">
        <LayerCard className="ih-card" data-insight="time-to-tap">
          <div className="ih-card-head ih-card-head-tight">
            <h3 className="ih-t-h3">Time to tap</h3>
            <Text size="xs" variant="secondary">{rate(fast, e.taps, 0)} within 10 minutes</Text>
          </div>
          <div className="ih-card-body ih-dist">
            {TIME_TO_TAP.map((t) => (
              <DistRow
                key={t.bucket}
                label={<span className="ih-mono">{t.bucket}</span>}
                value={t.count}
                share={share(t.count, e.taps)}
                fill="var(--chart-1)" opacity={0.75}
                pct={(t.count / tapMax) * 100}
                columns="96px 1fr 116px"
              />
            ))}
          </div>
          <div className="ih-card-foot">
            <Text size="xs" variant="secondary">
              Where the mass sits says whether the send window is right — a long tail means the
              delay could move.
            </Text>
          </div>
        </LayerCard>

        <LayerCard className="ih-card" data-insight="tap-destinations">
          <div className="ih-card-head ih-card-head-tight">
            <h3 className="ih-t-h3">Where the tap went</h3>
            <Text size="xs" variant="secondary">Which part of the creative did the work</Text>
          </div>
          <div className="ih-card-body ih-dist">
            {TAP_DESTINATIONS.map((d) => (
              <DistRow
                key={d.label}
                label={d.label}
                value={d.count}
                share={share(d.count, e.taps)}
                fill="var(--chart-1)" opacity={0.75}
                pct={(d.count / destMax) * 100}
                columns="1fr 96px 116px"
              />
            ))}
          </div>
          <div className="ih-card-foot">
            <Text size="xs" variant="secondary">
              A body tap is a user who wanted the offer without being told where to press.
            </Text>
          </div>
        </LayerCard>
      </div>

      <div className="ih-grid ih-g2">
        <Cut rows={ENGAGEMENT_BY_APP} kind="app" />
        <Cut rows={ENGAGEMENT_BY_SEGMENT} kind="segment" />
      </div>
    </div>
  );
}

function Figure({ label, value, note }) {
  return (
    <div className="ih-figure">
      <span className="ih-figure-label">{label}</span>
      <span className="ih-figure-value">{value}</span>
      <span className="ih-figure-note">{note}</span>
    </div>
  );
}

function Cut({ rows, kind }) {
  const best = [...rows].sort((a, b) => (b.taps / b.shown) - (a.taps / a.shown))[0];
  return (
    <LayerCard className="ih-card" data-insight={`engagement-by-${kind}`}>
      <div className="ih-card-head ih-card-head-tight">
        <h3 className="ih-t-h3">Engagement by {kind}</h3>
        <Text size="xs" variant="secondary">Best: {best.label}</Text>
      </div>
      <div className="ih-card-body ih-dist">
        {rows.map((r) => (
          <div className="ih-dist-row" style={{ gridTemplateColumns: '78px 1fr 132px' }} key={r.label}>
            <span className="ih-dist-label truncate">{r.label}</span>
            <span className="ih-bar-track">
              <span
                className="ih-bar-fill"
                style={{ width: `${((r.taps / r.shown) * 100 / 20) * 100}%`, background: 'var(--chart-1)' }}
              />
            </span>
            <span className="ih-dist-figures">
              <Text size="xs" variant="secondary" className="ih-num">{count(r.taps)}</Text>
              <Text size="sm" variant="mono">{rate(r.taps, r.shown)}</Text>
            </span>
          </div>
        ))}
      </div>
      <div className="ih-card-foot">
        <Text size="xs" variant="secondary">
          Bars are tap-through rate against a 20% ceiling, so the columns compare directly. The
          count beside each is the taps behind it.
        </Text>
      </div>
    </LayerCard>
  );
}
