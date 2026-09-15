/* ==========================================================================
   InsightChart.jsx — the delivery plot, and the distribution rows under it.

   §11.4 maps `.chart` onto Kumo's `Chart` / `TimeseriesChart`, which wrap
   ECharts. That is the right destination for a real product, and it is not
   this: ECharts is a 1MB canvas renderer, and these are twenty-odd stacked
   divs with a version boundary drawn through them. The prototype's charts
   stay DOM, and what Kumo supplies is the frame (LayerCard) and the type.

   The bar rows *are* Kumo's, though: a labelled value inside a known range is
   exactly `Meter`, which is what §11.4 says `.bar-track` / `.bar-fill` is.
   ========================================================================== */
import { useState } from 'react';
import { Text } from '@cloudflare/kumo';
import { count } from '../lib/format.js';
import { CHART_H } from '../lib/insights-lib.js';

/** Four dashed rules — 0 and three divisions up to the plot's top. */
function Gridlines({ top }) {
  return (
    <div className="ih-chart-grid" aria-hidden="true">
      {[3, 2, 1, 0].map((i) => {
        const value = (top / 3) * i;
        return (
          <span
            key={i}
            className="ih-chart-rule"
            data-base={i === 0 ? '' : undefined}
            data-top={i === 3 ? '' : undefined}
            style={{ bottom: `${((value / top) * CHART_H).toFixed(1)}px` }}
          >
            <span>{count(Math.round(value))}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * `points` is `[{ key, label, segs: [{ height, fill, opacity }], readout, boundary }]`.
 *
 * The readout opens against the hovered column rather than the pointer: the
 * tip settles once per column instead of sliding under a pointer that is still
 * crossing the same bar. This chart is 150px tall against a readout of about
 * ninety, so unlike the campaign cards it has the room to hold the tip beside
 * its bars rather than lift it out of the plot.
 */
export function InsightChart({ top, points }) {
  const [reading, setReading] = useState(null);
  const open = reading != null ? points[reading] : null;

  return (
    <div className="ih-chart" style={{ height: `${CHART_H}px` }}>
      <Gridlines top={top} />
      <div
        className="ih-chart-plot ih-chart-plot-tall"
        data-reading={open ? 'true' : undefined}
        onMouseLeave={() => setReading(null)}
      >
        {points.map((p, i) => (
          <span key={p.key} className="ih-chart-slot">
            {/* FR-93 — the dashed rule marks where a new version begins. */}
            {p.boundary && <span className="ih-chart-boundary" title="Version boundary" />}
            <span
              className="ih-chart-col"
              data-on={reading === i ? '' : undefined}
              onMouseEnter={() => setReading(i)}
            >
              {p.segs.map((seg, j) => (
                <span
                  key={j}
                  className="ih-chart-seg"
                  style={{ height: `${seg.height}px`, background: seg.fill, opacity: seg.opacity }}
                />
              ))}
            </span>
          </span>
        ))}
      </div>
      {open && (
        <div
          className="ih-chart-tip ih-chart-tip-inline"
          data-open="true"
          style={{ left: `${(open === points[0] ? 0 : reading / Math.max(1, points.length - 1)) * 100}%` }}
        >
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
  );
}

/**
 * One distribution row: a label, the bar, and the count with its share.
 *
 * §11.4 maps this onto Kumo's `Meter` — "a measured value in a known range" —
 * and that is what it is, but Meter prints its own label above its own track
 * and takes no per-row colour. These rows are a three-column grid whose fill
 * carries the rating ramp, which is the one thing about them that means
 * something. So the geometry stays ours and the type is Kumo's.
 */
export function DistRow({ label, value, share: shareText, fill, opacity, pct, columns }) {
  return (
    <div className="ih-dist-row" style={columns ? { gridTemplateColumns: columns } : undefined}>
      <span className="ih-dist-label truncate">{label}</span>
      <span className="ih-bar-track">
        <span className="ih-bar-fill" style={{ width: `${pct}%`, background: fill, opacity }} />
      </span>
      <span className="ih-dist-figures">
        <span className="ih-num">{count(value)}</span>
        <Text size="xs" variant="mono-secondary">{shareText}</Text>
      </span>
    </div>
  );
}
