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
import { RATING_BLOCK, BRANCH_BLOCKS, OPEN_RESPONSES, SEGMENTS, SCORE_DRIVERS } from '../../lib/data.js';

/* The page filters hold a segment's id, because that is what the control's
   options are keyed by; a response records the segment's name. One lookup
   each way, in the one place that has to join them. A name with no segment
   behind it yields `undefined`, which `MetaFilter` reads as "not a filter" —
   the seed's names all resolve, and a chip that set a filter to nothing would
   empty the list rather than narrow it. */
const segmentName = (id) => SEGMENTS.find((s) => s.id === id)?.name;
const segmentId = (name) => SEGMENTS.find((s) => s.name === name)?.id;

/* The band card's heading, which is the same three marks whether or not it is
   also the control that filters by them. */
const bandHead = (b, bandScore, max) => (
  <>
    <span className="ih-band-dot" style={{ background: ratingColor(bandScore, 5) }} />
    <span className="ih-t-h3">{BAND_LABEL[b.band]}</span>
    <Badge variant="outline" size="sm">{bandRange(b.band, max)}</Badge>
  </>
);

/**
 * One fact on a response, as the filter for that fact.
 *
 * `onToggle` is handed whether the filter is already on, so pressing the chip
 * that put the list in this state is how you get back out — the same toggle
 * the distribution bars use, for the same reason: a filter set by clicking a
 * value needs an off that is also a click on that value.
 */
function MetaFilter({ label, on, onToggle, noun, mono }) {
  if (!label || !onToggle) return <span className={mono ? 'ih-mono' : undefined}>{label}</span>;
  return (
    <button
      type="button"
      className={`ih-xf${mono ? ' ih-mono' : ''}`}
      data-on={on ? '' : undefined}
      aria-pressed={on}
      aria-label={on ? `Stop filtering by ${noun} ${label}` : `Filter by ${noun} ${label}`}
      onClick={() => onToggle(on)}
    >
      {label}
    </button>
  );
}

export function ResponsesTab({ campaign: c, filters, onFilter, crossFilter = true }) {
  const max = scaleMax(c);
  const block = RATING_BLOCK;
  const distMax = Math.max(...block.distribution.map((d) => d.count));
  const [textQuery, setTextQuery] = useState('');
  const [bandFilter, setBandFilter] = useState('all');
  // A single score, set by pressing its bar in the distribution above. Kept
  // local rather than on the page filters for the same reason the band is:
  // both narrow this one list, and neither has anything to say to the
  // Delivery or Impact tab, which carry no per-response breakdown at all.
  const [scoreFilter, setScoreFilter] = useState(null);
  const [openId, setOpenId] = useState(null);

  /* Every filter that can reach a response, applied in one place.
     `segment` and `variant` were controls that narrowed nothing until the
     rows became pressable — a filter you can set by clicking a value has to
     actually remove rows, or the click reads as broken. */
  const filtered = OPEN_RESPONSES.filter((r) => {
    const q = textQuery.trim().toLowerCase();
    return (!q || r.text.toLowerCase().includes(q))
      && (bandFilter === 'all' || r.band === bandFilter)
      && (scoreFilter == null || r.rating === scoreFilter)
      && (filters.version === 'all' || String(r.version) === filters.version)
      && (filters.variant === 'all' || r.variant === filters.variant)
      && (filters.segment === 'all' || segmentName(filters.segment) === r.segment)
      && (filters.theme === 'all' || r.themeId === filters.theme);
  });

  /* A press toggles: pressing the bar that is already the filter takes it off,
     which is the only way back out of one set by clicking rather than chosen
     from a menu. */
  const toggleScore = (score) => setScoreFilter((s) => (s === score ? null : score));
  const toggleBand = (band) => setBandFilter((b) => (b === band ? 'all' : band));

  const themeName = filters.theme !== 'all'
    && SCORE_DRIVERS.find((d) => d.themeId === filters.theme)?.name;

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
        {/* FR-98 — every bar is the filter for the score it counts. The join
            is exact: a response carries the rating it gave, so pressing the
            2/10 bar shows the people who gave a 2 and not a band they fall
            inside. */}
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
              /* `DistRow` already falls back to a plain row without this,
                 because a failure reason has nothing to filter either — the
                 shape the data needed is the shape the setting needs. */
              onSelect={crossFilter ? () => toggleScore(d.score) : undefined}
              selected={scoreFilter === d.score}
              selectLabel={scoreFilter === d.score
                ? `Stop filtering the open text to ${d.score} out of ${max}`
                : `Filter the open text to responses rated ${d.score} out of ${max}`}
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
                    {/* The band name is the band filter. A path already
                        reported on its own here is the natural way to ask what
                        the people on it wrote — and with cross-filtering off it
                        goes back to being the heading it also is. */}
                    {crossFilter ? (
                      <button
                        type="button"
                        className="ih-row-gap ih-xf"
                        data-on={bandFilter === b.band ? '' : undefined}
                        aria-pressed={bandFilter === b.band}
                        aria-label={bandFilter === b.band
                          ? `Stop filtering the open text to ${BAND_LABEL[b.band]}`
                          : `Filter the open text to ${BAND_LABEL[b.band]} responses`}
                        onClick={() => toggleBand(b.band)}
                      >
                        {bandHead(b, bandScore, max)}
                      </button>
                    ) : (
                      <span className="ih-row-gap">{bandHead(b, bandScore, max)}</span>
                    )}
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
          <div>
            <h3 className="ih-t-h2">Q3 · Open text</h3>
            {/* A theme is the one filter that can arrive from another tab, so
                it is the one this card has to introduce. The rest were set
                here, in view of the list they narrowed. */}
            {themeName && (
              <Text size="xs" variant="secondary" className="ih-block">
                Narrowed to <strong>{themeName}</strong> — the driver you opened from Impact.
              </Text>
            )}
          </div>
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
          {/* The bar that set this is in the card above, and on a long list it
              is scrolled off. A filter the reader cannot see is one they read
              as missing data, so it says so here too — and comes off here. */}
          {scoreFilter != null && (
            <button
              type="button"
              className="ih-xf-chip"
              onClick={() => setScoreFilter(null)}
              aria-label={`Stop filtering the open text to ${scoreFilter} out of ${max}`}
            >
              Rated <b>{scoreFilter}/{max}</b>
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <Empty description="No responses match these filters." />
        ) : (
          <ul className="ih-response-list">
            {filtered.map((r) => (
              <li key={r.id}>
                {/* Laid under the row rather than wrapped around it: the row
                    now holds controls of its own, and a button inside a button
                    swallows them. See `.ih-response-open`. */}
                <button
                  type="button"
                  className="ih-response-open"
                  aria-label={`Open response ${r.id}`}
                  onClick={() => setOpenId(r.id)}
                />
                <div className="ih-response-row">
                  <span className="ih-response-score">
                    <span className="ih-rating-val ih-rating-lg" style={{ color: ratingColor(r.rating, max) }}>
                      {r.rating}
                    </span>
                    <Text size="xs" variant="mono-secondary">/{max}</Text>
                  </span>
                  <span className="ih-grow">
                    <Text className="ih-block">{r.text}</Text>
                    {/* Each fact a response carries that the page can filter
                        by is the control for that filter. The two that are
                        not — when it arrived, and the band, which the cards
                        above already filter by — stay plain text, so a chip
                        always means the same thing. */}
                    <span className="ih-kv ih-response-meta">
                      <span className="ih-mono">{r.at}</span>
                      {/* `MetaFilter` prints plain text for a null toggle,
                          which is already how it handles a segment name with
                          no segment behind it. Cross-filtering off is the same
                          answer for every one of them at once. */}
                      <MetaFilter
                        label={r.segment}
                        on={segmentName(filters.segment) === r.segment}
                        onToggle={crossFilter && segmentId(r.segment)
                          ? (on) => onFilter('segment', on ? 'all' : segmentId(r.segment))
                          : null}
                        noun="segment"
                      />
                      <MetaFilter
                        label={r.variant}
                        on={filters.variant === r.variant}
                        onToggle={crossFilter
                          ? (on) => onFilter('variant', on ? 'all' : r.variant)
                          : null}
                        noun="variant"
                      />
                      <MetaFilter
                        label={`v${r.version}`}
                        mono
                        on={filters.version === String(r.version)}
                        onToggle={crossFilter
                          ? (on) => onFilter('version', on ? 'all' : String(r.version))
                          : null}
                        noun="version"
                      />
                      <span>{BAND_LABEL[r.band]}</span>
                    </span>
                  </span>
                  <Icon name="right" size={14} />
                </div>
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
