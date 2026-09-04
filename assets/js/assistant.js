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

   The face of it is the orb (assistant-orb.js), and this file is what decides
   which of its two states it is in. Composing an answer is the whole of the
   assistant's work, so streaming is exactly when it thinks — the orb wakes on
   the first word and settles on the last, which makes the card's own latency
   legible instead of leaving a still icon over moving text.
   ========================================================================== */
import { html, raw, icon, $, on } from './core.js';
import { snapshot } from './assistant-context.js';
import { answer, intentLabel, route } from './assistant-answers.js';
import { insight } from './assistant-insights.js';
import { campaignKind } from './data.js';
import { setPointer, pointerActive } from './assistant-pointer.js';
import { mountOrb, orbThinking } from './assistant-orb.js';

/* Cadence borrowed from the reference component: slow enough to read along
   with, fast enough that a four-line answer lands in about three seconds. */
const WORD_MS = 80;
const FOLLOW_UP_STAGGER_MS = 90;

/* The reply-arrow that marks a follow-up. Not in the shared icon set. */
const REPLY_ARROW = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9 10l-5 5 5 5" /><path d="M20 4v7a4 4 0 0 1-4 4H4" /></svg>`;

/* The send glyph. Not in the shared icon set, and deliberately an arrow rather
   than a paper plane — the card streams a reply in place, it does not post a
   message somewhere. */
const SEND_ARROW = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>`;

let rootElement = null;
let wordTimer = null;
let streamState = null;

const bodyElement = () => $('[data-asst-body]', rootElement);
const textElement = () => $('[data-asst-text]', rootElement);
const followElement = () => $('[data-asst-follow]', rootElement);
const titleElement = () => $('[data-asst-title]', rootElement);
const inputElement = () => $('[data-asst-input]', rootElement);

const toFollowUps = (ids) => ids.map((id) => ({ id, label: intentLabel(id) }));

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

/**
 * Give up on the current answer without finishing it — closing the card, or
 * switching into pointer mode. The orb settles either way: an abandoned
 * answer is not still being composed.
 */
function abandonStream() {
  stopStreaming();
  streamState = null;
  orbThinking('answer', false);
}

/** Reveal the remaining words at once, then settle into the finished state. */
function finishStream() {
  if (!streamState) return;
  stopStreaming();
  orbThinking('answer', false);
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

function streamAnswer({ text, followUps }, title = 'Assistant') {
  stopStreaming();
  orbThinking('answer', true);
  titleElement().textContent = title;
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

/* ---------- Pointer mode ---------- */

/**
 * Clicky's cursor flies to whatever the model names; this one walks with you.
 * Arming it drops a companion that trails the real pointer, and resting on a
 * panel for a beat asks that panel what its numbers say.
 *
 * A mode rather than plain hover, because the panels underneath already own
 * their pointer: routing a driver, opening a response, a select. Dwelling is
 * only safe to make meaningful once the user has asked for it.
 */
function setPointerMode(on) {
  setPointer(on, readPanel);
  const toggle = $('[data-act="asst-pointer"]', rootElement);
  if (toggle) toggle.setAttribute('aria-pressed', String(on));
}

/** Report what one panel's data says. Called when the pointer settles on it. */
export function readPanel(key) {
  // Three panel keys appear on both kinds and read different sources, so the
  // composer is told which campaign it is standing in front of.
  const found = insight(key, campaignKind(snapshot().campaign));
  if (!found || !rootElement) return;
  rootElement.dataset.open = 'true';
  streamAnswer({ text: found.text, followUps: toFollowUps(found.followUps) }, found.title);
}

/* ---------- Public API ---------- */

/** Ask the assistant an intent and stream the reply. */
export function ask(intentId = 'overview') {
  if (!rootElement) return;
  streamAnswer(answer(intentId, snapshot()), 'Assistant');
}

/**
 * The typed question. `route()` in assistant-answers.js already matches free
 * text against the eleven intents' keywords, so the composed reply is the same
 * deterministic, data-derived answer the follow-up buttons return — the box is
 * a second way in, not a second answer engine, and it cannot invent a figure
 * the buttons would not also print.
 *
 * The header takes the question rather than the word "Assistant": with the
 * input cleared on send, it is the only thing left on screen saying what the
 * answer below it is an answer to.
 */
export function askText(query) {
  const text = String(query || '').trim();
  if (!text || !rootElement) return;
  rootElement.dataset.open = 'true';
  streamAnswer(answer(route(text), snapshot()), text);
}

export function openAssistant(intentId = 'overview') {
  if (!rootElement) mountAssistant();
  rootElement.dataset.open = 'true';
  ask(intentId);
  // The card is `visibility: hidden` while closed, so focus has to wait for
  // the opened state to paint. Deliberately not done on readPanel(): the
  // pointer opens the card by walking over a panel, and stealing the caret
  // mid-sweep would put the next keystroke somewhere nobody aimed it.
  requestAnimationFrame(() => inputElement()?.focus());
}

export function closeAssistant() {
  if (!rootElement) return;
  setPointerMode(false);
  abandonStream();
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
        <span class="asst-head-orb" data-asst-orb></span>
        <span class="asst-head-title grow truncate" data-asst-title>Assistant</span>
        <span class="badge badge-ai badge-mono">BETA</span>
        <button class="asst-icon-btn" data-act="asst-pointer" aria-pressed="false"
                aria-label="Read a panel with the pointer">
          ${raw(icon('target'))}
        </button>
        <button class="asst-icon-btn" data-act="asst-close" aria-label="Close assistant">
          ${raw(icon('x'))}
        </button>
      </header>
      <div class="asst-body" data-asst-body>
        <p class="asst-text" data-asst-text></p>
      </div>
      <div class="asst-follow" data-asst-follow></div>
      <!-- The composer sits below the follow-ups deliberately: the suggestions
           are what the assistant offers, the box is what you bring, and the
           one you reach for last should be nearest the hand. -->
      <form class="asst-ask" data-asst-form>
        <input class="asst-ask-input" data-asst-input type="text" autocomplete="off"
               placeholder="Ask about this screen…" aria-label="Ask the assistant" />
        <button class="asst-ask-send" type="submit" aria-label="Send question">
          ${raw(SEND_ARROW)}
        </button>
      </form>
    </section>
    <button class="asst-bubble" data-act="asst-toggle" aria-label="Open assistant"
            data-asst-orb></button>`;
  document.body.appendChild(rootElement);

  /* Two orbs, one assistant: the launcher and the card's own mark. They share
     a state through orbThinking(), so they never disagree about what the
     assistant is doing. Sized to their boxes — 42px inside the bubble's
     border, 20px in the header, both under the renderer's buffer cap. */
  mountOrb($('.asst-bubble', rootElement), { size: 42 });
  mountOrb($('.asst-head-orb', rootElement), { size: 20 });

  on(rootElement, 'click', '[data-act="asst-toggle"]', () => {
    if (rootElement.dataset.open === 'true') closeAssistant();
    else openAssistant();
  });
  on(rootElement, 'click', '[data-act="asst-close"]', closeAssistant);
  on(rootElement, 'click', '[data-act="asst-ask"]', (event, button) => ask(button.dataset.intent));

  // Enter submits; the button is the same submit, so both routes are one path.
  $('[data-asst-form]', rootElement).addEventListener('submit', (event) => {
    event.preventDefault();
    const input = inputElement();
    const query = input.value;
    if (!query.trim()) return;
    // Cleared before the answer streams: leaving the question in the box makes
    // a second, different question look like an edit of the first.
    input.value = '';
    // Typing is asking, and asking while the pointer is armed would answer the
    // question over the top of whatever the pointer was reading.
    if (pointerActive()) setPointerMode(false);
    askText(query);
  });

  on(rootElement, 'click', '[data-act="asst-pointer"]', () => {
    const next = !pointerActive();
    setPointerMode(next);
    if (!next) return;
    // Arming the pointer is a mode switch away from typing — the caret must
    // not stay in the box while the mouse is the input device, or the next
    // keystroke lands somewhere nobody aimed it.
    inputElement()?.blur();
    abandonStream();
    titleElement().textContent = 'Pointer on';
    followElement().innerHTML = '';
    textElement().innerHTML = html`<span class="asst-word">Move over any panel and hold still for a
      moment — I'll read what its numbers say. Escape puts the pointer away.</span>`;
  });

  // Clicking the answer while it streams skips to the end, as impatient
  // readers expect of any typewriter reveal.
  on(rootElement, 'click', '[data-asst-body]', () => { if (streamState) finishStream(); });
  bodyElement().addEventListener('scroll', updateScrollHints, { passive: true });

  document.addEventListener('keydown', (event) => {
    // A modal owns Escape outright while it is open: dismissing a dialog must
    // not also close the assistant sitting behind it.
    if (event.key === 'Escape' && document.querySelector('.scrim')) return;
    // So does the composer, while there is something in it. Escape on a
    // half-typed question should clear the question, not throw away the answer
    // above it as well.
    if (event.key === 'Escape' && event.target === inputElement() && event.target.value) {
      event.target.value = '';
      return;
    }
    // Otherwise Escape puts the pointer away first, and only then closes.
    if (event.key === 'Escape' && pointerActive()) { setPointerMode(false); return; }
    if (event.key === 'Escape' && rootElement.dataset.open === 'true') closeAssistant();
    // "?" arms the pointer straight away, unless the user is typing.
    if (event.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
      event.preventDefault();
      openAssistant();
      $('[data-act="asst-pointer"]', rootElement).click();
    }
    // Ctrl + / — the browser equivalent of clicky's global push-to-talk key.
    if (event.key === '/' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (rootElement.dataset.open === 'true') closeAssistant();
      else openAssistant();
    }
  });

  return rootElement;
}
