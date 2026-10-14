/* ==========================================================================
   assistant-pointer.js — the cursor companion.

   Clicky's blue cursor flies to whatever the model names. This one walks with
   you instead: it trails your real pointer, and resting it on a panel for a
   beat asks that panel what its numbers say. You lead, it reads.

   The dwell is what makes hovering safe. Sweeping across a dense page passes
   over several panels, and firing on every one of them would be noise, so a
   panel only speaks once the pointer has settled on it — with a ring closing
   around the buddy to show the wait is deliberate rather than a hang.

   The buddy wears the same orb as the card, and the dwell is the other half
   of the assistant's thinking: the ring says how long is left, and the orb
   says the wait is being spent on something. Both end together — the dwell
   fires into an answer, and the answer holds the orb awake from there.
   ========================================================================== */
import { mountOrb, orbThinking } from './assistant-orb.js';

const DWELL_MS = 600;
/* The assistant's own surface — the card, the launcher and this companion.
   None of it is a panel with numbers to read. */
const CARD = '.ih-asst, .asst-pointer';
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
    <span class="asst-pointer-mark"></span>`;
  document.body.appendChild(buddy);
  mountOrb(buddy.querySelector('.asst-pointer-mark'), { size: 22 });
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

/**
 * Show or hide the companion, which is how it keeps off the assistant's own
 * surface.
 *
 * The card and the launcher wear this same orb, so a buddy trailing across
 * them parks beside one and the assistant reads as drawn twice — and it was
 * always the header it landed on, because that is the corner the cursor
 * arrives from. Sliding under the card instead was the original intent
 * (z-index 79 against the card's 80) and it no longer happens: Kumo's sidebar
 * wrapper carries `isolation: isolate`, so the card's z-index is spent inside
 * that wrapper and never compares with this one at the top level. Hiding it
 * outright is the better answer anyway — the card is not a panel, there is
 * nothing here for the companion to read, and a buddy that vanished under an
 * opaque card would only be lost rather than put away.
 *
 * It keeps trailing while hidden, so leaving the card fades it back in where
 * the cursor actually is.
 */
function showBuddy(on) {
  if (buddy) buddy.dataset.visible = String(on);
}

function clearDwell() {
  if (dwellTimer) clearTimeout(dwellTimer);
  dwellTimer = null;
  orbThinking('dwell', false);
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
  orbThinking('dwell', true);

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
  // The card is a surface of its own, never a panel to be read. It is also
  // what the answer opens into, so it lands under the cursor mid-reading: with
  // this selector wrong, every crossing of its edge counted as leaving the
  // panel behind it, and coming back re-armed the dwell and read it again.
  // That is the three and four copies of one answer.
  const inCard = event.target.closest && event.target.closest(CARD);
  showBuddy(!inCard);
  if (panel && !inCard) enterPanel(panel);
  else leavePanel();
}

/* A pointer device that cannot hover has no dwell, so a tap stands in for it. */
function handleTap(event) {
  if (!active) return;
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) return;
  const panel = event.target.closest && event.target.closest('[data-insight]');
  if (!panel || event.target.closest(CARD)) return;
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
    // Armed from the target button in the card's own header, so the cursor is
    // over the card as often as not: read where it is rather than showing the
    // buddy there and hiding it again on the first move.
    showBuddy(!document.elementFromPoint(cursor.x, cursor.y)?.closest(CARD));
    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('click', handleTap, true);
    frame = requestAnimationFrame(step);
  } else {
    leavePanel();
    document.removeEventListener('mousemove', handleMove, true);
    document.removeEventListener('click', handleTap, true);
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    showBuddy(false);
  }
}

export const pointerActive = () => active;
