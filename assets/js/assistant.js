/* ==========================================================================
   assistant.js — the companion card (FR-91 surface).

   Clicky's interaction model, ported to the browser: a small buddy docked at
   the edge of the screen that speaks first about what it can see, streams its
   answer a word at a time, and offers the next question rather than waiting
   for one. What it does not port is the perception layer — see
   assistant-context.js for why there is nothing to photograph here.

   The card is a fixed 320×240 box. The answer region scrolls internally and
   follows the caret; the follow-ups stay pinned to the bottom edge, so the
   footprint never changes as an answer grows.

   It mounts on document.body rather than #app, because renderShell() replaces
   #app.innerHTML on every rerender — the same reason toastHost() lives there.
   ========================================================================== */
import { html, raw, icon, $, on } from './core.js';
import { snapshot } from './assistant-context.js';
import { answer } from './assistant-answers.js';

/* Cadence borrowed from the reference component: slow enough to read along
   with, fast enough that a four-line answer lands in about three seconds. */
const WORD_MS = 80;
const FOLLOW_UP_STAGGER_MS = 90;

/* The reply-arrow that marks a follow-up. Not in the shared icon set. */
const REPLY_ARROW = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9 10l-5 5 5 5" /><path d="M20 4v7a4 4 0 0 1-4 4H4" /></svg>`;

let rootElement = null;
let wordTimer = null;
let streamState = null;

const bodyElement = () => $('[data-asst-body]', rootElement);
const textElement = () => $('[data-asst-text]', rootElement);
const followElement = () => $('[data-asst-follow]', rootElement);

/**
 * A fixed-height box always risks cutting a line in half. Fading the edge the
 * content actually runs past turns that cut into a legible "there is more this
 * way" instead of something that looks broken.
 */
function updateScrollHints() {
  const body = bodyElement();
  if (!body) return;
  const room = body.scrollHeight - body.clientHeight;
  body.dataset.fadeTop = String(room > 1 && body.scrollTop > 1);
  body.dataset.fadeBottom = String(room > 1 && body.scrollTop < room - 1);
}

/* ---------- Streaming ---------- */

function stopStreaming() {
  if (wordTimer) clearInterval(wordTimer);
  wordTimer = null;
}

/** Reveal the remaining words at once, then settle into the finished state. */
function finishStream() {
  if (!streamState) return;
  stopStreaming();
  const { words, caret } = streamState;
  const target = textElement();
  while (streamState.index < words.length) {
    target.insertBefore(buildWord(words[streamState.index]), caret);
    streamState.index += 1;
  }
  caret.remove();
  renderFollowUps(streamState.followUps);
  // The caret is chased to the bottom while streaming so the newest word stays
  // in view, which leaves a finished answer parked at its end with the opening
  // line half-cut. Settle back to the top so it can be read from the start.
  bodyElement().scrollTo({ top: 0, behavior: 'smooth' });
  updateScrollHints();
  streamState = null;
}

function buildWord(word) {
  const span = document.createElement('span');
  span.className = 'asst-word';
  span.textContent = `${word} `;
  return span;
}

function streamAnswer({ text, followUps }) {
  stopStreaming();
  const target = textElement();
  target.innerHTML = '';
  followElement().innerHTML = '';

  const caret = document.createElement('span');
  caret.className = 'asst-caret';
  target.appendChild(caret);

  streamState = { words: text.split(/\s+/).filter(Boolean), index: 0, caret, followUps };

  wordTimer = setInterval(() => {
    if (!streamState || streamState.index >= streamState.words.length) {
      finishStream();
      return;
    }
    target.insertBefore(buildWord(streamState.words[streamState.index]), caret);
    streamState.index += 1;
    // Keep the caret in view without fighting a user who has scrolled up.
    const body = bodyElement();
    body.scrollTop = body.scrollHeight;
    updateScrollHints();
  }, WORD_MS);
}

function renderFollowUps(followUps) {
  followElement().innerHTML = html`
    <p class="asst-follow-label">Follow-ups</p>
    ${followUps.map((item, i) => html`
      <button class="asst-follow-btn" data-act="asst-ask" data-intent="${item.id}"
              style="animation-delay:${i * FOLLOW_UP_STAGGER_MS}ms">
        ${raw(REPLY_ARROW)}
        <span class="truncate">${item.label}</span>
      </button>`)}`;
}

/* ---------- Public API ---------- */

/** Ask the assistant an intent and stream the reply. */
export function ask(intentId = 'overview') {
  if (!rootElement) return;
  streamAnswer(answer(intentId, snapshot()));
}

export function openAssistant(intentId = 'overview') {
  if (!rootElement) mountAssistant();
  rootElement.dataset.open = 'true';
  ask(intentId);
}

export function closeAssistant() {
  if (!rootElement) return;
  stopStreaming();
  streamState = null;
  rootElement.dataset.open = 'false';
}

/**
 * Create the card once per page. Safe to call on every shell rerender —
 * a second call is a no-op.
 */
export function mountAssistant() {
  if (rootElement && document.body.contains(rootElement)) return rootElement;

  rootElement = document.createElement('div');
  rootElement.className = 'asst';
  rootElement.dataset.open = 'false';
  rootElement.innerHTML = html`
    <section class="asst-card" role="dialog" aria-label="InsightHub assistant">
      <header class="asst-head">
        ${raw(icon('sparkles', 'asst-head-icon'))}
        <span class="asst-head-title grow">Assistant</span>
        <span class="badge badge-ai badge-mono">BETA</span>
        <button class="asst-icon-btn" data-act="asst-close" aria-label="Close assistant">
          ${raw(icon('x'))}
        </button>
      </header>
      <div class="asst-body" data-asst-body>
        <p class="asst-text" data-asst-text></p>
      </div>
      <div class="asst-follow" data-asst-follow></div>
    </section>
    <button class="asst-bubble" data-act="asst-toggle" aria-label="Open assistant">
      ${raw(icon('bot'))}
    </button>`;
  document.body.appendChild(rootElement);

  on(rootElement, 'click', '[data-act="asst-toggle"]', () => {
    if (rootElement.dataset.open === 'true') closeAssistant();
    else openAssistant();
  });
  on(rootElement, 'click', '[data-act="asst-close"]', closeAssistant);
  on(rootElement, 'click', '[data-act="asst-ask"]', (event, button) => ask(button.dataset.intent));

  // Clicking the answer while it streams skips to the end, as impatient
  // readers expect of any typewriter reveal.
  on(rootElement, 'click', '[data-asst-body]', () => { if (streamState) finishStream(); });
  bodyElement().addEventListener('scroll', updateScrollHints, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && rootElement.dataset.open === 'true') closeAssistant();
    // Ctrl + / — the browser equivalent of clicky's global push-to-talk key.
    if (event.key === '/' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (rootElement.dataset.open === 'true') closeAssistant();
      else openAssistant();
    }
  });

  return rootElement;
}
