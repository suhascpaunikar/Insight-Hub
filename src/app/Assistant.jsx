/* ==========================================================================
   Assistant.jsx — the companion card (FR-91 surface).

   Clicky's interaction model, ported to the browser: a small buddy docked at
   the edge of the screen that speaks first about what it can see, streams its
   answer a word at a time, and offers the next question rather than waiting
   for one. What it does not port is the perception layer — see
   assistant-context.js for why there is nothing to photograph here.

   The card holds a transcript: questions and replies stack in scrollback so a
   reader can see what they asked, not only the last thing they were told. The
   log scrolls internally and follows the caret; the follow-ups and the ask box
   stay pinned to the bottom edge, so the footprint never changes as the
   conversation grows.

   Free text reaches the same eleven composers the follow-up buttons do,
   keyword matched by `route()`. There is still no model here. An unmatched
   question falls back on the overview rather than dead-ending.

   §11.4 marks this "(none)" and it still is — Kumo has no companion card, and
   nothing inside this one is Kumo's either. The port had swapped the field and
   the send button for Kumo's Textarea and Button and the pointer toggle for a
   Kumo Tooltip; all three changed the card's shape, and the Tooltip put a
   <button> inside a <button>, which React logged on every render. The controls
   below are the ones the card was built with.

   The face of it is the orb, and this component decides which of its two
   states it is in. Composing an answer is the whole of the assistant's work,
   so streaming is exactly when it thinks — the orb wakes on the first word and
   settles on the last, which makes the card's own latency legible instead of
   leaving a still icon over moving text.
   ========================================================================== */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../lib/icons.jsx';
import { Orb, useOrb } from './Orb.jsx';
import { snapshot } from '../lib/assistant-context.js';
import { answer, intentLabel, route } from '../lib/assistant-answers.js';
import { insight, builderTip, hasBuilderTip } from '../lib/assistant-insights.js';
import { orbThinking } from '../lib/assistant-orb.js';
import { setPointer, pointerActive } from '../lib/assistant-pointer.js';
import { campaignKind } from '../lib/data.js';

/* Cadence borrowed from the reference component: slow enough to read along
   with, fast enough that a four-line answer lands in about three seconds. */
const WORD_MS = 80;

/* The ask field grows with what you type, between these. */
const ASK_MIN = 34;
const ASK_MAX = 90;

const toFollowUps = (ids) => ids.map((id) => ({ id, label: intentLabel(id) }));

/* Turn ids come from a counter rather than from the transcript's length: an
   abandoned turn can leave the log, and a length-derived id would then be
   handed out a second time — two turns under one React key. */
let turnSeq = 0;
const turnId = (prefix) => `${prefix}_${(turnSeq += 1)}`;

/** The reply-arrow that marks a follow-up. Not in the shared icon set. */
const ReplyArrow = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 10l-5 5 5 5" /><path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </svg>
);

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Assistant');
  const [turns, setTurns] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [draftText, setDraftText] = useState('');
  const [pointerOn, setPointerOn] = useState(false);
  /* The words revealed so far of the turn still streaming, or null. Kept
     apart from `turns` so a re-render per word touches one array rather than
     rebuilding the transcript — and kept as words, not as one joined string,
     because each one is its own element that resolves out of a blur as it
     lands. A string would reveal the answer as a machine printing characters;
     the words make it read as composition. */
  const [streamed, setStreamed] = useState(null);

  const bodyRef = useRef(null);
  const fieldRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const bubbleRef = useRef(null);
  /* The panel the last reading came from. A pointer that wanders off a panel
     and back is a reader still looking at it, not a second question about it. */
  const lastReadRef = useRef(null);

  // The launcher is the orb, rather than a box with an orb inside it: the orb
  // module writes `data-orb-state` onto its host, and the lit ring is a rule
  // on that attribute.
  useOrb(bubbleRef, 42);

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };

  /** Reveal the remaining words at once, then settle into the finished state. */
  const finishStream = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    stopTimer();
    orbThinking('answer', false);
    streamRef.current = null;
    setStreamed(null);
    setTurns((list) => list.map((t) => (t.id === s.id ? { ...t, text: s.words.join(' '), streaming: false } : t)));
    setFollowUps(s.followUps);
  }, []);

  /**
   * Give up on the stream in flight, if any, and settle the turn it was
   * filling.
   *
   * Settling it is the whole point. A turn left flagged `streaming` with no
   * stream behind it keeps rendering `streamed` — and `streamed` belongs to
   * whatever streams next. So an abandoned answer did not merely sit there
   * blank: the following answer landed in it as well as in its own turn, the
   * same words twice on screen at once, and every further abandon added
   * another copy. What was revealed stands as what was said, ellipsed because
   * it was cut off mid-sentence; a turn that got no words out leaves the log
   * rather than staying on as an empty paragraph with a caret.
   *
   * The orb is the caller's: abandoning settles it, starting the next answer
   * keeps it awake.
   */
  const dropStream = useCallback(() => {
    const s = streamRef.current;
    stopTimer();
    streamRef.current = null;
    setStreamed(null);
    if (!s) return;
    setTurns((list) => list.flatMap((t) => {
      if (t.id !== s.id) return [t];
      const said = s.words.slice(0, s.index).join(' ');
      return said ? [{ ...t, text: `${said}…`, streaming: false }] : [];
    }));
  }, []);

  /**
   * Give up on the current answer without finishing it — closing the card, or
   * switching into pointer mode. The orb settles either way: an abandoned
   * answer is not still being composed.
   */
  const abandonStream = useCallback(() => {
    dropStream();
    orbThinking('answer', false);
  }, [dropStream]);

  const streamAnswer = useCallback(({ text, followUps: ups }, nextTitle = 'Assistant', label = '') => {
    // An answer can arrive over one still streaming: a dwell fires into it,
    // the rail opens the card on an intent, the keyboard arms the pointer.
    // Whatever it interrupts has to be settled first — see dropStream.
    dropStream();
    orbThinking('answer', true);
    setTitle(nextTitle);
    setFollowUps([]);

    const id = turnId('t');
    const words = String(text).split(/\s+/).filter(Boolean);
    streamRef.current = { id, words, index: 0, followUps: ups };
    setTurns((list) => [...list, { id, from: 'asst', label, text: '', streaming: true }]);
    setStreamed([]);

    timerRef.current = setInterval(() => {
      const s = streamRef.current;
      if (!s || s.index >= s.words.length) { finishStream(); return; }
      s.index += 1;
      setStreamed(s.words.slice(0, s.index));
    }, WORD_MS);
  }, [dropStream, finishStream]);

  /**
   * The reader's own words, echoed above the answer to them. Without it the
   * log is a column of replies with nothing saying what prompted any of them —
   * and a follow-up button is as much a question asked as a typed one is.
   */
  const appendQuestion = useCallback((text) => {
    const id = turnId('q');
    setTurns((list) => [...list, { id, from: 'you', text }]);
  }, []);

  const ask = useCallback((intentId = 'overview') => {
    // Anything asked outright ends the last reading, so returning to that
    // panel afterwards reads it again rather than being treated as a repeat.
    lastReadRef.current = null;
    streamAnswer(answer(intentId, snapshot()), 'Assistant');
  }, [streamAnswer]);

  const askIntent = useCallback((intentId) => {
    appendQuestion(intentLabel(intentId));
    ask(intentId);
  }, [appendQuestion, ask]);

  const askText = useCallback((value) => {
    const question = String(value || '').trim();
    if (!question) return;
    // Typing over a streaming answer completes it rather than abandoning it
    // half-written in the scrollback.
    if (streamRef.current) finishStream();
    appendQuestion(question);
    ask(route(question));
  }, [appendQuestion, ask, finishStream]);

  /**
   * A panel the pointer rested on, answered from its own numbers.
   *
   * Reading the same panel twice running is dropped. The dwell re-arms every
   * time the pointer leaves a panel and comes back — which is right, because
   * a reader returning to a panel is asking about it again — but a hand
   * resting near an edge crosses that boundary several times a second, and
   * each crossing used to stack another copy of the same answer in the log.
   * One reading per panel until something else is asked.
   */
  const readPanel = useCallback((key) => {
    if (lastReadRef.current === key) return;
    const snap = snapshot();
    // A wizard section is answered from the draft, not from campaign data —
    // there is none yet. Tried first because these keys exist on no campaign
    // panel.
    const found = hasBuilderTip(key)
      ? builderTip(key, snap.draft)
      // Three panel keys appear on both kinds and read different sources, so
      // the composer is told which campaign it is standing in front of.
      : insight(key, campaignKind(snap.campaign));
    if (!found) return;
    lastReadRef.current = key;
    setOpen(true);
    streamAnswer(
      { text: found.text, followUps: toFollowUps(found.followUps) }, found.title, found.title);
  }, [streamAnswer]);

  const setPointerMode = useCallback((on) => {
    setPointerOn(on);
    setPointer(on, readPanel);
  }, [readPanel]);

  const openWith = useCallback((intentId) => {
    setOpen(true);
    // It still speaks first about what it can see — but only into an empty log.
    // Reopening mid-conversation should show the conversation, not restate the
    // overview on top of it.
    if (intentId) askIntent(intentId);
    else setTurns((list) => { if (!list.length) ask('overview'); return list; });
    setTimeout(() => fieldRef.current?.focus(), 0);
  }, [ask, askIntent]);

  const close = useCallback(() => {
    abandonStream();
    setOpen(false);
    setPointerMode(false);
    lastReadRef.current = null;
  }, [abandonStream, setPointerMode]);

  /* The rail and the top bar open the card; they are outside this tree, so
     they say so on the document. */
  useEffect(() => {
    const onOpen = () => openWith(null);
    document.addEventListener('assistant:open', onOpen);
    return () => document.removeEventListener('assistant:open', onOpen);
  }, [openWith]);

  useEffect(() => () => stopTimer(), []);

  /* Keyboard. */
  useEffect(() => {
    const onKey = (event) => {
      // A modal owns Escape outright while it is open: dismissing a dialog
      // must not also close the assistant sitting behind it.
      if (event.key === 'Escape' && document.querySelector('[role="dialog"][data-open="true"], .kumo-dialog-backdrop')) return;
      if (event.key === 'Escape' && event.target === fieldRef.current && fieldRef.current.value) {
        // Losing the card because you thought better of a question is the
        // wrong amount of undo.
        setDraftText('');
        return;
      }
      if (event.key === 'Escape' && pointerActive()) { setPointerMode(false); return; }
      if (event.key === 'Escape' && open) { close(); return; }
      // "?" arms the pointer straight away, unless the user is typing.
      if (event.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
        event.preventDefault();
        setOpen(true);
        setTurns((list) => { if (!list.length) ask('overview'); return list; });
        setPointerMode(true);
        return;
      }
      // Ctrl + / — the browser equivalent of clicky's global push-to-talk key.
      if (event.key === '/' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (open) close(); else openWith(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, openWith, setPointerMode, ask]);

  /* The field grows with what you type, up to a cap, and snaps back when it
     is emptied — by sending, by Escape, or by deleting it. */
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = `${ASK_MIN}px`;
    if (!draftText) return;
    field.style.height = `${Math.max(ASK_MIN, Math.min(field.scrollHeight, ASK_MAX))}px`;
  }, [draftText]);

  /* A fixed box cuts a line in half whenever the transcript runs past it.
     Fading the edge it actually overflows makes the cut read as "there is more
     this way" rather than as a clipped render. */
  const updateScrollHints = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const room = body.scrollHeight - body.clientHeight;
    body.dataset.fadeTop = String(room > 1 && body.scrollTop > 1);
    body.dataset.fadeBottom = String(room > 1 && body.scrollTop < room - 1);
  }, []);

  /* Keep the caret in view while streaming, and settle once it lands.

     The caret is chased to the bottom while streaming so the newest word stays
     visible, which leaves a long answer parked at its end with its opening
     line scrolled off. A reply taller than the card is pulled back to its own
     first line for that reason; one that fits stays down with the newest turn,
     which is what a transcript should do. */
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (streamed !== null) { body.scrollTop = body.scrollHeight; updateScrollHints(); return; }
    const last = body.querySelector('.ih-asst-turn:last-child');
    if (!last) { updateScrollHints(); return; }
    const offset = last.offsetTop;
    body.scrollTo({
      top: last.offsetHeight > body.clientHeight ? offset : body.scrollHeight,
      behavior: 'smooth',
    });
    updateScrollHints();
  }, [streamed, turns.length, updateScrollHints]);

  return (
    <div className="ih-asst" data-open={String(open)}>
      <section className="ih-asst-card" role="dialog" aria-label="InsightHub assistant">
        <header className="ih-asst-head">
          <Orb size={20} className="ih-asst-head-orb" />
          <span className="ih-asst-head-title truncate">{title}</span>
          <span className="ih-asst-beta">BETA</span>
          {/* `title` rather than a Tooltip: Kumo's renders a button of its own
              around whatever it wraps, and a button inside a button is invalid
              HTML the browser un-nests. */}
          <button
            type="button"
            className="ih-asst-icon-btn"
            aria-pressed={pointerOn}
            title="Read a panel with the pointer"
            aria-label="Read a panel with the pointer"
            onClick={() => {
              const next = !pointerActive();
              setPointerMode(next);
              if (!next) return;
              abandonStream();
              // Re-arming is a fresh start: the panel read last time is a
              // panel this pointer has not read yet.
              lastReadRef.current = null;
              // The pointer is about to own the cursor; a focused text field
              // would eat the Escape that puts it away.
              fieldRef.current?.blur();
              setTitle('Pointer on');
              setFollowUps([]);
              const note = {
                id: turnId('n'), from: 'asst',
                text: 'Move over any panel and hold still for a moment — I’ll read what its '
                  + 'numbers say. Escape puts the pointer away.',
              };
              setTurns((list) => [...list, note]);
            }}
          >
            <Icon name="target" size={14} />
          </button>
          <button
            type="button"
            className="ih-asst-icon-btn"
            aria-label="Close assistant"
            onClick={close}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        {/* Clicking the answer while it streams skips to the end, as impatient
            readers expect of any typewriter reveal. */}
        <div
          className="ih-asst-body"
          ref={bodyRef}
          onScroll={updateScrollHints}
          onClick={() => { if (streamRef.current) finishStream(); }}
        >
          <div className="ih-asst-log">
            {turns.map((t) => (
              <div className="ih-asst-turn" data-from={t.from} key={t.id}>
                {t.label && <span className="ih-asst-turn-label">{t.label}</span>}
                <p className="ih-asst-text">
                  {/* One element per word while it streams: each is mounted as
                      it lands and resolves out of a blur on its own. */}
                  {t.streaming
                    ? (streamed || []).map((word, i) => (
                      <span className="ih-asst-word" key={i}>{word} </span>
                    ))
                    : t.text}
                  {t.streaming && <span className="ih-asst-caret" />}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="ih-asst-follow">
          {followUps.length > 0 && <p className="ih-asst-follow-label">Follow-ups</p>}
          {followUps.map((f, i) => (
            <button
              type="button"
              className="ih-asst-follow-btn"
              key={f.id}
              style={{ animationDelay: `${i * 90}ms` }}
              onClick={() => askIntent(f.id)}
            >
              <ReplyArrow />
              <span className="truncate">{f.label}</span>
            </button>
          ))}
        </div>

        <form
          className="ih-asst-ask"
          onSubmit={(e) => { e.preventDefault(); askText(draftText); setDraftText(''); }}
        >
          <div className="ih-asst-ask-shell">
            <textarea
              ref={fieldRef}
              rows={1}
              className="ih-asst-ask-field"
              placeholder="Ask about this data…"
              aria-label="Ask the assistant"
              autoComplete="off"
              spellCheck={false}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              /* Enter sends and Shift+Enter breaks the line — the ported
                 component's own contract, and the one every chat box shares. */
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return;
                e.preventDefault();
                askText(draftText);
                setDraftText('');
              }}
            />
            <div className="ih-asst-ask-bar">
              {/* Lit only once there is something to send. */}
              <button
                type="submit"
                className="ih-asst-ask-send"
                data-armed={String(!!draftText.trim())}
                aria-label="Send question"
              >
                <Icon name="send" size={13} />
              </button>
            </div>
          </div>
        </form>
      </section>

      <button
        type="button"
        ref={bubbleRef}
        className="ih-asst-bubble"
        aria-label="Open assistant"
        onClick={() => (open ? close() : openWith(null))}
      />
    </div>
  );
}
