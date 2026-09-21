/* ==========================================================================
   Impact tab (FR-106 … FR-110) — one per kind.

   Both answer "was this worth running", but not with the same question. A
   feedback campaign asks what is pulling the score down and who owns it; an
   announcement asks whether anybody acted, and what that cost.
   ========================================================================== */
import { useState } from 'react';
import { LayerCard, Table, Badge, Banner, Button, Select, Text, Tooltip } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { count, percent, ratingText } from '../../lib/format.js';
import { ratingColor, AI_ACCENT } from '../../lib/palette.js';
import { money, rate, scaleMax } from '../../lib/insights-lib.js';
import { toast } from '../../lib/toast.js';
import { isFeedback } from '../../lib/data.js';
import {
  SCORE_DRIVERS, OWNER_TEAMS, VARIANT_RESULTS, WEIGHT_HISTORY, RATING_BLOCK, AI_SUGGESTIONS,
  ANNOUNCE_VARIANTS, ANNOUNCE_AI_SUGGESTIONS, CONVERSION, CONVERSION_FUNNEL, HOLDOUT, OFFER,
  ENGAGEMENT,
} from '../../lib/data.js';

export function ImpactTab({ campaign: c, onDrillTheme }) {
  return isFeedback(c)
    ? <FeedbackImpact campaign={c} onDrillTheme={onDrillTheme} />
    : <AnnouncementImpact campaign={c} />;
}

/** FR-90 — one decimal, monospaced, coloured on the shared ramp. */
const RatingValue = ({ value, max }) => (
  value
    ? <span className="ih-rating-val" style={{ color: ratingColor(value, max) }}>
        {ratingText(value)}<span className="ih-rating-scale"> /{max}</span>
      </span>
    : <Text size="sm" variant="mono-secondary">—</Text>
);

/* FR-106 — score driver breakdown. Attribution keys off theme, and each row is
   ranked by how far it pulls the overall score down. */
function FeedbackImpact({ campaign: c, onDrillTheme }) {
  const max = scaleMax(c);
  const [owners, setOwners] = useState({});
  const drivers = [...SCORE_DRIVERS].sort((a, b) => b.drag - a.drag);
  const dragMax = Math.max(...drivers.map((d) => Math.abs(d.drag)));
  const isIntelligent = c.type === 'intelligent-ab';
  const divergent = c.divergentTriggers;

  return (
    <div className="ih-stack-lg">
      <LayerCard className="ih-card" data-insight="score-drivers">
        <div className="ih-card-head">
          <div>
            <h3 className="ih-t-h2">Score drivers</h3>
            <Text size="xs" variant="secondary" className="ih-block">
              Every theme found in the open responses, ranked by how much it pulls the{' '}
              <span className="ih-mono">{ratingText(RATING_BLOCK.average)}</span> average down.
            </Text>
          </div>
        </div>
        <div className="ih-table-scroll">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Driver</Table.Head>
                <Table.Head className="ih-ta-r">Volume</Table.Head>
                <Table.Head className="ih-ta-r">Share</Table.Head>
                <Table.Head className="ih-w-190">Low ↔ high band</Table.Head>
                <Table.Head className="ih-ta-r">Avg rating</Table.Head>
                <Table.Head className="ih-ta-r">Score drag</Table.Head>
                <Table.Head>Owning team</Table.Head>
                <Table.Head className="ih-ta-r">Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {drivers.map((d) => {
                const owner = owners[d.themeId] || d.owner;
                const mid = 100 - d.lowShare - d.highShare;
                return (
                  <Table.Row key={d.themeId}>
                    <Table.Cell className="ih-cell-driver">
                      {/* The theme is a machine-found cluster of open text, so
                          the text it was found in is the evidence for every
                          other figure on the row. Pressing the name filters
                          the open-text list to it and opens Responses, which
                          is the only join in the seed that runs between two
                          tabs — themeId is on the driver and on each response.

                          Inference stays violet (FR-91): the mark beside the
                          name is the claim, and the filter it opens is a route
                          to the measurements the claim was drawn from. */}
                      <button
                        type="button"
                        className="ih-row-gap ih-xf"
                        aria-label={`Show the ${count(d.volume)} open responses behind ${d.name}`}
                        onClick={() => onDrillTheme(d.themeId)}
                      >
                        <span className="ih-driver-mark" style={{ background: AI_ACCENT }} />
                        <span className="ih-t-h3">{d.name}</span>
                        <Icon name="right" size={12} />
                      </button>
                    </Table.Cell>
                    <Table.Cell className="ih-ta-r"><span className="ih-num">{count(d.volume)}</span></Table.Cell>
                    <Table.Cell className="ih-ta-r">
                      <Text size="xs" variant="mono-secondary">{percent(d.share)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {/* The rating-band split: what share sits low vs high. */}
                      <Tooltip content={`${d.lowShare}% low band · ${mid}% middle · ${d.highShare}% high band`}>
                        <span className="ih-bandbar">
                          <span style={{ width: `${d.lowShare}%`, background: ratingColor(1, 5) }} />
                          <span style={{ width: `${mid}%`, background: 'var(--surface-300)' }} />
                          <span style={{ width: `${d.highShare}%`, background: ratingColor(5, 5) }} />
                        </span>
                      </Tooltip>
                      <span className="ih-row-between ih-mt-3">
                        <Text size="xs" variant="mono" style={{ color: ratingColor(1, 5) }}>{d.lowShare}%</Text>
                        <Text size="xs" variant="mono" style={{ color: ratingColor(5, 5) }}>{d.highShare}%</Text>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="ih-ta-r"><RatingValue value={d.avgRating} max={max} /></Table.Cell>
                    <Table.Cell className="ih-ta-r">
                      <span className="ih-drag">
                        <span className="ih-bar-track ih-bar-drag">
                          <span
                            className="ih-bar-fill"
                            style={{
                              width: `${(Math.abs(d.drag) / dragMax) * 100}%`,
                              background: d.drag > 0 ? 'var(--destructive)' : 'var(--success)',
                            }}
                          />
                        </span>
                        <span
                          className="ih-num"
                          style={{ color: d.drag > 0 ? 'var(--destructive-fg)' : 'var(--success-fg)' }}
                        >
                          {d.drag > 0 ? '−' : '+'}{Math.abs(d.drag).toFixed(2)}
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {/* FR-106 — the owning team is configurable per theme. */}
                      <Select
                        size="sm"
                        className="ih-w-140"
                        aria-label={`Owning team for ${d.name}`}
                        value={owner}
                        items={Object.fromEntries(OWNER_TEAMS.map((t) => [t, t]))}
                        onValueChange={(next) => setOwners((o) => ({ ...o, [d.themeId]: next }))}
                      />
                    </Table.Cell>
                    <Table.Cell className="ih-ta-r">
                      {/* FR-107 — routes the underlying response set to its owner in one click. */}
                      <Button
                        size="sm" variant="secondary"
                        onClick={() => toast('Responses routed',
                          `${count(d.volume)} responses about “${d.name}” were sent to ${owner}.`)}
                      >
                        <Icon name="send" size={14} />Route
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
        <div className="ih-card-foot">
          <Text size="xs" variant="secondary">
            Score drag is the points of the overall average attributable to each theme. A negative
            value means the theme pulls the score <em>up</em>.
          </Text>
        </div>
      </LayerCard>

      {/* FR-108 — variants compared side by side, labelled by variant name. */}
      <VariantComparison divergent={divergent} title="Variant comparison">
        {VARIANT_RESULTS.map((v) => (
          <div className="ih-well" key={v.name}>
            <div className="ih-row-between">
              <span className="ih-t-h2">{v.name}</span>
              <Badge variant="outline" size="sm">{v.weight}%</Badge>
            </div>
            <Text size="xs" variant="mono-secondary" className="ih-block">{v.trigger}</Text>
            <div className="ih-grid ih-g3 ih-mt-12">
              <Cell label="Completion" value={percent(v.completionRate)} />
              <Cell label="Avg rating" value={<RatingValue value={v.avgRating} max={max} />} />
              <Cell label="Responses" value={count(v.responses)} />
            </div>
          </div>
        ))}
      </VariantComparison>

      {/* FR-109 — current AI weights with their history. */}
      {isIntelligent && <WeightHistory variants={VARIANT_RESULTS} />}

      <AiReadings lines={AI_SUGGESTIONS} />
    </div>
  );
}

/* Announcement impact — conversion, what it cost, and whether it was
   incremental. Everything here is post-tap: the engagement tab ends at the
   tap, this one starts there. */
function AnnouncementImpact({ campaign: c }) {
  const conv = CONVERSION;
  const e = ENGAGEMENT;
  const lift = ((HOLDOUT.audienceRate - HOLDOUT.controlRate) / HOLDOUT.controlRate) * 100;
  const discountPerOrder = OFFER.discountCost / OFFER.redemptions;
  const divergent = c.divergentTriggers;
  const ctrMax = Math.max(...ANNOUNCE_VARIANTS.map((v) => (v.taps / v.shown) * 100));

  return (
    <div className="ih-stack-lg">
      <LayerCard className="ih-card" data-insight="conversion-funnel">
        <div className="ih-card-head">
          <div>
            <h3 className="ih-t-h2">Conversion</h3>
            <Text size="xs" variant="secondary" className="ih-block">
              What the tap led to, inside the attribution window
            </Text>
          </div>
          {/* An attribution figure without its window cannot be read, so the
              window is stated on the panel rather than left to a footnote. */}
          <Badge variant="outline" size="sm">
            <Icon name="clock" size={11} />{conv.windowHours}h window
          </Badge>
        </div>
        <div className="ih-card-body ih-stack">
          <div className="ih-figures">
            {CONVERSION_FUNNEL.map((step, i) => {
              const prev = i === 0 ? null : CONVERSION_FUNNEL[i - 1];
              return (
                <div className="ih-figure" key={step.label}>
                  <span className="ih-figure-label">{step.label}</span>
                  <span className="ih-figure-value">{count(step.value)}</span>
                  <span className="ih-figure-note">
                    {!prev ? 'Top of the funnel' : `${rate(step.value, prev.value, 0)} of ${prev.label}`}
                  </span>
                </div>
              );
            })}
          </div>
          <Banner
            variant="secondary"
            icon={<Icon name="info" size={16} />}
            description={
              <>
                <span className="ih-mono">{count(conv.orders)}</span> orders from{' '}
                <span className="ih-mono">{count(e.uniqueReach)}</span> people reached —{' '}
                <span className="ih-mono">{rate(conv.orders, e.uniqueReach, 2)}</span>. Whether they
                would have ordered anyway is the holdout’s question, below.
              </>
            }
          />
        </div>
      </LayerCard>

      <LayerCard className="ih-card" data-insight="holdout">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Holdout lift</h3>
          <Text size="xs" variant="secondary">
            Measured against {count(HOLDOUT.controlSize)} users held back from the send
          </Text>
        </div>
        <div className="ih-card-body ih-stack">
          <div className="ih-grid ih-g3">
            <div className="ih-well">
              <Text size="xs" variant="secondary">Reached and converted</Text>
              <span className="ih-num ih-display">{percent(HOLDOUT.audienceRate, 2)}</span>
            </div>
            <div className="ih-well">
              <Text size="xs" variant="secondary">Control converted</Text>
              <span className="ih-num ih-display ih-fg-light">{percent(HOLDOUT.controlRate, 2)}</span>
            </div>
            <div className="ih-well">
              <Text size="xs" variant="secondary">Lift</Text>
              <span className="ih-num ih-display ih-fg-success">+{percent(lift, 0)}</span>
            </div>
          </div>
          <Banner
            variant="secondary"
            icon={<Icon name="info" size={16} />}
            description={
              <>
                Roughly <strong>{count(HOLDOUT.incrementalOrders)} of the {count(conv.orders)} orders</strong>{' '}
                would not have happened without this campaign. The rest are orders the campaign was
                present for, not orders it caused.
              </>
            }
          />
        </div>
      </LayerCard>

      <LayerCard className="ih-card" data-insight="offer-redemption">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Offer redemption</h3>
          <Badge variant="outline" size="sm">{OFFER.code}</Badge>
        </div>
        <div className="ih-card-body">
          <div className="ih-grid ih-g4">
            <Stat label="Redemptions" value={count(OFFER.redemptions)} />
            <Stat label="Of attributed orders" value={rate(OFFER.redemptions, conv.orders)} />
            <Stat label="Discount given" value={money(OFFER.discountCost)} />
            <Stat keyed label="Net revenue" value={money(OFFER.netRevenue)} />
          </div>
        </div>
        <div className="ih-card-foot">
          <Text size="xs" variant="secondary">
            {money(Math.round(discountPerOrder))} of discount per redeemed order. Set against the{' '}
            {count(HOLDOUT.incrementalOrders)} incremental orders above, not against all{' '}
            {count(conv.orders)}.
          </Text>
        </div>
      </LayerCard>

      {/* FR-108 — variants compared on what an announcement is actually for. */}
      <VariantComparison divergent={divergent} title="Variant comparison">
        {ANNOUNCE_VARIANTS.map((v) => {
          const ctr = (v.taps / v.shown) * 100;
          return (
            <div className="ih-well" key={v.name}>
              <div className="ih-row-between">
                <span className="ih-t-h2">{v.name}</span>
                <Badge variant="outline" size="sm">{v.weight}%</Badge>
              </div>
              <Text size="xs" variant="mono-secondary" className="ih-block">{v.trigger}</Text>
              <div className="ih-grid ih-g3 ih-mt-12">
                <Cell
                  label="Tap-through" value={percent(ctr)}
                  color={ctr === ctrMax ? 'var(--success-fg)' : undefined}
                />
                <Cell label="Orders" value={count(v.orders)} />
                <Cell label="Per recipient" value={money(v.revenuePerRecipient)} />
              </div>
            </div>
          );
        })}
      </VariantComparison>

      <AiReadings lines={ANNOUNCE_AI_SUGGESTIONS} />
    </div>
  );
}

function VariantComparison({ divergent, title, children }) {
  return (
    <LayerCard className="ih-card" data-insight="variant-comparison">
      <div className="ih-card-head">
        <h3 className="ih-t-h2">{title}</h3>
        {divergent
          ? <Badge variant="warning" size="sm"><Icon name="warn" size={11} />Not like-for-like</Badge>
          : <Text size="xs" variant="secondary">Same trigger on both variants</Text>}
      </div>
      <div className="ih-card-body ih-stack">
        {divergent && (
          <Banner
            variant="alert"
            icon={<Icon name="warn" size={16} />}
            description={
              <>
                These variants run <strong>different triggers</strong>, so content is not the single
                variable between them. Read this as two campaigns sharing a name, not as an A/B
                result.
              </>
            }
          />
        )}
        <div className="ih-grid ih-g2">{children}</div>
      </div>
    </LayerCard>
  );
}

const Cell = ({ label, value, color }) => (
  <span className="ih-col">
    <Text size="xs" variant="secondary">{label}</Text>
    <span className="ih-num ih-cell-value" style={color ? { color } : undefined}>{value}</span>
  </span>
);

const Stat = ({ label, value, keyed }) => (
  <div className={`ih-stat${keyed ? ' ih-stat-key' : ''}`}>
    <span className="ih-stat-label">{label}</span>
    <span className="ih-stat-value">{value}</span>
  </div>
);

/** FR-109 — the current AI weights, with the history that produced them. */
function WeightHistory({ variants }) {
  return (
    <LayerCard className="ih-card ih-card-ai" data-insight="weight-history">
      <div className="ih-card-head ih-card-head-ai">
        <span className="ih-row-gap">
          <Icon name="sparkles" size={16} className="ih-fg-ai" />
          <h3 className="ih-t-h2 ih-fg-ai">Intelligent A/B weighting</h3>
        </span>
        <span className="ih-badge-ai">AI-assigned</span>
      </div>
      <div className="ih-card-body">
        <Text variant="secondary" className="ih-block ih-mb-12">
          A shift in results can be read against the shift in traffic allocation that produced it.
        </Text>
        <div className="ih-stack-sm">
          {WEIGHT_HISTORY.map((w) => (
            <div className="ih-weight-row" key={w.date}>
              <Text size="xs" variant="mono-secondary" className="ih-w-52">{w.date}</Text>
              <span className="ih-weight-bar">
                <Tooltip content={`${variants[0].name} ${w.a}%`}>
                  <span style={{ width: `${w.a}%`, background: AI_ACCENT, opacity: 0.45 }} />
                </Tooltip>
                <Tooltip content={`${variants[1].name} ${w.b}%`}>
                  <span style={{ width: `${w.b}%`, background: AI_ACCENT }} />
                </Tooltip>
              </span>
              <Text size="xs" variant="mono-secondary" className="ih-w-74 ih-ta-r">{w.a}/{w.b}</Text>
            </div>
          ))}
        </div>
      </div>
    </LayerCard>
  );
}

/* FR-91 — machine inference, in the accent reserved for it and nothing else. */
function AiReadings({ lines }) {
  return (
    <LayerCard className="ih-card ih-card-ai" data-insight="ai-readings">
      <div className="ih-card-head ih-card-head-ai">
        <span className="ih-row-gap">
          <Icon name="sparkles" size={16} className="ih-fg-ai" />
          <h3 className="ih-t-h2 ih-fg-ai">What the assistant reads here</h3>
        </span>
        <span className="ih-badge-ai">AI-generated</span>
      </div>
      <div className="ih-card-body">
        <ul className="ih-stack-sm ih-ai-lines">
          {lines.map((line) => (
            <li key={line}>
              <span className="ih-ai-mark" style={{ background: AI_ACCENT }} />
              <Text>{line}</Text>
            </li>
          ))}
        </ul>
      </div>
      <div className="ih-card-foot">
        <Text size="xs" variant="secondary">
          Inference, not measurement. Every claim above is traceable to a panel on this page.
        </Text>
      </div>
    </LayerCard>
  );
}
