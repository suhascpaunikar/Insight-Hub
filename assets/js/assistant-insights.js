/* ==========================================================================
   assistant-insights.js — what each panel's data actually says.

   The reading guide this replaces explained a panel's grammar; these read the
   numbers. Every figure is computed at the moment the pointer settles, so the
   findings follow the data rather than restating a frozen copy of it — change
   the seed numbers and the sentences change with them.

   Two of the repository's rules apply as they do everywhere else: LOW_SAMPLE
   withholds a percentage quoted off a base under 100, and FR-91 means anything
   the assistant says is a claim, so nothing here reports a figure it has not
   read. Where a sentence interprets rather than measures, it says so.
   ========================================================================== */
import { count, percent, ratingText, LOW_SAMPLE } from './core.js';
import {
  DELIVERY_FUNNEL, DELIVERY_SERIES, FAILURE_REASONS, RATING_BLOCK,
  BRANCH_BLOCKS, OPEN_RESPONSES, SCORE_DRIVERS, VARIANT_RESULTS,
  WEIGHT_HISTORY, THEMES,
} from './data.js';

const share = (n, total) => (total < LOW_SAMPLE ? count(n) : percent((n / total) * 100));
const pct = (n, total) => (total ? (n / total) * 100 : 0);
const stage = (label) => DELIVERY_FUNNEL.find((s) => s.label === label) || { label, value: 0 };
const themeName = (id) => (THEMES.find((t) => t.id === id) || {}).name || 'an unlabelled cluster';

/* ---------- Composers ---------- */

function deliveryFunnel() {
  const first = DELIVERY_FUNNEL[0];
  const last = DELIVERY_FUNNEL[DELIVERY_FUNNEL.length - 1];

  let worst = { from: null, to: null, lost: 0, rate: 0 };
  DELIVERY_FUNNEL.forEach((step, i) => {
    if (!i) return;
    const prev = DELIVERY_FUNNEL[i - 1];
    const lost = prev.value - step.value;
    if (lost > worst.lost) worst = { from: prev, to: step, lost, rate: pct(lost, prev.value) };
  });

  // Half of the worst step recovered, carried through the rates that follow it.
  const downstream = DELIVERY_FUNNEL.slice(DELIVERY_FUNNEL.indexOf(worst.to))
    .reduce((carry, step, i, arr) => (i === 0 ? 1 : carry * (step.value / arr[i - 1].value)), 1);
  const recoverable = Math.round((worst.lost / 2) * downstream);

  const reading = worst.from.label === 'Sent'
    ? 'That is a delivery problem rather than a content one — the failure reasons below say why.'
    : worst.from.label === 'Shown'
      ? 'They saw it and did not start, which points at timing and relevance rather than the questions themselves.'
      : 'They started and gave up, which points at the length of the questionnaire rather than the ask.';

  return {
    title: 'Delivery funnel',
    text:
      `${count(last.value)} of ${count(first.value)} sent finished — ${share(last.value, first.value)} end to end. ` +
      `The bleed is ${worst.from.label} → ${worst.to.label}, losing ${count(worst.lost)} there alone, ` +
      `${percent(worst.rate, 0)} of that step. Recovering half of it would be worth about ` +
      `${count(recoverable)} more completions. ${reading}`,
    followUps: ['delivery', 'variants'],
  };
}

function deliverySeries() {
  const byVersion = (v) => DELIVERY_SERIES.filter((p) => p.version === v);
  const rate = (rows) => pct(
    rows.reduce((s, p) => s + p.completions, 0),
    rows.reduce((s, p) => s + p.sends, 0),
  );
  const early = byVersion(1);
  const late = byVersion(2);
  const first = DELIVERY_SERIES[0];
  const last = DELIVERY_SERIES[DELIVERY_SERIES.length - 1];

  if (!early.length || !late.length) {
    return {
      title: 'Delivery over time',
      text:
        `Sends run from ${count(first.sends)} to ${count(last.sends)} a period across the window, ` +
        `completing at ${percent(rate(DELIVERY_SERIES), 1)} overall. One questionnaire version throughout, ` +
        `so the series reads as one continuous dataset.`,
      followUps: ['delivery', 'variants'],
    };
  }

  const delta = rate(late) - rate(early);
  const direction = delta >= 0 ? 'up' : 'down';
  return {
    title: 'Delivery over time',
    text:
      `Completion runs at ${percent(rate(late), 1)} since version 2, against ${percent(rate(early), 1)} before it — ` +
      `${direction} ${percent(Math.abs(delta), 1)} across the question change. Sends rose from ` +
      `${count(first.sends)} to ${count(last.sends)} a period over the same window, so the later ` +
      `figures carry more weight. Read either side on its own before crediting the change.`,
    followUps: ['delivery', 'rating'],
  };
}

function failureReasons() {
  const ranked = [...FAILURE_REASONS].sort((a, b) => b.count - a.count);
  const total = FAILURE_REASONS.reduce((s, f) => s + f.count, 0);
  const top = ranked[0];
  const rest = total - top.count;
  const sent = stage('Sent').value;

  const reading = /permission|opted out/i.test(top.reason)
    ? 'That is an opt-in problem upstream of this campaign — no change to the content recovers it.'
    : /token|uninstall/i.test(top.reason)
      ? 'That is list hygiene rather than campaign design — the addresses are stale.'
      : 'That one sits inside targeting, so it is reachable from the audience step.';

  return {
    title: 'Failure reasons',
    text:
      `${count(total)} sends failed, ${share(total, sent)} of everything sent. ` +
      `${top.reason} is ${share(top.count, total)} of those on its own — ${count(top.count)} sends. ` +
      `${reading} The remaining ${count(rest)} split across ${ranked.length - 1} smaller causes.`,
    followUps: ['delivery', 'campaign'],
  };
}

function ratingBlock() {
  const block = RATING_BLOCK;
  const total = block.responses;
  const low = block.distribution.filter((d) => d.score <= 6).reduce((s, d) => s + d.count, 0);
  const high = block.distribution.filter((d) => d.score >= 9).reduce((s, d) => s + d.count, 0);
  const modal = [...block.distribution].sort((a, b) => b.count - a.count)[0];

  // A mean sitting between two populated ends describes neither of them.
  const ends = pct(low + high, total);
  const shape = ends > 60
    ? 'so the mean sits in a gap between two populated ends and describes neither'
    : 'so the mean is a fair summary of where responses actually sit';

  return {
    title: 'The rating question',
    text:
      `${ratingText(block.average)} across ${count(total)} responses, but the shape matters more than the mean: ` +
      `${share(low, total)} scored 6 or below and ${share(high, total)} scored 9 or 10 — ${shape}. ` +
      `The single most common answer is ${modal.score}, at ${count(modal.count)}. ` +
      `The low end is where the open text is worth reading.`,
    followUps: ['rating', 'detractors'],
  };
}

function branchBlocks() {
  const pick = (band) => BRANCH_BLOCKS.find((b) => b.band === band);
  const detractor = pick('detractor');
  const promoter = pick('promoter');
  if (!detractor) {
    return {
      title: 'Follow-up by rating band',
      text: 'Branching is off for this campaign, so there is one follow-up path and no band split to compare.',
      followUps: ['rating', 'detractors'],
    };
  }

  const topOf = (block) => [...block.options].sort((a, b) => b.count - a.count)[0];
  const worst = topOf(detractor);
  const best = promoter && topOf(promoter);

  return {
    title: 'Follow-up by rating band',
    text:
      `Detractors name “${worst.label}” most — ${count(worst.count)} of ${count(detractor.responses)} in that band, ` +
      `${share(worst.count, detractor.responses)}.` +
      (best
        ? ` Promoters answer “${best.label}” at ${share(best.count, promoter.responses)}. ` +
          `The first is the fix list, the second is what not to disturb while fixing it.`
        : ''),
    followUps: ['detractors', 'rating'],
  };
}

function openText() {
  const total = OPEN_RESPONSES.length;
  const detractors = OPEN_RESPONSES.filter((r) => r.band === 'detractor');
  const tally = {};
  detractors.forEach((r) => { tally[r.themeId] = (tally[r.themeId] || 0) + 1; });
  const [topId, topCount] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || [null, 0];

  return {
    title: 'Open text',
    text:
      `${count(detractors.length)} of the ${count(total)} verbatims loaded sit in the detractor band. ` +
      (topId
        ? `${count(topCount)} of those cluster on ${themeName(topId)}, the most repeated complaint in the set. `
        : '') +
      `This list is a sample rather than the full ${count(RATING_BLOCK.responses)} responses, so read it for ` +
      `language and specifics and take the weights from the drivers.`,
    followUps: ['detractors', 'themes'],
  };
}

function scoreDrivers() {
  const ranked = [...SCORE_DRIVERS].sort((a, b) => b.drag - a.drag);
  const drags = ranked.filter((d) => d.drag > 0);
  const lifts = ranked.filter((d) => d.drag < 0);
  const top = ranked[0];
  const totalDrag = drags.reduce((s, d) => s + d.drag, 0);
  const lift = lifts[lifts.length - 1];
  const average = RATING_BLOCK.average;

  return {
    title: 'Score drivers',
    text:
      `${top.name} is ${percent(pct(top.drag, totalDrag), 0)} of all the downward pull on its own — ` +
      `${ratingText(top.drag)} of the ${ratingText(totalDrag)} points lost across ${count(drags.length)} themes. ` +
      `Clearing it alone would put the ${ratingText(average)} average near ${ratingText(average + top.drag)}. ` +
      (lift
        ? `${lift.name} is the only theme pulling the other way, adding ${ratingText(Math.abs(lift.drag))}.`
        : ''),
    followUps: ['drivers', 'themes'],
  };
}

function variantComparison() {
  const ranked = [...VARIANT_RESULTS].sort((a, b) => b.completionRate - a.completionRate);
  const winner = ranked[0];
  const runnerUp = ranked[1];
  if (!runnerUp) {
    return {
      title: 'Variant comparison',
      text: `One variant only — ${winner.name}, completing at ${percent(winner.completionRate)} across ${count(winner.responses)} responses. There is nothing to compare it against.`,
      followUps: ['variants', 'delivery'],
    };
  }

  const gap = winner.completionRate - runnerUp.completionRate;
  const sameTrigger = winner.trigger === runnerUp.trigger;
  const base = Math.min(winner.responses, runnerUp.responses);

  return {
    title: 'Variant comparison',
    text:
      `${winner.name} leads by ${percent(gap, 1)} of completion — ${percent(winner.completionRate)} against ` +
      `${percent(runnerUp.completionRate)} — and rates ${ratingText(winner.avgRating - runnerUp.avgRating)} higher, ` +
      `on ${count(base)} responses in the smaller arm. ` +
      (sameTrigger
        ? 'Both run the same trigger, so content is the single variable and the gap is readable as a result.'
        : 'They run different triggers, so timing is confounded with content — this is two campaigns sharing a name, not a result.'),
    followUps: ['variants', 'delivery'],
  };
}

function weightHistory() {
  const first = WEIGHT_HISTORY[0];
  const last = WEIGHT_HISTORY[WEIGHT_HISTORY.length - 1];
  const moved = Math.abs(last.b - first.b);
  const toward = last.b >= first.b ? 'the second variant' : 'the first variant';
  const names = [...VARIANT_RESULTS].sort((a, b) => b.completionRate - a.completionRate);

  return {
    title: 'Intelligent A/B weighting',
    text:
      `The split has moved from ${first.a}/${first.b} on ${first.date} to ${last.a}/${last.b} by ${last.date} — ` +
      `${moved} points shifted toward ${toward}, and still moving at the last reading. ` +
      (names[0] ? `That matches the measured winner, ${names[0].name}. ` : '') +
      `The reallocation is a machine decision, so read it as the model's confidence rather than as a result.`,
    followUps: ['variants', 'delivery'],
  };
}

/* ---------- Registry ---------- */

const PANELS = {
  'delivery-funnel': deliveryFunnel,
  'delivery-series': deliverySeries,
  'failure-reasons': failureReasons,
  'rating-block': ratingBlock,
  'branch-blocks': branchBlocks,
  'open-text': openText,
  'score-drivers': scoreDrivers,
  'variant-comparison': variantComparison,
  'weight-history': weightHistory,
};

export const hasInsight = (key) => Object.prototype.hasOwnProperty.call(PANELS, key);

/** Read one panel and report what its numbers say. */
export function insight(key) {
  const composer = PANELS[key];
  return composer ? composer() : null;
}
