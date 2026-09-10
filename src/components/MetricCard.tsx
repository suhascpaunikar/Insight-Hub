/* ==========================================================================
   MetricCard.tsx — one figure, the series that qualifies it, and the shape
   over the window with the window's own bounds underneath.

   The card is Kumo's `Surface`; the sparkline inside it is ours, because
   Kumo's chart components are ECharts and a 24-column sparkline that has to
   grow one column behind the last is a stylesheet job, not a charting one.
   The hover readout is the prototype's: the column under the pointer holds
   its ink, its neighbours step back to .38, and the card's own figures for
   that day open beside it — never under it, and never at the pointer.
   ========================================================================== */
import { useRef } from 'react';
import { Surface } from '@cloudflare/kumo';
import { placeChartTip } from '../motion';
import { count, type DayRow } from '../legacy';

export interface Series {
  label: string;
  of: (row: DayRow) => number;
  read?: (row: DayRow) => string;
  fill: string | ((row: DayRow) => string);
  opacity?: string;
}

interface Props {
  name: string;
  legend?: { label: string; tone: string }[];
  value: { text: string; color?: string };
  subs?: string[];
  rows: DayRow[];
  series: Series[];
  axis: [string, string];
  /** A rate is not read against zero — scale it against the window's own low. */
  band?: boolean;
  /** The key the headline tweens on, so a range change can count it up. */
  figure?: string;
  figureValue?: number;
}

const PLOT_HEIGHT = 40;

export function MetricCard({
  name, legend = [], value, subs = [], rows, series, axis, band, figure, figureValue,
}: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLElement | null>(null);

  const total = (row: DayRow) => series.reduce((t, s) => t + s.of(row), 0);
  // A count is read against zero. A rate is not: completion moving 44% → 54%
  // is the whole story, and drawing it from zero flattens it into a wall of
  // equal bars. `band` scales those against the window's own low and high, and
  // the axis prints that low and high so the zoom is stated, not hidden.
  const values = rows.map(total);
  const floor = band ? Math.min(...values) * 0.985 : 0;
  const peak = Math.max(...values);
  const span = peak - floor || 1;

  const fillOf = (s: Series, row: DayRow) =>
    (typeof s.fill === 'function' ? s.fill(row) : s.fill);

  const clear = () => {
    const reading = readingRef.current;
    if (!reading) return;
    reading.removeAttribute('data-on');
    readingRef.current = null;
    plotRef.current?.removeAttribute('data-reading');
    if (tipRef.current) tipRef.current.dataset.open = 'false';
  };

  /* mousemove rather than mouseenter per column: the columns are 3px apart and
     entering each one separately makes the readout flicker across the gaps. */
  const onMove = (event: React.MouseEvent) => {
    const col = (event.target as HTMLElement).closest<HTMLElement>('.ih-col');
    const plot = plotRef.current;
    const tip = tipRef.current;
    const frame = frameRef.current;
    if (!col || !plot || !tip || !frame) { clear(); return; }
    // Nothing below runs unless the column changed. The readout is placed
    // against the column rather than the pointer, so a pointer still
    // travelling across the same bar has nothing left to say.
    if (col === readingRef.current) return;

    readingRef.current?.removeAttribute('data-on');
    col.setAttribute('data-on', '');
    plot.dataset.reading = 'true';
    readingRef.current = col;

    const index = Number(col.dataset.index);
    const row = rows[index];
    tip.innerHTML = [
      ...series.map((s) => `
        <div class="flex items-center gap-3">
          <i class="size-2 shrink-0 rounded-full" style="background:${fillOf(s, row)};opacity:${s.opacity || '1'}"></i>
          <span class="flex-1 text-xs text-kumo-subtle">${s.label}</span>
          <b class="text-xs font-normal tabular-nums text-kumo-default">${
            s.read ? s.read(row) : count(Math.round(s.of(row)))
          }</b>
        </div>`),
      `<div class="mt-2 border-t border-kumo-line pt-1.5 text-[11.5px] text-kumo-subtle">${row.label}</div>`,
    ].join('');
    placeChartTip(tip, col, plot, frame);
    tip.dataset.open = 'true';
  };

  return (
    <Surface className="relative flex min-w-0 flex-col gap-2.5 p-3.5" ref={frameRef}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-kumo-subtle">{name}</span>
        <span className="flex shrink-0 items-center gap-2.5">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-kumo-subtle">
              <i className="size-1.5 rounded-full" style={{ background: l.tone }} />
              {l.label}
            </span>
          ))}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="text-[22px] leading-none font-medium tabular-nums"
          style={value.color ? { color: value.color } : undefined}
          {...(figure ? { 'data-figure': figure, 'data-value': String(figureValue ?? 0) } : {})}
        >
          {value.text}
        </span>
        <span className="flex gap-2 text-xs text-kumo-subtle">
          {subs.map((sub) => <b key={sub} className="font-normal tabular-nums">{sub}</b>)}
        </span>
      </div>

      <div>
        <div
          ref={plotRef}
          className="ih-plot"
          style={{ height: PLOT_HEIGHT }}
          aria-hidden
          onMouseMove={onMove}
          onMouseLeave={clear}
        >
          {rows.map((row, i) => (
            <span key={i} className="ih-col" data-index={i}>
              {/* Stacked top-down, so the qualifying series sits above the base
                  it came out of. */}
              {[...series].reverse().map((s, j) => {
                // Only the base segment carries the floor; the ones stacked on
                // it are already measured from where it ends.
                const isBase = j === series.length - 1;
                const raised = isBase ? s.of(row) - floor : s.of(row);
                const height = Math.max(0, (raised / span) * PLOT_HEIGHT);
                return (
                  <span
                    key={j}
                    className="ih-seg"
                    style={{
                      height: `${height.toFixed(1)}px`,
                      background: fillOf(s, row),
                      opacity: s.opacity,
                    }}
                  />
                );
              })}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10.5px] text-kumo-inactive">
          <span>{axis[0]}</span><span>{axis[1]}</span>
        </div>
      </div>

      <div ref={tipRef} className="ih-tip" data-open="false" />
    </Surface>
  );
}
