/* ==========================================================================
   Responses tab (FR-98 … FR-102)
   ========================================================================== */
import { useState } from 'react';
import { LayerCard, Badge, Input, Select, Text, Empty, Dialog, Button, Banner } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { DistRow } from '../../app/InsightChart.jsx';
import { count, ratingText } from '../../lib/format.js';
import { ratingColor, BANDS, BAND_LABEL, bandRange } from '../../lib/palette.js';
import { elementLabel, scaleMax, share } from '../../lib/insights-lib.js';
import { RATING_BLOCK, BRANCH_BLOCKS, OPEN_RESPONSES } from '../../lib/data.js';

export function ResponsesTab({ campaign: c, filters }) {
  const max = scaleMax(c);
  const block = RATING_BLOCK;
  const distMax = Math.max(...block.distribution.map((d) => d.count));
  const [textQuery, setTextQuery] = useState('');
  const [bandFilter, setBandFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const filtered = OPEN_RESPONSES.filter((r) => {
    const q = textQuery.trim().toLowerCase();
    return (!q || r.text.toLowerCase().includes(q))
      && (bandFilter === 'all' || r.band === bandFilter)
      && (filters.version === 'all' || String(r.version) === filters.version);
  });

  return (
    <div className="ih-stack-lg">
      {/* FR-99 — one rating block. No secondary or composite rating is displayed. */}
      <LayerCard className="ih-card" data-insight="rating-block">
        <div className="ih-card-head">
          <div>
            <h3 className="ih-t-h2">{block.question}</h3>
            <Text size="xs" variant="secondary" className="ih-block">
              Q1 · {elementLabel(c)} · the campaign’s single rating element
            </Text>
          </div>
          <span className="ih-headline-figures">
            <span className="ih-headline">
              <Text size="xs" variant="secondary">Mean</Text>
              <span className="ih-headline-value" style={{ color: ratingColor(block.average, max) }}>
                {ratingText(block.average)}
              </span>
            </span>
            <span className="ih-headline">
              <Text size="xs" variant="secondary">Responses</Text>
              <span className="ih-headline-value ih-num">{count(block.responses)}</span>
            </span>
          </span>
        </div>
        <div className="ih-card-body ih-dist">
          {block.distribution.map((d) => (
            <DistRow
              key={d.score}
              label={`${d.score}${c.ratingElement === 'star' ? ' ★' : ''}`}
              value={d.count}
              share={share(d.count, block.responses)}
              fill={ratingColor(d.score, max)}
              pct={(d.count / distMax) * 100}
              columns="56px 1fr 120px"
            />
          ))}
        </div>
      </LayerCard>

      {/* FR-100 — each branch's follow-up is read within its own path, never pooled. */}
      <section data-insight="branch-blocks">
        <div className="ih-row-between ih-mb-10">
          <h3 className="ih-t-h2">Q2 · Follow-up by rating band</h3>
          <Text size="xs" variant="secondary">
            Branching is on — each path is reported separately
          </Text>
        </div>
        <div className="ih-grid ih-g3">
          {BRANCH_BLOCKS.map((b) => {
            const bandScore = b.band === 'detractor' ? 1 : b.band === 'passive' ? 3 : 5;
            const optMax = Math.max(...b.options.map((o) => o.count));
            return (
              <LayerCard className="ih-card" key={b.band}>
                <div className="ih-card-head ih-card-head-tight">
                  <span className="ih-col">
                    <span className="ih-row-gap">
                      <span className="ih-band-dot" style={{ background: ratingColor(bandScore, 5) }} />
                      <span className="ih-t-h3">{BAND_LABEL[b.band]}</span>
                      <Badge variant="outline" size="sm">{bandRange(b.band, max)}</Badge>
                    </span>
                    <Text size="xs" variant="secondary">{b.question}</Text>
                  </span>
                </div>
                <div className="ih-card-body">
                  <div className="ih-row-between ih-mb-10">
                    <Text size="xs" variant="secondary">Took this path</Text>
                    <span className="ih-num">{count(b.responses)}</span>
                  </div>
                  <div className="ih-dist">
                    {b.options.map((o) => (
                      <div key={o.label}>
                        <div className="ih-row-between ih-mb-3">
                          <Text size="xs" className="truncate">{o.label}</Text>
                          <span className="ih-row-gap-6">
                            <span className="ih-num ih-t-xs">{count(o.count)}</span>
                            <Text size="xs" variant="mono-secondary">{share(o.count, b.responses)}</Text>
                          </span>
                        </div>
                        <span className="ih-bar-track ih-bar-thin">
                          <span
                            className="ih-bar-fill"
                            style={{
                              width: `${(o.count / optMax) * 100}%`,
                              background: ratingColor(bandScore, 5),
                              opacity: 0.7,
                            }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </LayerCard>
            );
          })}
        </div>
      </section>

      {/* FR-101 — a searchable, filterable list of free-text answers. */}
      <LayerCard className="ih-card" data-insight="open-text">
        <div className="ih-card-head">
          <h3 className="ih-t-h2">Q3 · Open text</h3>
          <Text size="xs" variant="mono-secondary">
            {count(filtered.length)} of {count(OPEN_RESPONSES.length)} shown
          </Text>
        </div>
        <div className="ih-toolbar ih-toolbar-inset">
          <Input
            size="sm"
            className="ih-toolbar-search"
            aria-label="Search open text"
            placeholder="Search what people wrote"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
          />
          <Select
            size="sm"
            className="ih-w-170"
            aria-label="Filter by rating band"
            value={bandFilter}
            items={{
              all: 'All rating bands',
              ...Object.fromEntries(BANDS.map((b) => [b, `${BAND_LABEL[b]} · ${bandRange(b, max)}`])),
            }}
            onValueChange={setBandFilter}
          />
        </div>
        {filtered.length === 0 ? (
          <Empty description="No responses match these filters." />
        ) : (
          <ul className="ih-response-list">
            {filtered.map((r) => (
              <li key={r.id}>
                <button type="button" className="ih-response-row" onClick={() => setOpenId(r.id)}>
                  <span className="ih-response-score">
                    <span className="ih-rating-val ih-rating-lg" style={{ color: ratingColor(r.rating, max) }}>
                      {r.rating}
                    </span>
                    <Text size="xs" variant="mono-secondary">/{max}</Text>
                  </span>
                  <span className="ih-grow">
                    <Text className="ih-block">{r.text}</Text>
                    <span className="ih-kv">
                      <span className="ih-mono">{r.at}</span>
                      <span>{r.segment}</span>
                      <span>{r.variant}</span>
                      <span className="ih-mono">v{r.version}</span>
                      <span>{BAND_LABEL[r.band]}</span>
                    </span>
                  </span>
                  <Icon name="right" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </LayerCard>

      <ResponseDetail
        response={OPEN_RESPONSES.find((r) => r.id === openId)}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

/** FR-102 — one respondent's full answer set, in order, with their context. */
function ResponseDetail({ response: r, onClose }) {
  return (
    <Dialog.Root open={Boolean(r)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title className="ih-dialog-title">Response detail</Dialog.Title>
        <Dialog.Description render={<div />} className="ih-dialog-body">
          <div className="ih-row-wrap">
            <Badge variant="outline" size="sm">{r?.id}</Badge>
            <Badge variant="neutral" size="sm">{r?.segment}</Badge>
            <Badge variant="neutral" size="sm">{r?.variant}</Badge>
            <Badge variant="outline" size="sm">v{r?.version}</Badge>
            <Badge variant="outline" size="sm">{r?.at}</Badge>
          </div>
          <div className="ih-well">
            <Text size="xs" variant="secondary">Order context</Text>
            <Text size="sm" variant="mono" className="ih-block">{r?.context}</Text>
          </div>
          <ol className="ih-stack-sm ih-answer-list">
            {(r?.answers || []).map((a, i) => (
              <LayerCard render={<li />} className="ih-answer" key={a.question}>
                <Text size="xs" variant="secondary">Q{i + 1}</Text>
                <p className="ih-t-h3">{a.question}</p>
                <Text className="ih-block">{a.answer}</Text>
              </LayerCard>
            ))}
          </ol>
          {/* OD-22 — the respondent is pseudonymous in this prototype. */}
          <Banner
            variant="secondary"
            icon={<Icon name="info" size={16} />}
            description={
              <>
                Open decision <span className="ih-mono">OD-22</span> — the respondent is shown here
                as a pseudonymous response ID with segment and order context, never a name or
                contact detail. Export inherits the same posture.
              </>
            }
          />
        </Dialog.Description>
        <div className="ih-dialog-foot">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
