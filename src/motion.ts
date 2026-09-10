/* ==========================================================================
   motion.ts — the homepage's own micro-animations, ported.

   These are the prototype's, not Kumo's: Kumo animates its own components
   (the sidebar, dropdowns, dialogs, tabs) and this file never touches those.
   What is here is the motion Kumo has no equivalent of — a figure counting to
   a new window, a sparkline growing out of its baseline, a whole series being
   swapped, a readout opening beside the column it belongs to.

   Every one of them works the same way it did before: by marking freshly
   rendered nodes. React replaces those nodes wholesale on a repaint, so a
   CSS `transition` has no previous value to run from and never fires —
   setting the attribute is itself what starts the animation.
   ========================================================================== */

const REDUCED_MOTION = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : ({ matches: false } as MediaQueryList);

/**
 * Tween `node`'s text from `from` to `to`, rendering each frame through
 * `format`. Reduced motion writes the final value and stops.
 *
 * Only ever driven by a deliberate change of window — never a keystroke,
 * which would leave the figures permanently in flight.
 */
export function countUp(
  node: HTMLElement | null,
  from: number,
  to: number,
  format: (v: number) => string,
  duration = 260,
) {
  if (!node) return;
  if (REDUCED_MOTION.matches || from === to) { node.textContent = format(to); return; }
  const started = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / duration);
    // Cubic ease-out: fast off the mark, settling onto the real figure rather
    // than arriving at it abruptly.
    const eased = 1 - (1 - t) ** 3;
    node.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Grow every plot in `host` from its own baseline, one column behind the last.
 *
 * Each column gets its position `--i` and the plot gets `--n`, the number of
 * gaps between its columns. The stylesheet divides one by the other, so the
 * wipe crosses the series in a fixed time no matter how many columns it has —
 * a flat per-column gap makes the gesture as long as the data is, so the same
 * animation reads as a wipe at 24 columns and a simultaneous pop at 7.
 *
 * `--n` is floored at 1: a single-column plot has no gaps to divide by, and
 * dividing by zero would invalidate the whole declaration.
 */
export function growPlots(host: HTMLElement | null) {
  if (!host || REDUCED_MOTION.matches) return;
  host.querySelectorAll<HTMLElement>('.ih-plot').forEach((plot) => {
    const cols = Array.from(plot.children) as HTMLElement[];
    cols.forEach((col, i) => col.style.setProperty('--i', String(i)));
    plot.style.setProperty('--n', String(Math.max(1, cols.length - 1)));
    plot.dataset.swap = 'in';
  });
}

/** Matches --motion-fast: how long the old series takes to leave. */
export const SWAP_OUT = 120;

/**
 * Fade every plot in `host` out, resolving when they have gone. Reduced
 * motion resolves immediately and skips the fade, so the caller's repaint
 * still happens on the same code path.
 */
export function swapOut(host: HTMLElement | null): Promise<void> {
  if (!host || REDUCED_MOTION.matches) return Promise.resolve();
  const marks = Array.from(host.querySelectorAll<HTMLElement>('.ih-plot'));
  if (marks.length === 0) return Promise.resolve();
  marks.forEach((node) => { node.dataset.swap = 'out'; });
  return new Promise((done) => { setTimeout(done, SWAP_OUT); });
}

/* ==========================================================================
   Placing a chart's readout

   Opened against the hovered column rather than the pointer, and on whichever
   side of the plot leaves that column visible. Held off the page's edge, the
   tip can be pushed back onto the very column it belongs to — the rightmost
   card's left half is narrow enough for it — so the other side is tried
   before that is allowed to stand.
   ========================================================================== */

const TIP_GAP = 10;
const EDGE = 8;

export function placeChartTip(
  tip: HTMLElement,
  col: HTMLElement,
  plot: HTMLElement,
  frame: HTMLElement,
) {
  const frameBox = frame.getBoundingClientRect();
  const plotBox = plot.getBoundingClientRect();
  const colBox = col.getBoundingClientRect();
  const width = tip.offsetWidth;

  const toRight = colBox.left + colBox.width / 2 < plotBox.left + plotBox.width / 2;
  const beside = (right: boolean) =>
    (right ? colBox.right + TIP_GAP : colBox.left - TIP_GAP - width);
  const held = (x: number) => Math.min(Math.max(x, EDGE), innerWidth - width - EDGE);
  const clears = (x: number) => x >= colBox.right || x + width <= colBox.left;

  let x = held(beside(toRight));
  if (!clears(x)) {
    const other = held(beside(!toRight));
    if (clears(other)) x = other;
  }

  // Fixed to the top of the plot rather than to each column's ink: aligning
  // to the ink would make the readout bob up and down as the reader scanned
  // across, for no information gained.
  tip.style.left = `${x - frameBox.left}px`;
  tip.style.top = `${plotBox.top - frameBox.top}px`;
}

/* ==========================================================================
   Lazy sections

   A section already seen this session is one a real client would have cached,
   and one with no data has nothing to fetch. One timer for the whole app:
   moving away mid-load must not leave the abandoned section to paint itself
   over the one the reader is now looking at.
   ========================================================================== */

const LAZY_MIN = 420;
const LAZY_MAX = 760;
const loaded = new Set<string>();

export function hasLoaded(key: string) { return loaded.has(key); }

/** Resolves once the section's data should be treated as arrived. */
export function lazyLoad(key: string, onArrive: () => void): () => void {
  if (loaded.has(key)) { onArrive(); return () => {}; }
  const timer = setTimeout(() => {
    loaded.add(key);
    onArrive();
  }, LAZY_MIN + Math.random() * (LAZY_MAX - LAZY_MIN));
  return () => clearTimeout(timer);
}
