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
import { useState, useRef, useEffect } from 'react';
import { Text } from '@cloudflare/kumo';
import { ChartTip } from './ChartTip.jsx';
import { count } from '../lib/format.js';
import { CHART_H, MIN_BRUSH } from '../lib/insights-lib.js';

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
 * Which column a pointer at `clientX` is over.
 *
 * Measured by dividing the plot's own width rather than by hit-testing the
 * columns, because the columns do not tile it: they sit in a flex row with a
 * 3px gap, and a press that lands in a gap would hit-test to nothing. Uniform
 * division has no gaps to fall into, and the error it trades for that is half
 * a gap at a column's edge — well inside the pointer's own precision.
 */
function columnAt(plot, clientX, n) {
  const rect = plot.getBoundingClientRect();
  if (!rect.width) return 0;
  const t = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(n - 1, Math.floor(t * n)));
}

/**
 * `points` is `[{ key, label, segs: [{ height, fill, opacity }], readout, boundary }]`.
 *
 * The readout opens against the hovered column rather than the pointer: the
 * tip settles once per column instead of sliding under a pointer that is still
 * crossing the same bar. This chart is 150px tall against a readout of about
 * ninety, so unlike the campaign cards it has the room to hold the tip beside
 * its bars rather than lift it out of the plot. ChartTip keeps it inside them:
 * this plot is inset by the gridline gutter, and at either end a tip centred
 * on the chart's own edge would hang outside the card and be cut off.
 *
 * `onBrush` makes the plot a range control: drag across it and the window you
 * covered is handed back as `{ from, to }` — the two end points' keys, which
 * are the dates `sliceRange` reads a brush in. Without it the chart is exactly
 * what it was, because the failure-reason charts and the announcement series
 * have no window for a brush to set.
 *
 * The brush is pointer-only, and deliberately a *second* route rather than the
 * route: the Date range control above the tab is the one every reader has, it
 * states whatever the brush selected, and picking a preset from it is the way
 * back out. That is the same bargain `HoverCard` documents — an affordance
 * that needs a pointer may be faster, never sole.
 */
export function InsightChart({ top, points, onBrush }) {
  const [reading, setReading] = useState(null);
  // The two ends of a brush in progress, as column indices, while the pointer
  // is still down. Null whenever the chart is merely being read.
  const [drag, setDrag] = useState(null);
  // The column under the pointer, for the readout to measure itself against.
  const colRef = useRef(null);
  const open = reading != null && !drag ? points[reading] : null;

  /* Escape abandons a brush in progress. On the window rather than the plot:
     the plot is not focusable — the Date range control is this chart's
     keyboard surface — so a key handler on it would never be reached. Bound
     only while a drag is live, so the chart adds no listener to a page that is
     merely being read. */
  useEffect(() => {
    if (!drag) return undefined;
    const abandon = (e) => { if (e.key === 'Escape') setDrag(null); };
    window.addEventListener('keydown', abandon);
    return () => window.removeEventListener('keydown', abandon);
  }, [Boolean(drag)]);

  const brushable = Boolean(onBrush) && points.length >= MIN_BRUSH;
  const lo = drag ? Math.min(drag.from, drag.to) : 0;
  const hi = drag ? Math.max(drag.from, drag.to) : 0;
  const span = drag ? hi - lo + 1 : 0;

  /* A press that never travels far enough is not a selection. Discarding it
     rather than committing a one-column window is what lets a click keep
     meaning "read this column" on a plot that is also a range control. */
  const settle = () => {
    if (drag && span >= MIN_BRUSH) onBrush({ from: points[lo].key, to: points[hi].key });
    setDrag(null);
  };

  const brushHandlers = brushable ? {
    onPointerDown: (e) => {
      // Primary button only: a right-click is a context menu, and a middle
      // click is a scroll, neither of which is a drag across a chart.
      if (e.button !== 0) return;
      e.preventDefault();
      // Capture, so a drag that leaves the plot — and one that ends outside it
      // — is still this element's to finish.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const i = columnAt(e.currentTarget, e.clientX, points.length);
      setReading(null);
      setDrag({ from: i, to: i });
    },
    onPointerMove: (e) => {
      if (!drag) return;
      const i = columnAt(e.currentTarget, e.clientX, points.length);
      // Only on a real change: a pointer moving within one column would
      // otherwise set state on every frame it reports.
      if (i !== drag.to) setDrag((d) => (d ? { ...d, to: i } : d));
    },
    /* `pointerup` is enough to close a captured drag, and is the only handler
       that commits: the browser releases capture on its own afterwards, so
       also settling on `lostpointercapture` would run the commit twice for
       every brush. `pointercancel` is the other way a drag ends — the browser
       taking the pointer back, which is not a selection. */
    onPointerUp: settle,
    onPointerCancel: () => setDrag(null),
  } : {};

  return (
    <div className="ih-chart" style={{ height: `${CHART_H}px` }}>
      <Gridlines top={top} />
      <div
        className="ih-chart-plot ih-chart-plot-tall"
        data-reading={open ? 'true' : undefined}
        data-brushable={brushable ? '' : undefined}
        data-brushing={drag ? '' : undefined}
        onMouseLeave={() => setReading(null)}
        {...brushHandlers}
      >
        {/* The window being drawn, over the columns it covers. Rendered from
            the same uniform division `columnAt` reads by, so the band lands on
            exactly the columns a release would commit. */}
        {drag && (
          <span
            className="ih-chart-brush"
            aria-hidden="true"
            data-short={span < MIN_BRUSH ? '' : undefined}
            style={{
              left: `${(lo / points.length) * 100}%`,
              width: `${(span / points.length) * 100}%`,
            }}
          />
        )}
        {points.map((p, i) => (
          <span key={p.key} className="ih-chart-slot">
            {/* FR-93 — the dashed rule marks where a new version begins. */}
            {p.boundary && <span className="ih-chart-boundary" title="Version boundary" />}
            <span
              className="ih-chart-col"
              ref={reading === i ? colRef : null}
              data-on={reading === i ? '' : undefined}
              data-in={drag && i >= lo && i <= hi ? '' : undefined}
              onMouseEnter={() => { if (!drag) setReading(i); }}
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
      {open && <ChartTip inline anchorRef={colRef} readout={open.readout} label={open.label} />}
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
 *
 * `onSelect` turns the row into the filter it already describes — press the
 * 2/10 bar and the open text narrows to the people who gave a 2. It is
 * optional because most of these rows have nothing to narrow: a failure reason
 * joins to no other panel in the seed, so making it pressable would promise a
 * link the data cannot honour.
 *
 * A pressable row is a real `<button>` with `aria-pressed`, so the filter it
 * carries is both reachable and reported. `selected` is what that press
 * produced, which is why it reads as a toggle rather than an action: pressing
 * the row that is already on is how you take the filter off again.
 */
export function DistRow({
  label, value, share: shareText, fill, opacity, pct, columns,
  onSelect, selected, selectLabel,
}) {
  const style = columns ? { gridTemplateColumns: columns } : undefined;
  const inner = (
    <>
      <span className="ih-dist-label truncate">{label}</span>
      <span className="ih-bar-track">
        <span className="ih-bar-fill" style={{ width: `${pct}%`, background: fill, opacity }} />
      </span>
      <span className="ih-dist-figures">
        <span className="ih-num">{count(value)}</span>
        <Text size="xs" variant="mono-secondary">{shareText}</Text>
      </span>
    </>
  );

  if (!onSelect) return <div className="ih-dist-row" style={style}>{inner}</div>;

  return (
    <button
      type="button"
      className="ih-dist-row ih-dist-row-press"
      style={style}
      data-on={selected ? '' : undefined}
      aria-pressed={selected}
      aria-label={selectLabel}
      onClick={onSelect}
    >
      {inner}
    </button>
  );
}
