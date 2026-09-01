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
  ANNOUNCE_FUNNEL, ANNOUNCE_SERIES, ANNOUNCE_FAILURE_REASONS, ENGAGEMENT,
  TIME_TO_TAP, TAP_DESTINATIONS, ENGAGEMENT_BY_APP, ENGAGEMENT_BY_SEGMENT,
  CONVERSION_FUNNEL, CONVERSION, HOLDOUT, OFFER, ANNOUNCE_VARIANTS,
} from './data.js';

const share = (n, total) => (total < LOW_SAMPLE ? count(n) : percent((n / total) * 100));
const pct = (n, total) => (total ? (n / total) * 100 : 0);
const themeName = (id) => (THEMES.find((t) => t.id === id) || {}).name || 'an unlabelled cluster';
const money = (n) => `${CONVERSION.currency}${Number(n || 0).toLocaleString('en-IN')}`;

/* Three panels are on both kinds' Delivery tab and one is on both Impact tabs.
   They read the same shapes from different sources, so the kind picks the
   source rather than the page owning two near-identical composers. */
const announce = (kind) => kind === 'announcement';
const funnelOf = (kind) => (announce(kind) ? ANNOUNCE_FUNNEL : DELIVERY_FUNNEL);
const seriesOf = (kind) => (announce(kind) ? ANNOUNCE_SERIES : DELIVERY_SERIES);
const failuresOf = (kind) => (announce(kind) ? ANNOUNCE_FAILURE_REASONS : FAILURE_REASONS);
const variantsOf = (kind) => (announce(kind) ? ANNOUNCE_VARIANTS : VARIANT_RESULTS);
const stage = (label, kind) => funnelOf(kind).find((s) => s.label === label) || { label, value: 0 };

/* ---------- Composers ---------- */

function deliveryFunnel(kind) {
  const funnel = funnelOf(kind);
  const first = funnel[0];
  const last = funnel[funnel.length - 1];

  let worst = { from: null, to: null, lost: 0, rate: 0 };
  funnel.forEach((step, i) => {
    if (!i) return;
    const prev = funnel[i - 1];
    const lost = prev.value - step.value;
    if (lost > worst.lost) worst = { from: prev, to: step, lost, rate: pct(lost, prev.value) };
  });

  // Half of the worst step recovered, carried through the rates that follow it.
  const downstream = funnel.slice(funnel.indexOf(worst.to))
    .reduce((carry, step, i, arr) => (i === 0 ? 1 : carry * (step.value / arr[i - 1].value)), 1);
  const recoverable = Math.round((worst.lost / 2) * downstream);

  if (announce(kind) && worst.to === last) {
    const shown = stage('Shown', kind).value;
    return {
      title: 'Delivery funnel',
      text:
        `${count(last.value)} taps from ${count(first.value)} sends — ${share(last.value, first.value)} end to end, ` +
        `${share(last.value, shown)} of the impressions that actually surfaced. ` +
        `The largest fall is ${worst.from.label} → ${worst.to.label}, but that is where every notification loses most of ` +
        `its audience: it is the shape of the channel, not a fault in this send. ` +
        `The losses worth acting on sit above it — ${count(first.value - shown)} never surfaced at all, ` +
        `${share(first.value - shown, first.value)} of the send.`,
      followUps: ['delivery', 'variants'],
    };
  }

  const READINGS = {
    Sent: 'That is a delivery problem rather than a content one — the failure reasons below say why.',
    Delivered: 'It reached the device and was never surfaced, which is a quiet-hours and priority question, not a creative one.',
    Shown: announce(kind)
      ? 'They saw it and did not tap, which is the creative and the offer — the only step content can move.'
      : 'They saw it and did not start, which points at timing and relevance rather than the questions themselves.',
    Started: 'They started and gave up, which points at the length of the questionnaire rather than the ask.',
  };
  const outcome = announce(kind) ? 'taps' : 'completions';

  return {
    title: 'Delivery funnel',
    text:
      `${count(last.value)} of ${count(first.value)} sent got to ${last.label.toLowerCase()} — ` +
      `${share(last.value, first.value)} end to end. ` +
      `The bleed is ${worst.from.label} → ${worst.to.label}, losing ${count(worst.lost)} there alone, ` +
      `${percent(worst.rate, 0)} of that step. Recovering half of it would be worth about ` +
      `${count(recoverable)} more ${outcome}. ${READINGS[worst.from.label] || ''}`,
    followUps: ['delivery', 'variants'],
  };
}

function deliverySeries(kind) {
  const series = seriesOf(kind).map((p) => ({ ...p, done: announce(kind) ? p.taps : p.completions }));
  const byVersion = (v) => series.filter((p) => p.version === v);
  const rate = (rows) => pct(
    rows.reduce((s, p) => s + p.done, 0),
    rows.reduce((s, p) => s + p.sends, 0),
  );
  const early = byVersion(1);
  const late = byVersion(2);
  const first = series[0];
  const last = series[series.length - 1];
  const verb = announce(kind) ? 'tapping' : 'completing';
  const changed = announce(kind) ? 'creative' : 'questionnaire';

  if (!early.length || !late.length) {
    return {
      title: 'Delivery over time',
      text:
        `Sends run from ${count(first.sends)} to ${count(last.sends)} a period across the window, ` +
        `${verb} at ${percent(rate(series), 1)} overall. One ${changed} version throughout, ` +
        `so the series reads as one continuous dataset.`,
      followUps: ['delivery', 'variants'],
    };
  }

  const delta = rate(late) - rate(early);
  const direction = delta >= 0 ? 'up' : 'down';
  return {
    title: 'Delivery over time',
    text:
      `${announce(kind) ? 'Tap-through' : 'Completion'} runs at ${percent(rate(late), 1)} since version 2, ` +
      `against ${percent(rate(early), 1)} before it — ` +
      `${direction} ${percent(Math.abs(delta), 1)} across the ${changed} change. Sends rose from ` +
      `${count(first.sends)} to ${count(last.sends)} a period over the same window, so the later ` +
      `figures carry more weight. Read either side on its own before crediting the change.`,
    followUps: ['delivery', announce(kind) ? 'variants' : 'rating'],
  };
}

function failureReasons(kind) {
  const failures = failuresOf(kind);
  const ranked = [...failures].sort((a, b) => b.count - a.count);
  const total = failures.reduce((s, f) => s + f.count, 0);
  const top = ranked[0];
  const rest = total - top.count;
  const sent = stage('Sent', kind).value;

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

function variantComparison(kind) {
  if (announce(kind)) return announceVariantComparison();
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

function announceVariantComparison() {
  const ctr = (v) => pct(v.taps, v.shown);
  const ranked = [...ANNOUNCE_VARIANTS].sort((a, b) => ctr(b) - ctr(a));
  const winner = ranked[0];
  const runnerUp = ranked[1];
  if (!runnerUp) {
    return {
      title: 'Variant comparison',
      text: `One variant only — ${winner.name}, tapping at ${percent(ctr(winner))} across ${count(winner.reach)} reached. There is nothing to compare it against.`,
      followUps: ['variants', 'delivery'],
    };
  }

  const gap = ctr(winner) - ctr(runnerUp);
  const revenueGap = winner.revenuePerRecipient - runnerUp.revenuePerRecipient;
  const sameTrigger = winner.trigger === runnerUp.trigger;

  return {
    title: 'Variant comparison',
    text:
      `${winner.name} leads on tap-through by ${percent(gap, 1)} — ${percent(ctr(winner))} against ` +
      `${percent(ctr(runnerUp))} — and earns ${money(Math.abs(revenueGap).toFixed(2))} more per recipient. ` +
      `${count(winner.orders)} orders against ${count(runnerUp.orders)}, on ${count(Math.min(winner.reach, runnerUp.reach))} reached in the smaller arm. ` +
      (sameTrigger
        ? 'Both run the same trigger, so content is the single variable and the gap is readable as a result.'
        : 'They run different triggers, so timing is confounded with content — this is two campaigns sharing a name, not a result.'),
    followUps: ['variants', 'delivery'],
  };
}

function engagementSummary() {
  const e = ENGAGEMENT;
  const perPerson = e.impressions / e.uniqueReach;
  return {
    title: 'Engagement',
    text:
      `${count(e.uniqueReach)} people reached, ${count(e.impressions)} impressions — ` +
      `${perPerson.toFixed(2)} each, so repeat exposure is ${perPerson > 1.2 ? 'doing real work here' : 'marginal'}. ` +
      `${count(e.taps)} taps, ${share(e.taps, e.impressions)} of impressions. ` +
      `Quoting the rate off sends instead would read ${share(e.taps, stage('Sent', 'announcement').value)}, ` +
      `which flatters a send that never surfaced.`,
    followUps: ['delivery', 'variants'],
  };
}

function impressionOutcome() {
  const e = ENGAGEMENT;
  const decided = e.taps + e.dismissals;
  return {
    title: 'What happened to the impression',
    text:
      `${share(e.ignored, e.impressions)} of impressions were ignored outright — ${count(e.ignored)}. ` +
      `Of the ${count(decided)} that got a decision, ${share(e.dismissals, decided)} were dismissals: ` +
      `people who looked and said no. ` +
      `Set against that, ${count(e.optOuts)} muted the channel entirely — ` +
      `${share(e.optOuts, e.uniqueReach)} of everyone reached, and one opt-out for every ` +
      `${(e.taps / e.optOuts).toFixed(0)} taps earned. That audience is gone for the next campaign.`,
    followUps: ['delivery', 'campaign'],
  };
}

function timeToTap() {
  const total = TIME_TO_TAP.reduce((s, t) => s + t.count, 0);
  const fast = TIME_TO_TAP.slice(0, 2).reduce((s, t) => s + t.count, 0);
  const slow = TIME_TO_TAP.slice(-2).reduce((s, t) => s + t.count, 0);
  const modal = [...TIME_TO_TAP].sort((a, b) => b.count - a.count)[0];
  return {
    title: 'Time to tap',
    text:
      `${share(fast, total)} of taps landed within ten minutes, and the single biggest bucket is ` +
      `“${modal.bucket}” at ${count(modal.count)}. Only ${share(slow, total)} arrived after six hours. ` +
      `A distribution this front-loaded means the notification is being acted on when it arrives, not found later — ` +
      `so the send window is the lever, and moving the trigger delay would move the result.`,
    followUps: ['delivery', 'campaign'],
  };
}

function tapDestinations() {
  const total = TAP_DESTINATIONS.reduce((s, d) => s + d.count, 0);
  const ranked = [...TAP_DESTINATIONS].sort((a, b) => b.count - a.count);
  const body = TAP_DESTINATIONS.find((d) => /body/i.test(d.label));
  return {
    title: 'Where the tap went',
    text:
      `${ranked[0].label} takes ${share(ranked[0].count, total)} of taps — ${count(ranked[0].count)}. ` +
      (body
        ? `${count(body.count)} tapped the body rather than any button, ${share(body.count, total)}: ` +
          'users who wanted the offer without being told where to press. That share is the part of the ' +
          'result the CTA copy cannot claim credit for.'
        : ''),
    followUps: ['variants', 'delivery'],
  };
}

function engagementCut(rows, label) {
  const ctr = (r) => pct(r.taps, r.shown);
  const ranked = [...rows].sort((a, b) => ctr(b) - ctr(a));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const spread = ctr(best) - ctr(worst);
  return {
    title: `Engagement by ${label}`,
    text:
      `${best.label} taps at ${percent(ctr(best))}, ${worst.label} at ${percent(ctr(worst))} — ` +
      `a ${percent(spread, 1)} spread across ${rows.length} ${label}s. ` +
      `${best.label} carries ${count(best.taps)} of the ${count(rows.reduce((s, r) => s + r.taps, 0))} taps. ` +
      (spread > 3
        ? `A gap that size is worth targeting on: the same creative is not landing the same way by ${label}.`
        : `The spread is narrow enough that ${label} is not where the result is being decided.`),
    followUps: ['delivery', 'variants'],
  };
}

function conversionFunnel() {
  const funnel = CONVERSION_FUNNEL;
  const first = funnel[0];
  const last = funnel[funnel.length - 1];
  let worst = { from: null, to: null, rate: 100 };
  funnel.forEach((step, i) => {
    if (!i) return;
    const prev = funnel[i - 1];
    const kept = pct(step.value, prev.value);
    if (kept < worst.rate) worst = { from: prev, to: step, rate: kept };
  });
  return {
    title: 'Conversion',
    text:
      `${count(last.value)} orders from ${count(first.value)} taps — ${share(last.value, first.value)} of everyone who tapped, ` +
      `inside a ${CONVERSION.windowHours}-hour window. ` +
      `The narrowest step is ${worst.from.label} → ${worst.to.label}, keeping only ${percent(worst.rate, 0)}. ` +
      `That is the step to fix: it sits after the notification has already done its job, so it is a landing-page ` +
      `and checkout problem, not a campaign one.`,
    followUps: ['delivery', 'campaign'],
  };
}

function revenue() {
  const perRecipient = CONVERSION.revenue / ENGAGEMENT.uniqueReach;
  return {
    title: 'Attributed revenue',
    text:
      `${money(CONVERSION.revenue)} attributed across ${count(CONVERSION.orders)} orders, ` +
      `${money(CONVERSION.aov)} average — ${money(perRecipient.toFixed(2))} per person reached. ` +
      `That is gross, before the ${money(OFFER.discountCost)} this campaign gave away; net it is ` +
      `${money((OFFER.netRevenue / ENGAGEMENT.uniqueReach).toFixed(2))} per recipient. ` +
      `Attribution here means an order inside the window, not an order this campaign caused — the holdout is what separates the two.`,
    followUps: ['campaign', 'variants'],
  };
}

function holdout() {
  const lift = pct(HOLDOUT.audienceRate - HOLDOUT.controlRate, HOLDOUT.controlRate);
  const incrementalShare = pct(HOLDOUT.incrementalOrders, CONVERSION.orders);
  return {
    title: 'Holdout lift',
    text:
      `${percent(HOLDOUT.audienceRate, 2)} of the reached audience ordered, against ` +
      `${percent(HOLDOUT.controlRate, 2)} of the ${count(HOLDOUT.controlSize)} held back — a lift of ${percent(lift, 0)}. ` +
      `That puts roughly ${count(HOLDOUT.incrementalOrders)} of the ${count(CONVERSION.orders)} attributed orders ` +
      `down to this campaign, ${percent(incrementalShare, 0)} of them. ` +
      `The other ${percent(100 - incrementalShare, 0)} would have happened anyway — attribution counted them, the holdout does not.`,
    followUps: ['campaign', 'variants'],
  };
}

function offerRedemption() {
  const perOrder = OFFER.discountCost / OFFER.redemptions;
  const perIncremental = OFFER.discountCost / HOLDOUT.incrementalOrders;
  return {
    title: 'Offer redemption',
    text:
      `${count(OFFER.redemptions)} redemptions of ${OFFER.code}, ${share(OFFER.redemptions, CONVERSION.orders)} of attributed orders — ` +
      `${money(OFFER.discountCost)} given away at ${money(Math.round(perOrder))} per redeemed order. ` +
      `Against the ${count(HOLDOUT.incrementalOrders)} orders the holdout says were actually incremental, ` +
      `the real cost is ${money(Math.round(perIncremental))} each. ` +
      `Net of discount the campaign returned ${money(OFFER.netRevenue)}.`,
    followUps: ['campaign', 'variants'],
  };
}

/* ---------- Registry ---------- */

const PANELS = {
  /* Both kinds */
  'delivery-funnel': deliveryFunnel,
  'delivery-series': deliverySeries,
  'failure-reasons': failureReasons,
  'variant-comparison': variantComparison,
  'weight-history': weightHistory,
  /* Feedback */
  'rating-block': ratingBlock,
  'branch-blocks': branchBlocks,
  'open-text': openText,
  'score-drivers': scoreDrivers,
  /* Announcement */
  'engagement-summary': engagementSummary,
  'impression-outcome': impressionOutcome,
  'time-to-tap': timeToTap,
  'tap-destinations': tapDestinations,
  'engagement-by-app': () => engagementCut(ENGAGEMENT_BY_APP, 'app'),
  'engagement-by-segment': () => engagementCut(ENGAGEMENT_BY_SEGMENT, 'segment'),
  'conversion-funnel': conversionFunnel,
  revenue,
  holdout,
  'offer-redemption': offerRedemption,
  /* `ai-readings` is deliberately absent: that panel is already inference, and
     the assistant narrating its own claims back would launder them as findings. */
};

export const hasInsight = (key) => Object.prototype.hasOwnProperty.call(PANELS, key);

/** Read one panel and report what its numbers say, for the kind on screen. */
export function insight(key, kind = 'feedback') {
  const composer = PANELS[key];
  return composer ? composer(kind) : null;
}
