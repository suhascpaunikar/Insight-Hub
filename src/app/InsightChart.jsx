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
 * The brush answers to a pointer and to the keyboard, and neither is the only
 * route: the Date range control above the tab states whatever was selected and
 * picking a preset from it is always a way back out.
 *
 * **Keyboard.** The plot takes focus. Arrow keys walk a cursor along the
 * columns and open each one's readout — which is the part that matters most,
 * because until now every number in this chart was behind a hover. Shift with
 * an arrow extends a selection from where the cursor was, Enter or Space
 * applies it, Escape abandons it. Home and End go to the ends of the series.
 *
 * `keyboard` is Settings → General → Keyboard, and switching it off takes the
 * plot out of the tab order entirely — no focus, no cursor, no keys. It is on
 * by default and the setting says what turning it off costs, because what goes
 * with it is the only way to read a column without a pointer.
 *
 * `label` names the chart for a reader who arrives at it by tab and has no
 * heading in view; the chart itself has no idea which series it is drawing.
 */
export function InsightChart({ top, points, onBrush, label, keyboard = true }) {
  const [reading, setReading] = useState(null);
  /* The two ends of a selection in progress. `via` is which input is drawing
     it, because the two want opposite things from the readout: a pointer is
     physically over the plot and the tip would sit under the hand drawing the
     band, while the keyboard has no such occlusion and the readout is the only
     feedback a key press gets. */
  const [drag, setDrag] = useState(null);
  // Where the keyboard is, and whether it is driving at all.
  const [cursor, setCursor] = useState(null);
  const [focused, setFocused] = useState(false);
  // The column the readout measures itself against.
  const colRef = useRef(null);

  const n = points.length;
  /* A commit re-slices the series under this component, so an index taken
     before it can outlive the column it named. Clamped on the way out rather
     than chased on every change. */
  const clamp = (i) => (i == null ? null : Math.max(0, Math.min(n - 1, i)));
  const cur = clamp(cursor);
  const at = focused && cur != null ? cur : clamp(reading);
  const open = at != null && drag?.via !== 'pointer' ? points[at] : null;

  /* Escape abandons a selection a pointer is still drawing. It stays on the
     window because that drag can be in progress while focus is somewhere else
     entirely — the keyboard's own Escape is handled on the plot, where it can
     stop the key before the page acts on it too. Bound only while a drag is
     live, so a chart merely being read adds no listener. */
  useEffect(() => {
    if (drag?.via !== 'pointer') return undefined;
    const abandon = (e) => { if (e.key === 'Escape') setDrag(null); };
    window.addEventListener('keydown', abandon);
    return () => window.removeEventListener('keydown', abandon);
  }, [drag?.via === 'pointer']);

  const brushable = Boolean(onBrush) && n >= MIN_BRUSH;
  const lo = drag ? Math.min(drag.from, drag.to) : 0;
  const hi = drag ? Math.max(drag.from, drag.to) : 0;
  const span = drag ? hi - lo + 1 : 0;

  /* A selection that never travels far enough is not a selection. Discarding
     it rather than committing a one-column window is what lets a click keep
     meaning "read this column", and Enter on a lone cursor mean nothing. */
  const settle = () => {
    if (drag && span >= MIN_BRUSH) {
      onBrush({ from: points[lo].key, to: points[hi].key });
      // The series about to arrive is the selection, so the cursor belongs at
      // its start rather than at an index measured against the old one.
      setCursor(0);
    }
    setDrag(null);
  };

  const pointerHandlers = brushable ? {
    onPointerDown: (e) => {
      // Primary button only: a right-click is a context menu, and a middle
      // click is a scroll, neither of which is a drag across a chart.
      if (e.button !== 0) return;
      e.preventDefault();
      // Capture, so a drag that leaves the plot — and one that ends outside it
      // — is still this element's to finish.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const i = columnAt(e.currentTarget, e.clientX, n);
      setReading(null);
      setDrag({ from: i, to: i, via: 'pointer' });
    },
    onPointerMove: (e) => {
      if (drag?.via !== 'pointer') return;
      const i = columnAt(e.currentTarget, e.clientX, n);
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

  /* Move the cursor. A plain move drops any selection; a shifted one extends
     from wherever the selection was anchored, or opens one at the cursor it is
     leaving — which is what makes the first Shift+Arrow select two columns
     rather than one. */
  const goTo = (next, extend) => {
    const i = Math.max(0, Math.min(n - 1, next));
    setCursor(i);
    if (!extend || !brushable) { setDrag(null); return; }
    setDrag((d) => ({ from: d?.via === 'key' ? d.from : (cur ?? i), to: i, via: 'key' }));
  };

  const onKeyDown = (e) => {
    const here = cur ?? 0;
    const shift = e.shiftKey;
    switch (e.key) {
      case 'ArrowRight': goTo(here + 1, shift); break;
      case 'ArrowLeft': goTo(here - 1, shift); break;
      case 'Home': goTo(0, shift); break;
      case 'End': goTo(n - 1, shift); break;
      case 'Enter': case ' ':
        if (!drag) return;
        settle();
        break;
      case 'Escape':
        if (!drag) return;
        setDrag(null);
        /* This Escape has been spent. Insights listens on the window for an
           Escape that drops an applied window back to its preset, and letting
           this one reach it would undo the window the reader is standing in as
           well as the selection they were drawing over it. */
        e.stopPropagation();
        break;
      default: return;
    }
    // Only for keys actually handled: arrows scroll the page, Space scrolls it
    // a screenful, and both would take the chart out from under the reader.
    e.preventDefault();
  };

  /* Focus, the keys and the label that describes them, or none of it. Split
     out so the three cannot drift apart: a plot that still took focus with the
     keys switched off would be a tab stop that does nothing, and a label
     naming keys that no longer answer is worse than no label. */
  const keyHandlers = keyboard ? {
    /* A group rather than an image: its contents are the point, and a reader
       moves between them. The label carries the keys because there is nowhere
       else a reader arriving by tab would find them. */
    role: 'group',
    tabIndex: 0,
    'aria-label': `${label || 'Chart'}, ${n} columns. Arrow keys read each column`
      + `${brushable ? ', shift and arrow keys select a window, Enter applies it' : ''}.`,
    onFocus: () => { setFocused(true); if (cursor == null) setCursor(0); },
    onBlur: () => {
      setFocused(false);
      // A selection being drawn by key belongs to the focus that was drawing
      // it; a pointer's own drag is not focus's to cancel.
      setDrag((d) => (d?.via === 'key' ? null : d));
    },
    onKeyDown,
  } : {};

  /* What a screen reader is told, since everything above is a visual change to
     a set of bars. One line, recomposed as the cursor moves, so the readout a
     sighted reader gets from the tip arrives here as text. */
  const announcement = !focused || cur == null ? '' : (() => {
    const p = points[cur];
    const values = p.readout.map((r) => `${r.label} ${r.value}`).join(', ');
    const where = `${p.label}. ${values}. Column ${cur + 1} of ${n}`;
    if (!drag) return where;
    return `${where}. Selecting ${points[lo].label} to ${points[hi].label}, ${span} columns`
      + (span >= MIN_BRUSH ? '. Press Enter to apply' : '');
  })();

  return (
    <div className="ih-chart" style={{ height: `${CHART_H}px` }}>
      <Gridlines top={top} />
      <div
        className="ih-chart-plot ih-chart-plot-tall"
        data-reading={open ? 'true' : undefined}
        data-brushable={brushable ? '' : undefined}
        data-brushing={drag ? '' : undefined}
        /* A group rather than an image: its contents are the point, and a
           reader moves between them. The label carries the keys because there
           is nowhere else a reader arriving by tab would find them. */
        onMouseLeave={() => setReading(null)}
        {...pointerHandlers}
        {...keyHandlers}
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
              ref={at === i ? colRef : null}
              data-on={at === i ? '' : undefined}
              // The keyboard's position, marked separately from the readout:
              // the tip says what the column holds, this says where you are.
              data-cursor={focused && cur === i ? '' : undefined}
              data-in={drag && i >= lo && i <= hi ? '' : undefined}
              onMouseEnter={() => {
                // A selection being drawn owns the columns until it is done.
                if (drag) return;
                setReading(i);
                // One cursor between the two inputs, so a reader who tabs in
                // and then reaches for the mouse does not leave a second
                // marker behind on the column they started from.
                if (focused) setCursor(i);
              }}
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
      {/* Off-screen and polite: the cursor moves on a key press the reader
          made, so it interrupts nothing they did not ask for. */}
      <span className="ih-sr" role="status" aria-live="polite">{announcement}</span>
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
