/* ==========================================================================
   assistant-explain.js — "how do I read this?"

   The inverse of clicky's pointing. Clicky has the assistant point at the UI;
   here the user points and the assistant explains. Each entry teaches how to
   read one widget: what the numbers are counted against, what the colour
   encodes, and the misreading the chart invites if you skim it.

   These are static — a widget's grammar does not change with the data — which
   is the one place in this assistant where fixed prose is the correct answer.
   Live figures come from the follow-up intents each entry hands off to.
   ========================================================================== */

const EXPLANATIONS = {
  'delivery-funnel': {
    title: 'Delivery funnel',
    text:
      'Four stages, in absolute counts. The line under each figure is conversion from the step ' +
      'directly before it — not from Sent — so 85% on Completed means 85% of Started, not 85% of ' +
      '41,200; Completed also carries its share of Sent, the one end-to-end rate here. The step ' +
      'flagged in red is the single worst one, which is the one worth fixing. Read this for where ' +
      'people fall out, never for one headline rate.',
    followUps: ['delivery', 'variants'],
  },

  'delivery-series': {
    title: 'Delivery over time',
    text:
      'One stacked bar per send date. The solid segment is completions; the pale segment above it is ' +
      'sends that never completed, so full bar height is sends. Hover a column for exact figures. ' +
      'The dashed vertical rule marks where version 2 of the questionnaire begins — an average ' +
      'spanning it mixes two different questions, so filter to a single version before comparing sides.',
    followUps: ['delivery', 'variants'],
  },

  'failure-reasons': {
    title: 'Failure reasons',
    text:
      'Why sends never reached a device, ranked by volume. The share is of failed sends, not of all ' +
      'sends — these rows sum to the failures, not to the 41,200 sent. The bars are deliberately grey: ' +
      'these are counts, not sentiment, so they stay out of the rating ramp where colour carries meaning.',
    followUps: ['delivery', 'campaign'],
  },

  'rating-block': {
    title: 'The rating question',
    text:
      'The campaign’s single rating element — there is no secondary or composite score. Mean and ' +
      'response count sit top right; below is one row per point on the scale. Bar colour follows the ' +
      'rating ramp, red at the low end through to emerald at the high, so a colour means the same ' +
      'thing here as on every other surface. Read the shape, not just the mean: a 6.8 split between ' +
      'two clusters is a different problem from a 6.8 bunched in the middle.',
    followUps: ['rating', 'detractors'],
  },

  'branch-blocks': {
    title: 'Follow-up by rating band',
    text:
      'The follow-up question, reported once per rating band. Each path is counted only within its own ' +
      'band and never pooled — detractors and promoters were asked different questions, so a combined ' +
      'total would be meaningless. Compare down a column, not across them.',
    followUps: ['rating', 'detractors'],
  },

  'open-text': {
    title: 'Open text',
    text:
      'Individual verbatims, each traceable to one respondent’s full answer set. Click a row for the ' +
      'whole set plus order context. Band, theme and search filters all narrow this list, and the ' +
      'counts move with them — check what is active before quoting a number from here.',
    followUps: ['detractors', 'themes'],
  },

  'score-drivers': {
    title: 'Score drivers',
    text:
      'Every theme ranked by how far it pulls the overall average down. Score drag is the column that ' +
      'matters: points off the mean attributable to that theme, red when it drags and emerald when it ' +
      'lifts. The low ↔ high bar is the band split inside the theme — red share left, emerald right, ' +
      'grey in the middle. Share is of all responses, so the shares do not sum to 100%.',
    followUps: ['drivers', 'themes'],
  },

  'variant-comparison': {
    title: 'Variant comparison',
    text:
      'The variants side by side with weight, completion, mean rating and volume. Content is only the ' +
      'single variable between them if both run the same trigger — when they do not, the card is ' +
      'flagged "Not like-for-like" and you are reading two campaigns that share a name, not an A/B result.',
    followUps: ['variants', 'delivery'],
  },

  'weight-history': {
    title: 'Intelligent A/B weighting',
    text:
      'How the traffic split moved over time as the model shifted weight toward the better performer. ' +
      'Violet because the reallocation is a machine decision rather than a measurement — the ' +
      'completion rates it acted on are in the comparison above.',
    followUps: ['variants', 'delivery'],
  },
};

export const hasExplanation = (key) => Object.prototype.hasOwnProperty.call(EXPLANATIONS, key);

/** Look up one widget's reading guide. */
export function explain(key) {
  const entry = EXPLANATIONS[key];
  if (!entry) return null;
  return { title: entry.title, text: entry.text, followUps: entry.followUps };
}
