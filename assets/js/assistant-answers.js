/* ==========================================================================
   assistant-answers.js — the answer engine.

   Deterministic, not inferred: every figure below is computed from data.js
   and the live store at the moment the question is asked, so the answers
   follow the data rather than restating a frozen copy of it. Swap the seed
   numbers and these sentences change with them.

   Two of the repository's own rules are load-bearing here:
     · LOW_SAMPLE (core.js) — under 100 responses the console shows counts,
       never percentages. A share quoted off a base of six is noise wearing
       a decimal point, so `share()` refuses to render one.
     · FR-91 — the assistant speaks in the AI accent, which the design system
       reserves for machine claims. It may therefore only report figures it
       has actually read; nothing here invents a number.
   ========================================================================== */
import { count, percent, ratingText, LOW_SAMPLE } from './core.js';
import {
  THEMES, SCORE_DRIVERS, DELIVERY_FUNNEL, FAILURE_REASONS,
  VARIANT_RESULTS, OPEN_RESPONSES, RATING_BLOCK,
} from './data.js';

/* FR-89 — a share is only meaningful above the low-sample threshold. */
const share = (n, total) => (total < LOW_SAMPLE ? count(n) : percent((n / total) * 100));

const byDrag = () => [...SCORE_DRIVERS].sort((a, b) => b.drag - a.drag);
const byVolume = () => [...THEMES].sort((a, b) => b.volume - a.volume);
const stage = (label) => DELIVERY_FUNNEL.find((s) => s.label === label) || { value: 0 };
const trendWord = (n) => (n >= 0 ? `up ${n}%` : `down ${Math.abs(n)}%`);

/* ---------- Answer composers ---------- */

function driversAnswer() {
  const ranked = byDrag();
  const worst = ranked[0];
  const second = ranked[1];
  const lifts = ranked.filter((d) => d.drag < 0);
  const lift = lifts[lifts.length - 1];

  let text =
    `${worst.name} is the largest drag on the score — ${ratingText(worst.drag)} points on its own, ` +
    `from ${count(worst.volume)} responses averaging ${ratingText(worst.avgRating)}. ` +
    `${second.name} follows at ${ratingText(second.drag)} points.`;
  if (lift) {
    text += ` Pulling the other way, ${lift.name} adds ${ratingText(Math.abs(lift.drag))} points back.`;
  }
  return { text, followUps: ['themes', 'detractors'] };
}

function themesAnswer() {
  const ranked = byVolume();
  const reportable = ranked.filter((t) => t.confidence !== 'low');
  const belowBar = ranked.length - reportable.length;
  const first = reportable[0];
  const second = reportable[1];

  let text =
    `${reportable.length} themes cleared the confidence bar. ` +
    `${first.name} is the largest at ${count(first.volume)} responses, ${trendWord(first.trend)} period-on-period, ` +
    `averaging ${ratingText(first.avgRating)}. ${second.name} is next at ${count(second.volume)}.`;
  if (belowBar) {
    text += ` ${belowBar} cluster${belowBar > 1 ? 's' : ''} sat below the threshold and ${belowBar > 1 ? 'are' : 'is'} not reported as a finding.`;
  }
  return { text, followUps: ['drivers', 'detractors'] };
}

function deliveryAnswer() {
  const sent = stage('Sent').value;
  const shown = stage('Shown').value;
  const started = stage('Started').value;
  const completed = stage('Completed').value;
  const topFailure = [...FAILURE_REASONS].sort((a, b) => b.count - a.count)[0];

  const text =
    `Of ${count(sent)} sent, ${count(completed)} completed — a ${share(completed, sent)} completion rate. ` +
    `The steepest fall is between shown and started, ${count(shown)} down to ${count(started)}. ` +
    `The largest failure reason is ${topFailure.reason.toLowerCase()} at ${count(topFailure.count)}.`;
  return { text, followUps: ['variants', 'rating'] };
}

function variantsAnswer() {
  const ranked = [...VARIANT_RESULTS].sort((a, b) => b.completionRate - a.completionRate);
  const winner = ranked[0];
  const runnerUp = ranked[1];

  const text =
    `${winner.name} is ahead — ${percent(winner.completionRate)} completion against ` +
    `${percent(runnerUp.completionRate)}, on an average rating of ${ratingText(winner.avgRating)} ` +
    `against ${ratingText(runnerUp.avgRating)}. It now carries ${percent(winner.weight, 0)} of the split ` +
    `across ${count(winner.responses)} responses.`;
  return { text, followUps: ['delivery', 'drivers'] };
}

function detractorsAnswer() {
  const detractors = OPEN_RESPONSES.filter((r) => r.band === 'detractor');
  const sample = detractors[0];

  const text =
    `${count(detractors.length)} of the ${count(OPEN_RESPONSES.length)} open responses in view sit in the ` +
    `detractor band. One reads: “${sample.text}” Context: ${sample.context}.`;
  return { text, followUps: ['themes', 'drivers'] };
}

function ratingAnswer() {
  const block = RATING_BLOCK;
  const low = block.distribution.filter((d) => d.score <= 6).reduce((sum, d) => sum + d.count, 0);

  const text =
    `“${block.question}” averages ${ratingText(block.average)} on a 1–${block.scaleMax} scale ` +
    `across ${count(block.responses)} responses. ${share(low, block.responses)} of those scored 6 or below, ` +
    `which is where the open text is worth reading.`;
  return { text, followUps: ['detractors', 'drivers'] };
}

function campaignAnswer(context) {
  const campaign = context.campaign;
  if (!campaign) {
    return { text: 'There is no campaign in view yet. Publish one from the builder and I can read it.', followUps: ['themes', 'delivery'] };
  }
  const element = campaign.ratingElement === 'star' ? 'a 5-point star rating' : `NPS 1–${campaign.ratingScaleMax}`;
  const text =
    `${campaign.name} (${campaign.campaignId}) is ${campaign.status.toLowerCase()}, running on ${element}. ` +
    `It has collected ${count(campaign.responses)} responses at an average of ${ratingText(campaign.avgRating)}, ` +
    `triggered on ${campaign.triggerLabel}. Audience: ${campaign.audienceLabel}.`;
  return { text, followUps: ['drivers', 'delivery'] };
}

/** The context-aware opening line — the assistant speaks first, about this screen. */
function overviewAnswer(context) {
  if (context.page === 'dashboard') {
    const busiest = [...context.campaigns].sort((a, b) => b.responses - a.responses)[0];
    const text = busiest
      ? `You have ${count(context.campaigns.length)} campaigns, ${count(context.liveCount)} of them live, ` +
        `and ${count(context.totalResponses)} responses collected in total. ` +
        `${busiest.name} is the busiest at ${count(busiest.responses)} responses, averaging ${ratingText(busiest.avgRating)}.`
      : 'No campaigns yet. Create one and I can read it back to you.';
    return { text, followUps: ['drivers', 'themes'] };
  }

  if (context.page === 'builder') {
    const draft = context.draft;
    const text = draft
      ? `You're on step ${draft.currentStep} of 6 of “${draft.name || 'an untitled campaign'}”, ` +
        `with ${count(draft.variants ? draft.variants.length : 0)} variant(s) configured. ` +
        `I can read results once it's published — ask me about an existing campaign in the meantime.`
      : 'No draft open. Start a campaign and I can follow along as you build it.';
    return { text, followUps: ['themes', 'delivery'] };
  }

  /* Insights — lead with the number the tab in view is actually about. The
     Themes tab was folded into Score drivers, so `themes` is reachable as a
     question but is no longer a tab of its own. */
  const byTab = { delivery: deliveryAnswer, responses: ratingAnswer, impact: driversAnswer };
  const composer = byTab[context.tab] || driversAnswer;
  return composer(context);
}

/* ---------- Registry ---------- */

const INTENTS = {
  overview:   { label: 'What am I looking at',        keywords: ['overview', 'summary', 'summarise', 'what am i', 'brief'],                 run: overviewAnswer },
  drivers:    { label: 'Why is the score down',       keywords: ['driver', 'score', 'down', 'drag', 'impact', 'why'],                        run: driversAnswer },
  themes:     { label: 'What are the themes',         keywords: ['theme', 'cluster', 'topic', 'trend'],                                      run: themesAnswer },
  delivery:   { label: 'How is delivery doing',       keywords: ['deliver', 'funnel', 'sent', 'shown', 'fail', 'completion'],                run: deliveryAnswer },
  variants:   { label: 'Which variant is winning',    keywords: ['variant', 'a/b', 'ab test', 'split', 'winning', 'weight'],                 run: variantsAnswer },
  detractors: { label: 'Show me detractors',          keywords: ['detractor', 'complaint', 'negative', 'unhappy', 'verbatim', 'response'],   run: detractorsAnswer },
  rating:     { label: 'How is the rating question',  keywords: ['rating', 'nps', 'star', 'question', 'distribution', 'average'],            run: ratingAnswer },
  campaign:   { label: 'Tell me about this campaign', keywords: ['campaign', 'this one', 'status', 'audience', 'trigger'],                   run: campaignAnswer },
};

export const intentLabel = (id) => (INTENTS[id] ? INTENTS[id].label : id);

/** Resolve an intent id (or free text) to a composed answer. */
export function answer(intentId, context) {
  const intent = INTENTS[intentId] || INTENTS.overview;
  const composed = intent.run(context);
  return {
    text: composed.text,
    followUps: composed.followUps.map((id) => ({ id, label: intentLabel(id) })),
  };
}

/** Keyword routing, kept for free-text entry points. Never dead-ends. */
export function route(query) {
  const q = String(query || '').toLowerCase();
  const hit = Object.keys(INTENTS).find((id) => INTENTS[id].keywords.some((k) => q.includes(k)));
  return hit || 'overview';
}
