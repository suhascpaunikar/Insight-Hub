/* ==========================================================================
   Orb.jsx — a React handle on the Siri-style orb.

   The orb itself (lib/assistant-orb.js) is 500 lines of imperative canvas
   work: a shader-ish gradient field with two states, idle and thinking, and
   its own animation loop. None of that is React's business, and rewriting it
   as React would be a straight loss — so this component does the one thing
   React is for here: hand it a node, and take it back on unmount.
   ========================================================================== */
import { useEffect, useRef } from 'react';
import { mountOrb } from '../lib/assistant-orb.js';

export function Orb({ size = 44, className }) {
  const host = useRef(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    const orb = mountOrb(node, { size });
    return () => { orb?.destroy?.(); node.replaceChildren(); };
  }, [size]);
  return <span className={className} ref={host} aria-hidden="true" />;
}
