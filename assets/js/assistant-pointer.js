/* ==========================================================================
   assistant-pointer.js — the cursor companion.

   Clicky's blue cursor flies to whatever the model names. This one walks with
   you instead: it trails your real pointer, and resting it on a panel for a
   beat asks that panel what its numbers say. You lead, it reads.

   The dwell is what makes hovering safe. Sweeping across a dense page passes
   over several panels, and firing on every one of them would be noise, so a
   panel only speaks once the pointer has settled on it — with a ring closing
   around the buddy to show the wait is deliberate rather than a hang.
   ========================================================================== */
import { icon } from './core.js';

const DWELL_MS = 600;
/* Fraction of the remaining distance closed each frame. Low enough that the
   buddy visibly follows rather than sticking to the cursor. */
const FOLLOW = 0.18;

let buddy = null;
let frame = null;
let dwellTimer = null;
let onFire = null;
let active = false;
let armedPanel = null;          // the panel currently under the pointer
let firedPanel = null;          // already spoken for; re-entry re-arms it
const cursor = { x: 0, y: 0 };
const trail = { x: 0, y: 0 };

const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function build() {
  if (buddy) return buddy;
  buddy = document.createElement('div');
  buddy.className = 'asst-pointer';
  buddy.setAttribute('aria-hidden', 'true');
  buddy.innerHTML = `
    <svg class="asst-pointer-ring" viewBox="0 0 40 40" aria-hidden="true">
      <circle class="asst-pointer-track" cx="20" cy="20" r="17" />
      <circle class="asst-pointer-progress" cx="20" cy="20" r="17" />
    </svg>
    <span class="asst-pointer-mark">${icon('bot')}</span>`;
  document.body.appendChild(buddy);
  return buddy;
}

/** Ease the buddy toward the real cursor, one frame at a time. */
function step() {
  if (!active) return;
  trail.x += (cursor.x - trail.x) * FOLLOW;
  trail.y += (cursor.y - trail.y) * FOLLOW;
  buddy.style.transform = `translate3d(${Math.round(trail.x)}px, ${Math.round(trail.y)}px, 0)`;
  frame = requestAnimationFrame(step);
}

function trackCursor(event) {
  cursor.x = event.clientX;
  cursor.y = event.clientY;
  if (reducedMotion()) {
    trail.x = cursor.x;
    trail.y = cursor.y;
  }
}

function clearDwell() {
  if (dwellTimer) clearTimeout(dwellTimer);
  dwellTimer = null;
  if (buddy) buddy.dataset.dwelling = 'false';
}

function leavePanel() {
  clearDwell();
  if (armedPanel) armedPanel.removeAttribute('data-insight-armed');
  armedPanel = null;
  firedPanel = null;
}

function enterPanel(panel) {
  if (panel === armedPanel) return;
  leavePanel();
  armedPanel = panel;
  panel.setAttribute('data-insight-armed', '');

  // Restart the ring animation: re-adding the attribute alone will not replay it.
  buddy.dataset.dwelling = 'false';
  void buddy.offsetWidth;
  buddy.dataset.dwelling = 'true';

  dwellTimer = setTimeout(() => {
    clearDwell();
    if (firedPanel === panel) return;
    firedPanel = panel;
    if (onFire) onFire(panel.dataset.insight);
  }, DWELL_MS);
}

function handleMove(event) {
  trackCursor(event);
  if (!active) return;
  const panel = event.target.closest && event.target.closest('[data-insight]');
  // The card is a surface of its own, never a panel to be read.
  const inCard = event.target.closest && event.target.closest('.asst');
  if (panel && !inCard) enterPanel(panel);
  else leavePanel();
}

/* A pointer device that cannot hover has no dwell, so a tap stands in for it. */
function handleTap(event) {
  if (!active) return;
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) return;
  const panel = event.target.closest && event.target.closest('[data-insight]');
  if (!panel || event.target.closest('.asst')) return;
  event.preventDefault();
  event.stopPropagation();
  if (onFire) onFire(panel.dataset.insight);
}

/** Turn the companion on or off. `fire` receives the panel key on dwell. */
export function setPointer(on, fire) {
  onFire = fire || onFire;
  if (on === active) return;
  active = on;
  document.body.dataset.asstPointer = String(on);

  if (on) {
    build();
    trail.x = cursor.x;
    trail.y = cursor.y;
    buddy.dataset.visible = 'true';
    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('click', handleTap, true);
    frame = requestAnimationFrame(step);
  } else {
    leavePanel();
    document.removeEventListener('mousemove', handleMove, true);
    document.removeEventListener('click', handleTap, true);
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    if (buddy) buddy.dataset.visible = 'false';
  }
}

export const pointerActive = () => active;
