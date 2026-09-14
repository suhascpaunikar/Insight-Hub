/* ==========================================================================
   useStore.js — the store, as React sees it.

   The store is a plain mutable singleton and stays that way: every rule about
   drafts, variant reconciliation and validation lives in store.js and none of
   it needed to know about React. This is the whole adapter.
   ========================================================================== */
import { useSyncExternalStore, useEffect, useState } from 'react';
import { store } from './store.js';
import { applyTheme, readPalette } from './palette.js';

const subscribe = (fn) => store.subscribe(fn);
const snapshot = () => store.getVersion();

/**
 * Re-render this component whenever anything in the store is saved.
 *
 * Deliberately coarse. The console's screens each read a wide slice of state —
 * the dashboard wants campaigns *and* settings *and* the open draft — so a
 * per-key selector would buy nothing but a longer dependency list.
 */
export function useStore() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return store;
}

/**
 * The theme, and the palette that has to be re-read behind it.
 *
 * `applyTheme` writes `data-mode` on <html>; the inline script in each
 * document's <head> has already done that before first paint, so the effect
 * below is for the switch, not the boot.
 */
export function useTheme() {
  const store_ = useStore();
  const theme = store_.state.theme === 'light' ? 'light' : 'dark';
  useEffect(() => { applyTheme(theme); }, [theme]);
  return [theme, (next) => store_.set({ theme: next === 'light' ? 'light' : 'dark' })];
}

/**
 * Resolve the rating ramp once the stylesheet has applied.
 *
 * `ratingColor()` bakes literal `rgb()` into markup, so anything drawing the
 * ramp has to repaint when the palette changes. Returning a counter gives
 * callers something to put in a dependency array.
 */
export function usePalette() {
  const [generation, setGeneration] = useState(0);
  const store_ = useStore();
  const theme = store_.state.theme;
  useEffect(() => {
    readPalette();
    setGeneration((n) => n + 1);
  }, [theme]);
  return generation;
}
