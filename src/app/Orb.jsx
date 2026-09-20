/* ==========================================================================
   Orb.jsx — a React handle on the Siri-style orb.

   The orb itself (lib/assistant-orb.js) is 500 lines of imperative canvas
   work: a shader-ish gradient field with two states, idle and thinking, and
   its own animation loop. None of that is React's business, and rewriting it
   as React would be a straight loss — so this module does the one thing React
   is for here: hand it a node, and take it back on unmount.

   Two shapes, because the assistant needs both. `Orb` brings its own span,
   which is what the card's header wants. `useOrb` mounts into a node that
   already exists, which is what the launcher wants: the orb module writes
   `data-orb-state` onto whatever it is given, and the launcher's lit ring is
   a rule on that attribute — so the button has to be the host itself, not the
   parent of one.
   ========================================================================== */
import { useEffect, useRef } from 'react';
import { mountOrb } from '../lib/assistant-orb.js';

export function useOrb(hostRef, size = 44) {
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;
    const orb = mountOrb(node, { size });
    return () => { orb?.destroy?.(); node.replaceChildren(); };
  }, [hostRef, size]);
}

export function Orb({ size = 44, className }) {
  const host = useRef(null);
  useOrb(host, size);
  return <span className={className} ref={host} aria-hidden="true" />;
}
