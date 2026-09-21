/* ==========================================================================
   useCountUp.js — a figure that tweens to its new value.

   §12's `countUp`, which the vanilla build had in `core.js` and the port did
   not carry across. The rule it came with still holds and is the whole reason
   this is a hook rather than a CSS transition: **a figure counts only when a
   deliberate change moves it, never on a keystroke.** A number permanently in
   flight under a typing reader is worse than one that simply changes.

   So the caller decides what is deliberate by choosing what to pass. Every
   figure this drives today is moved by a click — a segment ticked, a list
   excluded, a CSV chosen — and none of them by a key.

   The first value is not a change. A figure arriving with its page has nothing
   to count from, and §12 says a first paint marks nothing.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { count as countFormat } from './format.js';

/* `--motion-base`: the figure is changing, not redrawing a whole series, and
   §12 reserves `--motion-slow` for the latter and nothing else. */
const DURATION = 180;

/* The system's one curve is cubic-bezier(0.22, 0.61, 0.36, 1). Only y at t is
   wanted and a cubic ease-out tracks it closely enough over 180ms that the
   difference is below one rendered digit. */
const ease = (t) => 1 - (1 - t) ** 3;

const stillness = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Returns the formatted figure to render — tweened when `value` moves. */
export function useCountUp(value, format = countFormat) {
  const [shown, setShown] = useState(value);
  // What is on screen, so an interrupted tween restarts from where the eye is
  // rather than snapping back to where the last one began.
  const onScreen = useRef(value);
  const settled = useRef(false);

  useEffect(() => {
    const land = () => { onScreen.current = value; setShown(value); };
    if (!settled.current) { settled.current = true; land(); return undefined; }

    const from = onScreen.current;
    if (from === value || stillness()) { land(); return undefined; }

    let frame;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const next = Math.round(from + (value - from) * ease(t));
      onScreen.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return format(shown);
}
