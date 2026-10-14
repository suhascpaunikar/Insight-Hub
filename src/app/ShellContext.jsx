/* ==========================================================================
   ShellContext.jsx — the parts of the chrome a page talks to.

   The contract is the vanilla build's: a page *describes* its breadcrumb, its
   tab strip and its stat strip, and the shell owns the bands they sit in. The
   reason is unchanged too — the shell repaints for reasons the page knows
   nothing about (a workspace switch, the rail collapsing), and it has to be
   able to put the chrome back without waiting for the page to paint again.

   What changed is the direction of the plumbing. chrome.js reached into the
   DOM and rewrote `.tabstrip`'s innerHTML; here a page calls a hook, the
   shell re-renders, and React reconciles.
   ========================================================================== */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ShellContext = createContext(null);

export function ShellStateProvider({ children }) {
  const [crumbs, setCrumbs] = useState(null);
  const [tabs, setTabs] = useState(null);
  const [strip, setStrip] = useState(null);
  const value = useMemo(
    () => ({ crumbs, setCrumbs, tabs, setTabs, strip, setStrip }),
    [crumbs, tabs, strip],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export const useShell = () => useContext(ShellContext);

/**
 * [{ label, href?, icon? }] → the bar's breadcrumb. The last entry is the page
 * and is never a link; a product icon leads the first.
 *
 * `deps` is the caller's, because the list is almost always rebuilt inline and
 * an array literal is a new identity every render.
 */
export function useCrumbs(list, deps = []) {
  const { setCrumbs } = useShell();
  useEffect(() => {
    setCrumbs(list);
    return () => setCrumbs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * { items: [{ key, label, badge?, glyph?, disabled? }], active, onSelect(key), label? }
 * — or null for no strip. `disabled` is a wizard step not yet reachable.
 */
export function useTabs(spec, deps = []) {
  const { setTabs } = useShell();
  useEffect(() => {
    setTabs(spec && spec.items && spec.items.length ? spec : null);
    return () => setTabs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * { key?, items: [{ label, value, hint?, mono?, glyph? }], actions?, onAction(key) }
 *
 * `key` names what the strip is describing, so a repaint can be told from an
 * arrival: the strip is set on every paint — including the skeleton's, so it
 * does not blink while a panel loads — and only a change of subject animates.
 */
export function useStrip(spec, deps = []) {
  const { setStrip } = useShell();
  useEffect(() => {
    setStrip(spec && spec.items && spec.items.length ? spec : null);
    return () => setStrip(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
