/* ==========================================================================
   assistant.js — the companion card (FR-91 surface).

   Clicky's interaction model, ported to the browser: a small buddy docked at
   the edge of the screen that speaks first about what it can see, streams its
   answer a word at a time, and offers the next question rather than waiting
   for one. What it does not port is the perception layer — see
   assistant-context.js for why there is nothing to photograph here.

   The card is a fixed 320×380 box holding a transcript: questions and replies
   stack in scrollback so a reader can see what they asked, not only the last
   thing they were told. The log scrolls internally and follows the caret; the
   follow-ups and the ask box stay pinned to the bottom edge, so the footprint
   never changes as the conversation grows.

   Free text reaches the same eleven composers the follow-up buttons do, keyword
   matched by `route()` — which has been sitting in assistant-answers.js marked
   "kept for free-text entry points" since before there was a box to type into.
   There is still no model here. An unmatched question falls back on the
   overview rather than dead-ending.

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

let rootElement = null;
let wordTimer = null;
let streamState = null;

const bodyElement = () => $('[data-asst-body]', rootElement);
const logElement = () => $('[data-asst-log]', rootElement);
const followElement = () => $('[data-asst-follow]', rootElement);
const titleElement = () => $('[data-asst-title]', rootElement);
const inputElement = () => $('[data-asst-input]', rootElement);
const sendElement = () => $('[data-asst-send]', rootElement);

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

/* ---------- The transcript ---------- */

/** Park the view on the newest turn. */
function scrollToLatest() {
  const body = bodyElement();
  if (body) body.scrollTop = body.scrollHeight;
}

/**
 * Append a turn and hand back the node its text goes in.
 *
 * The card used to hold exactly one answer and clear it on every question,
 * which is why streamAnswer() began by emptying the region. A transcript wants
 * the opposite: every reply is a new node under the last, and the streamer
 * writes into whichever one it just made.
 */
function appendTurn(from, label = '') {
  const turn = document.createElement('div');
  turn.className = 'asst-turn';
  turn.dataset.from = from;
  if (label) {
    const tag = document.createElement('span');
    tag.className = 'asst-turn-label';
    tag.textContent = label;
    turn.appendChild(tag);
  }
  const text = document.createElement('p');
  text.className = 'asst-text';
  turn.appendChild(text);
  logElement().appendChild(turn);
  return text;
}

/**
 * The reader's own words, echoed above the answer to them. Without it the log
 * is a column of replies with nothing saying what prompted any of them — and a
 * follow-up button is as much a question asked as a typed one is.
 */
function appendQuestion(text) {
  appendTurn('you').textContent = text;
  scrollToLatest();
  updateScrollHints();
}

/** Something the card states rather than composes — pointer mode's notice. */
function note(text) {
  appendTurn('asst').textContent = text;
  scrollToLatest();
  updateScrollHints();
}

/**
 * Where to leave the view once an answer lands.
 *
 * The caret is chased to the bottom while streaming so the newest word stays
 * visible, which leaves a long answer parked at its end with its opening line
 * scrolled off — the reason the single-answer card settled back to the top. A
 * reply taller than the card is pulled back to its own first line for that
 * same reason; one that fits stays down with the newest turn, which is what a
 * transcript should do.
 */
function settleScroll(turn) {
  const body = bodyElement();
  if (!body || !turn) return;
  const offset = turn.getBoundingClientRect().top
    - body.getBoundingClientRect().top + body.scrollTop;
  const top = turn.offsetHeight > body.clientHeight ? offset : body.scrollHeight;
  body.scrollTo({ top, behavior: 'smooth' });
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
  const { words, caret, target } = streamState;
  while (streamState.index < words.length) {
    target.insertBefore(buildWord(words[streamState.index]), caret);
    streamState.index += 1;
  }
  caret.remove();
  renderFollowUps(streamState.followUps);
  settleScroll(target.parentElement);
  updateScrollHints();
  streamState = null;
}

function buildWord(word) {
  const span = document.createElement('span');
  span.className = 'asst-word';
  span.textContent = `${word} `;
  return span;
}

/**
 * `label` names a turn in the scrollback. The header title only ever describes
 * the newest reply, so a panel reading three questions back would otherwise
 * lose the name of the panel it read.
 */
function streamAnswer({ text, followUps }, title = 'Assistant', label = '') {
  stopStreaming();
  orbThinking('answer', true);
  titleElement().textContent = title;
  followElement().innerHTML = '';

  const target = appendTurn('asst', label);
  const caret = document.createElement('span');
  caret.className = 'asst-caret';
  target.appendChild(caret);

  streamState = { words: text.split(/\s+/).filter(Boolean), index: 0, caret, followUps, target };

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

/* ==========================================================================
   The ask box

   Ported from the shadcn/Tailwind `ai-input-with-search` component — the
   two-tier shape, the field that grows with what you type, Enter to send and
   Shift+Enter for a line break, and a send button that lights only once there
   is something to send. Its file and web-search controls are not here: this
   prototype has no network call and no file handling, and a dead control on
   the one surface whose documentation insists it must not overclaim is worse
   than a missing one. See the note above its rules in supabase.css.

   The auto-resize is that component's `useAutoResizeTextarea` hook as a dozen
   lines of DOM. The order matters and is the hook's own: drop to the floor
   first so `scrollHeight` reports the content rather than the box it is
   already filling, then grow to it under the cap.
   ========================================================================== */

const ASK_MIN = 34;
const ASK_MAX = 90;

function resizeAsk(reset = false) {
  const field = inputElement();
  if (!field) return;
  field.style.height = `${ASK_MIN}px`;
  if (reset) return;
  field.style.height = `${Math.max(ASK_MIN, Math.min(field.scrollHeight, ASK_MAX))}px`;
}

/** Nothing to send reads as nothing to send. */
function armSend() {
  const field = inputElement();
  if (field && sendElement()) sendElement().dataset.armed = String(!!field.value.trim());
}

function submitAsk() {
  const field = inputElement();
  const question = field.value;
  field.value = '';
  resizeAsk(true);
  armSend();
  askText(question);
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
  streamAnswer(
    { text: found.text, followUps: toFollowUps(found.followUps) }, found.title, found.title);
}

/* ---------- Public API ---------- */

/** Ask the assistant an intent and stream the reply. */
export function ask(intentId = 'overview') {
  if (!rootElement) return;
  streamAnswer(answer(intentId, snapshot()), 'Assistant');
}

/** A follow-up is a question the reader asked, so it enters the log as one. */
function askIntent(intentId) {
  appendQuestion(intentLabel(intentId));
  ask(intentId);
}

/**
 * Free text, routed by keyword to one of the eleven composers. There is no
 * model behind this and the documentation says so plainly — the box reaches
 * exactly what the follow-up buttons reach, and an unmatched question lands on
 * the overview rather than dead-ending.
 */
function askText(raw) {
  const question = String(raw || '').trim();
  if (!question) return;
  // Typing over a streaming answer completes it rather than abandoning it
  // half-written in the scrollback.
  if (streamState) finishStream();
  appendQuestion(question);
  ask(route(question));
}

export function openAssistant(intentId = null) {
  if (!rootElement) mountAssistant();
  rootElement.dataset.open = 'true';
  // It still speaks first about what it can see — but only into an empty log.
  // Reopening mid-conversation should show the conversation, not restate the
  // overview on top of it.
  if (intentId) askIntent(intentId);
  else if (!logElement().children.length) ask('overview');
  inputElement().focus();
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
        <div class="asst-log" data-asst-log></div>
      </div>
      <div class="asst-follow" data-asst-follow></div>
      <form class="asst-ask" data-asst-form>
        <div class="asst-ask-shell">
          <textarea class="asst-ask-field" data-asst-input rows="1"
                    placeholder="Ask about this data…" aria-label="Ask the assistant"
                    autocomplete="off" spellcheck="false"></textarea>
          <div class="asst-ask-bar">
            <button type="submit" class="asst-ask-send" data-asst-send
                    data-armed="false" aria-label="Send question">
              ${raw(icon('send'))}
            </button>
          </div>
        </div>
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
  on(rootElement, 'click', '[data-act="asst-ask"]', (e, button) => askIntent(button.dataset.intent));

  /* The ask box. Enter sends and Shift+Enter breaks the line — the ported
     component's own contract, and the one every chat box shares. */
  const field = inputElement();
  $('[data-asst-form]', rootElement).addEventListener('submit', (event) => {
    event.preventDefault();
    submitAsk();
  });
  field.addEventListener('input', () => { resizeAsk(); armSend(); });
  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submitAsk();
  });
  resizeAsk(true);

  on(rootElement, 'click', '[data-act="asst-pointer"]', () => {
    const next = !pointerActive();
    setPointerMode(next);
    if (!next) return;
    abandonStream();
    // The pointer is about to own the cursor; a focused text field would eat
    // the Escape that puts it away.
    inputElement().blur();
    titleElement().textContent = 'Pointer on';
    followElement().innerHTML = '';
    note("Move over any panel and hold still for a moment — I'll read what its "
      + 'numbers say. Escape puts the pointer away.');
  });

  // Clicking the answer while it streams skips to the end, as impatient
  // readers expect of any typewriter reveal.
  on(rootElement, 'click', '[data-asst-body]', () => { if (streamState) finishStream(); });
  bodyElement().addEventListener('scroll', updateScrollHints, { passive: true });

  document.addEventListener('keydown', (event) => {
    // A modal owns Escape outright while it is open: dismissing a dialog must
    // not also close the assistant sitting behind it.
    if (event.key === 'Escape' && document.querySelector('.scrim')) return;
    // Escape in the ask box clears what is half-typed before it closes
    // anything — losing the card because you thought better of a question is
    // the wrong amount of undo.
    if (event.key === 'Escape' && event.target === inputElement() && event.target.value) {
      event.target.value = '';
      resizeAsk(true);
      armSend();
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
