/* ==========================================================================
   ChartTip.jsx — the floating readout both plots open on a hovered column.

   The charts are the product's own CSS (§11.4 defers `Chart` to ECharts, and
   these are stacked divs), and the readout came with them: a dot per series,
   the series name, its value, and the column's date under a rule.

   What it adds over the markup it replaces is where it lands. Both plots used
   to anchor it at a percentage across their own width — 0% for the first
   column, 100% for the last — and centre it there, which puts half of a 168px
   readout outside the card at either end. `.ih-scroll` hides horizontal
   overflow, so that half is cut off, and the reader loses the labels for the
   very column they asked about.

   So the tip measures instead: centre on the column, then stop at the edges
   of the box it is positioned in. Near the ends it pins flush to an edge and
   the series stay whole, which is the whole point of opening it.
   ========================================================================== */
import { useLayoutEffect, useRef } from 'react';

/**
 * `anchorRef` holds the column being read. The box the tip is kept inside is
 * its own offset parent — `.ih-metric-plot` on a card, `.ih-chart` in the
 * insights plot — because that is the box its `left` resolves against.
 *
 * Measured rather than computed from the column's index: the readout is as
 * wide as its content, and the insights plot is inset by a gutter that a
 * percentage across the box knows nothing about. Reading the two boxes is
 * what makes one component fit both plots.
 */
export function ChartTip({ anchorRef, readout, label, inline }) {
  const ref = useRef(null);

  // In a layout effect, so the position is settled before the frame is
  // painted and the tip never appears at the wrong end first. No dependency
  // list: the tip only renders when the reading changes, and every one of
  // those renders is a new column to measure against.
  useLayoutEffect(() => {
    const tip = ref.current;
    const box = tip?.offsetParent;
    const anchor = anchorRef.current;
    if (!tip || !box || !anchor) return;
    // `left` is measured from the box's padding edge; `clientLeft` is the
    // border the two rects otherwise disagree about.
    const origin = box.getBoundingClientRect().left + box.clientLeft;
    const column = anchor.getBoundingClientRect();
    const centred = column.left + column.width / 2 - origin - tip.offsetWidth / 2;
    const room = box.clientWidth - tip.offsetWidth;
    tip.style.left = `${Math.round(Math.min(Math.max(centred, 0), Math.max(room, 0)))}px`;
  });

  return (
    <div ref={ref} className={`ih-chart-tip${inline ? ' ih-chart-tip-inline' : ''}`} data-open="true">
      {readout.map((r) => (
        <div className="ih-chart-tip-row" key={r.label}>
          <i style={{ background: r.fill, opacity: r.opacity }} />
          <span>{r.label}</span><b>{r.value}</b>
        </div>
      ))}
      <div className="ih-chart-tip-foot">{label}</div>
    </div>
  );
}
