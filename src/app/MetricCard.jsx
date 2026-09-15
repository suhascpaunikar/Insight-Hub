/* ==========================================================================
   MetricCard.jsx — the activity strip's four cards (FR-71).

   One of §11.4's "(none)" entries. Kumo defers charts to ECharts and ships no
   sparkline, and a 40px band of bars inside a figure is not a `Chart` — so
   the plot stays the product's own CSS. What is Kumo here is the frame
   (LayerCard) and the readout's typography (Text).

   Every figure is a sum over the same slice the sparkline draws, so the
   number and the shape can never disagree.
   ========================================================================== */
import { useState, useRef } from 'react';
import { LayerCard } from '@cloudflare/kumo';
import { count } from '../lib/format.js';

/**
 * A count is read against zero. A rate is not: completion moving 44% → 54% is
 * the whole story, and drawing it from zero flattens it into a wall of equal
 * bars. `band` scales those against the window's own low and high, and the
 * axis prints that low and high so the zoom is stated, not hidden.
 */
export function MetricCard({ name, legend = [], value, subs = [], rows, series, axis, band }) {
  const [reading, setReading] = useState(null);
  const plotRef = useRef(null);

  const total = (row) => series.reduce((t, s) => t + s.of(row), 0);
  const values = rows.map(total);
  const floor = band ? Math.min(...values) * 0.985 : 0;
  const peak = Math.max(...values);
  const span = peak - floor || 1;

  const columns = rows.map((row, i) => {
    // What the readout says for this column: one line per series, in the ink
    // the series is drawn in.
    const readout = series.map((s) => ({
      label: s.label,
      value: s.read ? s.read(row) : count(Math.round(s.of(row))),
      fill: typeof s.fill === 'function' ? s.fill(row) : s.fill,
      opacity: s.opacity || '1',
    }));
    const segs = series.map((s, j) => {
      // Only the base segment carries the floor; the ones stacked on it are
      // already measured from where it ends.
      const raised = j === 0 ? s.of(row) - floor : s.of(row);
      return {
        height: Math.max(0, (raised / span) * 40),
        fill: typeof s.fill === 'function' ? s.fill(row) : s.fill,
        opacity: s.opacity,
      };
    });
    return { i, label: row.label, readout, segs: segs.reverse() };
  });

  const open = reading != null ? columns[reading] : null;

  return (
    <LayerCard className="ih-metric">
      <div className="ih-metric-head">
        <span className="ih-metric-name">{name}</span>
        <span className="ih-metric-legend">
          {legend.map((l) => (
            <span className="ih-metric-key" data-tone={l.tone} key={l.label}><i />{l.label}</span>
          ))}
        </span>
      </div>
      <div className="ih-metric-figures">
        <span className="ih-metric-value" style={value.color ? { color: value.color } : undefined}>
          {value.text}
        </span>
        <span className="ih-metric-sub">{subs.map((s) => <b key={s}>{s}</b>)}</span>
      </div>
      <div className="ih-metric-plot" ref={plotRef}>
        {/* mouseleave on the plot rather than mouseenter per column: the
            columns are 3px apart, and entering each one separately makes the
            readout flicker as the pointer crosses the gaps. */}
        <div
          className="ih-chart-plot"
          data-reading={open ? 'true' : undefined}
          aria-hidden="true"
          onMouseLeave={() => setReading(null)}
        >
          {columns.map((col) => (
            <span
              className="ih-chart-col"
              key={col.i}
              data-on={reading === col.i ? '' : undefined}
              onMouseEnter={() => setReading(col.i)}
            >
              {col.segs.map((seg, j) => (
                <span
                  className="ih-chart-seg"
                  key={j}
                  style={{ height: `${seg.height.toFixed(1)}px`, background: seg.fill, opacity: seg.opacity }}
                />
              ))}
            </span>
          ))}
        </div>
        <div className="ih-metric-axis"><span>{axis[0]}</span><span>{axis[1]}</span></div>
        {/* Lifted clear of the plot rather than placed inside it: the card's
            band of bars is 40px and the readout is nearer a hundred, so no
            placement within the card leaves the series whole. It sits over the
            card's own figures instead — those are printed and stay printed,
            while the bars are what the reader opened the readout to look at. */}
        {open && (
          <div className="ih-chart-tip" data-open="true" style={{ left: `${(open.i / (columns.length - 1)) * 100}%` }}>
            {open.readout.map((r) => (
              <div className="ih-chart-tip-row" key={r.label}>
                <i style={{ background: r.fill, opacity: r.opacity }} />
                <span>{r.label}</span><b>{r.value}</b>
              </div>
            ))}
            <div className="ih-chart-tip-foot">{open.label}</div>
          </div>
        )}
      </div>
    </LayerCard>
  );
}
