/* ==========================================================================
   data.js — seeded prototype data.
   Rewritten against the current PRD revision: a single generic app-experience
   rating replaces the split food-quality / delivery-experience pair
   (FR-74, FR-79, FR-99, FR-106, FR-107; OD-20 moot).
   ========================================================================== */
import { minutesAgo } from './core.js';

/* ---------- Step 1 — "start from" a campaign goal (FR-5, FR-7) ----------
   A card carries a name and one line saying what the goal is for, and nothing
   else. It used to also spell out which defaults the goal sets — the templates
   it activates, the rating element, the channel — which is an accurate list and
   the wrong thing to read while choosing. Nobody picks between three goals by
   comparing nine settings they have not met yet, and every one of those
   settings is shown, in context and editable, on the step that owns it. So the
   card answers the only question being asked here: which of these is my
   campaign? The defaults still happen; they are just no longer a wall of
   configuration in front of a one-click choice. */
export const GOALS = [
  {
    id: 'user-feedback',
    name: 'User Feedback',
    icon: 'thumbs',
    kind: 'feedback',
    summary: 'Ask users how a recent experience went.',
  },
  {
    id: 'sale-push',
    name: 'Sale Push Notification',
    icon: 'megaphone',
    kind: 'announcement',
    summary: 'Announce an offer to a chosen group of users.',
  },
  {
    id: 'churn-rate',
    name: 'Churn Rate',
    icon: 'chart',
    kind: 'feedback',
    summary: 'Find out why users stopped coming back.',
  },
];

/* ---------- Step 1 — the campaign objective ----------
   Free text, and the only field in the wizard that configures nothing. Every
   other answer changes what gets sent; this one records *why* the campaign
   exists, which a goal id, a trigger and an audience cannot say between them.
   The assistant reads it verbatim (`assistant-answers.js`), and so does the
   next person to open the draft.

   The starters are one-click first drafts, keyed to the goal already picked —
   a blank essay box on step 1 is the fastest way to collect "asdf". Keep them
   to two plain sentences: they are read at a glance and then typed over, and a
   starter longer than the box is one nobody reads before overwriting it. */
export const OBJECTIVE_STARTERS = {
  'user-feedback': [
    { label: 'Diagnose a drop',
      text: 'Repeat orders in Bandra dropped 8% after the March update. Find out whether users blame the new tracking screen or the delivery time.' },
    { label: 'Validate a change',
      text: 'Check whether the new order-tracking screen made the wait feel shorter for weekly users, and whether first-time users noticed at all.' },
  ],
  'sale-push': [
    { label: 'Drive a sale',
      text: 'Bring lapsed users in Delhi NCR back during the monsoon sale, and find out what moves them — free delivery or a flat discount.' },
    { label: 'Announce a launch',
      text: 'Tell repeat users that scheduled ordering is live, and find out within a week whether the announcement is what got them to try it.' },
  ],
  'churn-rate': [
    { label: 'Understand churn',
      text: 'Find out why weekly users stop ordering after about three weeks, and whether they blame price, reliability or the app.' },
    { label: 'Test a win-back',
      text: 'Find out whether lapsed users would come back for faster delivery or for a discount, before we build an offer around either one.' },
  ],
  default: [
    { label: 'Diagnose a drop',
      text: 'A number dropped and we do not know why. Find out what changed for the users behind it, in their words.' },
    { label: 'Understand a segment',
      text: 'Find out what one group of users expects from the app, so the next release is built on what they said.' },
  ],
};

/** Signals behind the goal suggestion under the objective field
    (`suggestGoalFromObjective()` in store.js). A word list, not a model:
    it is offered as a reading and never applied on its own. */
export const OBJECTIVE_SIGNALS = [
  // Each entry is matched as a substring, so 'lapse' covers lapsed and lapsing
  // and 'stop' covers stopped. Words general enough to appear in any objective
  // are left out on purpose — 'experience' matched everything and read every
  // campaign as User Feedback, which is a suggestion that says nothing.
  { goal: 'churn-rate', words: ['churn', 'lapse', 'stop', 'no longer', 'drop off', 'win back', 'win-back', 'winback', 'come back', 'came back', 'inactive', 'dormant', 'uninstall', 'retention', 'retain'] },
  { goal: 'sale-push', words: ['sale', 'offer', 'discount', 'promo', 'coupon', 'cashback', 'deal', 'announce', 'announcement', 'launch', 'campaign push', 'notification about'] },
  { goal: 'user-feedback', words: ['feedback', 'rating', 'nps', 'csat', 'satisfaction', 'satisfied', 'complaint', 'complain', 'survey', 'sentiment', 'verbatim', 'what users think', 'what users say', 'in their words'] },
];

/* ---------- Campaign kind ----------
   A campaign's kind is *derived* from the goal it was started from, never set
   as a second field the user has to keep in sync. It decides the tab set, the
   funnel's terminal step, the headline metric, and whether the rating ramp
   appears at all — a Sale Push has no rating, so a ramp on that screen would be
   a legend for nothing.
   ------------------------------------------------------------------------- */
export const KINDS = ['feedback', 'announcement'];
export const KIND_LABEL = { feedback: 'Feedback', announcement: 'Announcement' };

const GOAL_KIND = Object.fromEntries(GOALS.map((g) => [g.id, g.kind]));

/** Feedback is the fallback: it is the goal every pre-kind campaign was. */
export const campaignKind = (c) => GOAL_KIND[c && c.goal] || 'feedback';
export const isFeedback = (c) => campaignKind(c) === 'feedback';

/* ---------- Step 4 — template categories and components (FR-26 … FR-29) ---------- */
export const TEMPLATE_CATEGORIES = [
  { id: 'basic', label: 'Basic Templates' },
  { id: 'ratings', label: 'Ratings Templates' },
  { id: 'lead-gen', label: 'Lead Generation Templates' },
  { id: 'custom-html', label: 'Custom HTML Templates' },
];

export const CHANNELS = [
  { id: 'push', label: 'Push notification', apps: ['android', 'ios'], icon: 'send',
    note: 'Reaches users outside the app. Cannot carry rating or text input.' },
  { id: 'in-app', label: 'In-app message', apps: ['android', 'ios'], icon: 'layout',
    note: 'Shown during a session. Supports every element in the library.' },
  { id: 'web', label: 'On-site / web', apps: ['web'], icon: 'external',
    note: 'Renders on your site or in a web view.' },
];

/** `supports` drives FR-29 — elements a component cannot render never appear. */
export const TEMPLATES = [
  { id: 'TPL-1041', name: 'Cover', group: 'Content with image notifications', category: 'basic', channels: ['push', 'in-app'], supports: ['image'], preview: 'content-image' },
  { id: 'TPL-1042', name: 'Half-Interstitial', group: 'Content with image notifications', category: 'basic', channels: ['push', 'in-app', 'web'], supports: ['image'], preview: 'content-image' },
  { id: 'TPL-1043', name: 'Interstitial', group: 'Image only notifications', category: 'basic', channels: ['in-app', 'web'], supports: ['image'], preview: 'image-only' },
  { id: 'TPL-1044', name: 'Header', group: 'Image only notifications', category: 'basic', channels: ['push', 'in-app'], supports: ['image'], preview: 'image-only' },
  { id: 'TPL-2010', name: 'Half-Interstitial', group: 'Rating with follow-up questions', category: 'ratings', channels: ['in-app', 'web'], supports: ['nps', 'star', 'mcq', 'text', 'thumbs', 'image'], preview: 'rating' },
  { id: 'TPL-2011', name: 'Interstitial', group: 'Rating with follow-up questions', category: 'ratings', channels: ['in-app', 'web'], supports: ['nps', 'star', 'mcq', 'text', 'thumbs', 'image'], preview: 'rating' },
  { id: 'TPL-2012', name: 'Footer', group: 'Single question notifications', category: 'ratings', channels: ['in-app', 'web'], supports: ['nps', 'star', 'thumbs'], preview: 'rating' },
  { id: 'TPL-2013', name: 'Alert', group: 'Single question notifications', category: 'ratings', channels: ['push', 'in-app'], supports: ['thumbs', 'star'], preview: 'rating' },
  { id: 'TPL-3005', name: 'Interstitial', group: 'Form notifications', category: 'lead-gen', channels: ['in-app', 'web'], supports: ['text', 'mcq', 'image'], preview: 'form' },
  { id: 'TPL-3006', name: 'Half-Interstitial', group: 'Form notifications', category: 'lead-gen', channels: ['in-app', 'web'], supports: ['text', 'mcq'], preview: 'form' },
  { id: 'TPL-4001', name: 'Cover', group: 'Custom markup', category: 'custom-html', channels: ['in-app', 'web'], supports: ['image', 'text', 'mcq', 'nps', 'star', 'thumbs'], preview: 'html' },
];

/* ---------- FR-36 — the element library ---------- */
export const ELEMENTS = [
  { type: 'image', name: 'Image', icon: 'image', description: 'A single media slot.' },
  { type: 'thumbs', name: 'Thumbs up / down', icon: 'thumbs', description: 'Binary reaction, no branching.' },
  { type: 'nps', name: 'NPS rating', icon: 'target', description: '1–5 or 1–10 scale with optional branching.' },
  { type: 'star', name: 'Star rating', icon: 'star', description: '5-point scale, branching always on.' },
  { type: 'mcq', name: 'Multiple choice', icon: 'list', description: 'Editable question with labelled choices.' },
  { type: 'text', name: 'Text field', icon: 'type', description: 'Open-ended written answer.' },
];

export const TRIGGER_EVENTS = [
  'order_delivered', 'order_cancelled', 'app_opened',
  'checkout_completed', 'support_ticket_closed', 'subscription_lapsed',
];

/* ---------- FR-51 — saved test accounts ---------- */
export const TEST_ACCOUNTS = [
  { id: 'ta_1', label: 'prashant@quickeats.in (QA Android)' },
  { id: 'ta_2', label: 'devika@quickeats.in (QA iOS)' },
  { id: 'ta_3', label: 'growth-bot@quickeats.in (Web)' },
];

/* ---------- Step 3 — audience (FR-12 … FR-17) ---------- */
export const SEGMENTS = [
  { id: 'seg_new', name: 'New', rule: 'First order placed in the last 30 days · 0 prior orders', size: 48210, userCreated: false },
  { id: 'seg_repeat', name: 'Repeat', rule: '2 or more orders placed lifetime', size: 192480, userCreated: false },
  { id: 'seg_loyal', name: 'Loyal', rule: '8 or more orders in the last 90 days', size: 61034, userCreated: false },
  { id: 'seg_bandra_lapsed', name: 'Bandra · lapsed 21d', rule: 'City is Mumbai · Area is Bandra · No order in 21 days', size: 7412, userCreated: true },
];

export const EXCLUSION_LISTS = [
  { id: 'ex_optout', name: 'Feedback opt-outs', kind: 'list', size: 12903 },
  { id: 'ex_recent', name: 'Surveyed in last 14 days', kind: 'list', size: 34110 },
  { id: 'ex_internal', name: 'Internal & test accounts', kind: 'list', size: 214 },
  { id: 'ex_loyal', name: 'Loyal', kind: 'segment', size: 61034 },
];

export const RULE_FIELDS = [
  'Orders lifetime', 'Orders last 30 days', 'Days since last order',
  'City', 'Area', 'Average order value', 'App version',
];
export const RULE_OPERATORS = ['is', 'is not', 'is greater than', 'is less than', 'is between'];

/* ---------- Dashboard seed (FR-71 … FR-85) ---------- */
export const SEED_CAMPAIGNS = [
  {
    id: 'c1', campaignId: 'CMP-4821', name: 'Post-delivery feedback · Bandra',
    goal: 'user-feedback', channel: 'in-app',
    status: 'Live', triggerLabel: 'order_delivered + 20 min', divergentTriggers: false,
    responses: 18422, avgRating: 6.8, ratingElement: 'nps', ratingScaleMax: 10,
    updatedAt: minutesAgo(4), versions: 2, type: 'ab',
    audienceLabel: 'Repeat · excl. Surveyed in last 14 days', runningDates: '12 Jul 2026 — running',
    objective: 'Repeat orders in Bandra dropped 8% after the March update. Find out whether users blame the new tracking screen or the delivery time.',
  },
  {
    id: 'c2', campaignId: 'CMP-4770', name: 'Repeat-order drop diagnostic',
    goal: 'user-feedback', channel: 'in-app',
    status: 'Completed', triggerLabel: 'order_delivered + 2 hour', divergentTriggers: false,
    responses: 9204, avgRating: 4.1, ratingElement: 'star', ratingScaleMax: 5,
    updatedAt: minutesAgo(60 * 26), versions: 1, type: 'regular',
    audienceLabel: 'All users', runningDates: '02 Jun 2026 — 30 Jun 2026',
    objective: 'Understand why second orders dropped off across every city at once, and whether the cause is the app, the price or the wait.',
  },
  {
    id: 'c3', campaignId: 'CMP-4903', name: 'Churn win-back · lapsed 21d',
    goal: 'churn-rate', channel: 'in-app',
    status: 'Paused', triggerLabel: 'multiple triggers', divergentTriggers: true,
    responses: 1348, avgRating: 3.4, ratingElement: 'nps', ratingScaleMax: 10,
    updatedAt: minutesAgo(60 * 5), versions: 3, type: 'intelligent-ab',
    audienceLabel: 'Bandra · lapsed 21d', runningDates: '18 Aug 2026 — running',
    objective: 'Find out whether users who lapsed at 21 days would return for faster delivery rather than a discount, before we build a win-back offer around either one.',
  },
  {
    id: 'c4', campaignId: 'CMP-4950', name: 'Monsoon offer announcement',
    goal: 'sale-push', channel: 'push',
    status: 'Scheduled', triggerLabel: 'app_opened + 0 min', divergentTriggers: false,
    responses: 0, avgRating: 0, ratingElement: 'nps', ratingScaleMax: 10,
    updatedAt: minutesAgo(95), versions: 1, type: 'regular',
    reach: 0,
    audienceLabel: 'New · Repeat', runningDates: 'Starts 04 Sep 2026', resumeStep: 5,
    objective: 'Announce the monsoon offer to users who already order in the rain, and learn which framing moves them without discounting the whole menu.',
  },
  {
    id: 'c5', campaignId: 'CMP-4961', name: 'Rider experience pulse',
    goal: 'user-feedback', channel: 'in-app',
    status: 'Draft', triggerLabel: 'order_delivered + 45 min', divergentTriggers: false,
    responses: 0, avgRating: 0, ratingElement: 'nps', ratingScaleMax: 10,
    updatedAt: minutesAgo(46), versions: 1, type: 'regular',
    audienceLabel: 'Repeat', runningDates: 'Not scheduled', resumeStep: 4,
    objective: '',
  },
  {
    id: 'c6', campaignId: 'CMP-4612', name: 'Packaging quality check',
    goal: 'user-feedback', channel: 'in-app',
    status: 'Stopped', triggerLabel: 'order_delivered + 1 hour', divergentTriggers: false,
    responses: 74, avgRating: 2.9, ratingElement: 'star', ratingScaleMax: 5,
    updatedAt: minutesAgo(60 * 24 * 14), versions: 2, type: 'regular',
    audienceLabel: 'Loyal', runningDates: '01 May 2026 — 22 May 2026',
    objective: 'Check whether the new packaging survived the trip, from the users most likely to notice that it did not.',
  },
  {
    id: 'c7', campaignId: 'CMP-4884', name: 'Weekend flash sale · 40% off',
    goal: 'sale-push', channel: 'push',
    status: 'Completed', triggerLabel: 'app_opened + 0 min', divergentTriggers: false,
    // An announcement collects no responses. `responses: 0` would read as a
    // measured zero; the row renders "—" off the kind instead, and `reach` is
    // the headline this campaign actually has.
    responses: 0, reach: 96400, avgRating: 0,
    updatedAt: minutesAgo(60 * 24 * 6), versions: 1, type: 'ab',
    audienceLabel: 'Repeat · Loyal · excl. Feedback opt-outs',
    runningDates: '22 Aug 2026 — 25 Aug 2026',
    objective: 'Move weekend order volume with a short, deep discount, and find out whether free delivery or a flat percentage brings people back — so the next sale can be cheaper than this one.',
  },
];

/* ==========================================================================
   Insights seed — scoped to CMP-4821, a 1–10 NPS A/B campaign spanning
   two versions.
   ========================================================================== */

/* FR-95 */
export const DELIVERY_FUNNEL = [
  { label: 'Sent', value: 41200 },
  { label: 'Shown', value: 33860 },
  { label: 'Started', value: 21740 },
  { label: 'Completed', value: 18422 },
];

/* FR-96 / FR-93 — the version boundary falls between 27 Jul and 30 Jul. */
export const DELIVERY_SERIES = [
  { date: '12 Jul', sends: 2100, completions: 880, version: 1 },
  { date: '15 Jul', sends: 2980, completions: 1240, version: 1 },
  { date: '18 Jul', sends: 3240, completions: 1410, version: 1 },
  { date: '21 Jul', sends: 3110, completions: 1330, version: 1 },
  { date: '24 Jul', sends: 3460, completions: 1520, version: 1 },
  { date: '27 Jul', sends: 3390, completions: 1470, version: 1 },
  { date: '30 Jul', sends: 3620, completions: 1610, version: 2 },
  { date: '02 Aug', sends: 3710, completions: 1780, version: 2 },
  { date: '05 Aug', sends: 3540, completions: 1690, version: 2 },
  { date: '08 Aug', sends: 3880, completions: 1900, version: 2 },
  { date: '11 Aug', sends: 3960, completions: 1970, version: 2 },
  { date: '14 Aug', sends: 4210, completions: 2120, version: 2 },
];

/* FR-97 */
export const FAILURE_REASONS = [
  { reason: 'Push permission opted out', count: 4120 },
  { reason: 'Device token invalid', count: 1880 },
  { reason: 'App uninstalled', count: 940 },
  { reason: 'Suppressed by exclusion list', count: 400 },
];

/* FR-99 — one rating block. No secondary or composite rating exists. */
export const RATING_BLOCK = {
  id: 'q1-experience',
  question: 'How would you rate your experience with the app?',
  element: 'nps',
  scaleMax: 10,
  average: 6.8,
  responses: 18422,
  distribution: [
    { score: 1, count: 620 }, { score: 2, count: 810 }, { score: 3, count: 1180 },
    { score: 4, count: 1340 }, { score: 5, count: 1610 }, { score: 6, count: 1970 },
    { score: 7, count: 2410 }, { score: 8, count: 3120 }, { score: 9, count: 2960 },
    { score: 10, count: 2402 },
  ],
};

/* FR-100 — each branch's follow-up read within its own path. */
export const BRANCH_BLOCKS = [
  {
    id: 'q2-detractor', question: 'Which areas can we improve?', band: 'detractor', responses: 2610,
    options: [
      { label: 'App is slow or crashes', count: 1010 },
      { label: 'Order tracking is wrong', count: 720 },
      { label: 'Too many steps to reorder', count: 520 },
      { label: 'Support never resolved it', count: 360 },
    ],
  },
  {
    id: 'q2-passive', question: 'What would have made this a great experience?', band: 'passive', responses: 7330,
    options: [
      { label: 'Faster, more reliable app', count: 3240 },
      { label: 'Clearer status updates', count: 2410 },
      { label: 'Better offers', count: 1680 },
    ],
  },
  {
    id: 'q2-promoter', question: 'How satisfied are you with the app?', band: 'promoter', responses: 8482,
    options: [
      { label: 'Very satisfied', count: 5020 },
      { label: 'Satisfied', count: 2650 },
      { label: 'It was fine', count: 812 },
    ],
  },
];

/* FR-101 / FR-102 — open text, each traceable to one respondent's answer set.

   `id` identifies the response; `userId` identifies the person who left it,
   and the two are not the same thing. The response ID answers "which answer
   is this"; the user ID answers "have we heard from them before" — r_9001 and
   r_9009 carry the same `usr_7f3c91a4`, which is one repeat customer
   complaining twice, three days apart, and is invisible without it.

   OD-22 is unchanged by adding it: the user ID is an opaque workspace handle
   that the console can join on, never a name, an email or a phone number. */
export const OPEN_RESPONSES = [
  {
    id: 'r_9001', userId: 'usr_7f3c91a4', rating: 3, band: 'detractor', segment: 'Repeat', variant: 'Coupon-led ask',
    version: 2, at: '14 Aug 2026, 20:42', themeId: 'th_tracking',
    text: 'Tracking said the rider was two minutes away for twenty minutes. I refreshed the app six times.',
    context: 'Order #QE-882401 · ₹640 · Bandra West · Android 14',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '3 / 10' },
      { question: 'Which areas can we improve?', answer: 'Order tracking is wrong' },
      { question: 'What can be done better?', answer: 'Tracking said the rider was two minutes away for twenty minutes.' },
    ],
  },
  {
    id: 'r_9002', userId: 'usr_2b8e40d7', rating: 2, band: 'detractor', segment: 'Loyal', variant: 'Plain ask',
    version: 2, at: '14 Aug 2026, 19:10', themeId: 'th_performance',
    text: 'App froze on the payment screen and I had to force close it twice before the order went through.',
    context: 'Order #QE-882119 · ₹1,120 · Khar · iOS 18',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '2 / 10' },
      { question: 'Which areas can we improve?', answer: 'App is slow or crashes' },
      { question: 'What can be done better?', answer: 'App froze on the payment screen.' },
    ],
  },
  {
    id: 'r_9003', userId: 'usr_c15a9e02', rating: 8, band: 'promoter', segment: 'Repeat', variant: 'Coupon-led ask',
    version: 2, at: '13 Aug 2026, 21:05', themeId: 'th_reorder',
    text: 'Reordering is quick once you find it, but it is buried three taps deep under the account tab.',
    context: 'Order #QE-880932 · ₹430 · Santacruz · Android 13',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '8 / 10' },
      { question: 'How satisfied are you with the app?', answer: 'Satisfied' },
      { question: 'What can be done better?', answer: 'Put reorder on the home screen.' },
    ],
  },
  {
    id: 'r_9004', userId: 'usr_9d47b613', rating: 1, band: 'detractor', segment: 'New', variant: 'Plain ask',
    version: 1, at: '28 Jul 2026, 13:48', themeId: 'th_onboarding',
    text: 'Signing up asked for my address three separate times and then lost it at checkout.',
    context: 'Order #QE-861204 · ₹520 · Andheri · Android 13',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '1 / 10' },
      { question: 'Which areas can we improve?', answer: 'Too many steps to reorder' },
      { question: 'What can be done better?', answer: 'Stop asking for the address repeatedly.' },
    ],
  },
  {
    id: 'r_9005', userId: 'usr_4e0f82ca', rating: 10, band: 'promoter', segment: 'Loyal', variant: 'Coupon-led ask',
    version: 2, at: '13 Aug 2026, 12:20', themeId: 'th_praise',
    text: 'Honestly the smoothest food app I use. Live map is accurate and payments never fail.',
    context: 'Order #QE-880114 · ₹890 · Bandra East · iOS 18',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '10 / 10' },
      { question: 'How satisfied are you with the app?', answer: 'Very satisfied' },
      { question: 'What can be done better?', answer: 'Nothing, keep it up.' },
    ],
  },
  {
    id: 'r_9006', userId: 'usr_a6913b58', rating: 5, band: 'passive', segment: 'Repeat', variant: 'Plain ask',
    version: 2, at: '12 Aug 2026, 22:31', themeId: 'th_updates',
    text: 'Order was late in the rain, which is fine, but the app never told me. I found out by opening it.',
    context: 'Order #QE-879001 · ₹710 · Bandra West · Android 14',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '5 / 10' },
      { question: 'What would have made this a great experience?', answer: 'Clearer status updates' },
      { question: 'What can be done better?', answer: 'Push me an update when the ETA slips.' },
    ],
  },
  {
    id: 'r_9007', userId: 'usr_18cd7f26', rating: 6, band: 'passive', segment: 'Loyal', variant: 'Coupon-led ask',
    version: 2, at: '11 Aug 2026, 20:02', themeId: 'th_support',
    text: 'Raised a missing-item complaint in the app and the chat closed itself twice before anyone replied.',
    context: 'Order #QE-877620 · ₹360 · Khar · iOS 17',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '6 / 10' },
      { question: 'What would have made this a great experience?', answer: 'Clearer status updates' },
      { question: 'What can be done better?', answer: 'Keep the support chat open until it is resolved.' },
    ],
  },
  {
    id: 'r_9008', userId: 'usr_bb52e9a1', rating: 9, band: 'promoter', segment: 'New', variant: 'Plain ask',
    version: 1, at: '24 Jul 2026, 19:44', themeId: 'th_praise',
    text: 'First order and everything just worked. Nice that it remembered my card without nagging.',
    context: 'Order #QE-858330 · ₹480 · Juhu · Android 13',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '9 / 10' },
      { question: 'How satisfied are you with the app?', answer: 'Very satisfied' },
      { question: 'What can be done better?', answer: 'Nothing.' },
    ],
  },
  {
    id: 'r_9009', userId: 'usr_7f3c91a4', rating: 2, band: 'detractor', segment: 'Repeat', variant: 'Coupon-led ask',
    version: 2, at: '10 Aug 2026, 21:17', themeId: 'th_performance',
    text: 'Search takes five seconds to return anything on my phone. It was never this slow.',
    context: 'Order #QE-875510 · ₹950 · Bandra West · Android 12',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '2 / 10' },
      { question: 'Which areas can we improve?', answer: 'App is slow or crashes' },
      { question: 'What can be done better?', answer: 'Make search faster.' },
    ],
  },
  {
    id: 'r_9010', userId: 'usr_35e6c0fd', rating: 5, band: 'passive', segment: 'New', variant: 'Plain ask',
    version: 2, at: '09 Aug 2026, 14:03', themeId: 'th_unclustered',
    text: 'Fine. Nothing memorable either way.',
    context: 'Order #QE-873220 · ₹290 · Vile Parle · Web',
    answers: [
      { question: 'How would you rate your experience with the app?', answer: '5 / 10' },
      { question: 'What would have made this a great experience?', answer: 'Better offers' },
      { question: 'What can be done better?', answer: 'Nothing specific.' },
    ],
  },
];

/* FR-103 / FR-105 — clusters carry volume, trend, the campaign's single
   average rating, and a confidence grade. */
export const THEMES = [
  {
    id: 'th_performance', name: 'App slowness and crashes', volume: 3140, trend: 18,
    avgRating: 2.6, confidence: 'high',
    summary: 'Concentrated on Android 12 and 13 builds. Search latency and payment-screen freezes dominate the cluster.',
  },
  {
    id: 'th_tracking', name: 'Live tracking out of sync', volume: 1980, trend: 9,
    avgRating: 3.2, confidence: 'high',
    summary: 'Map state lags the rider by 10–20 minutes. Respondents describe refreshing repeatedly rather than waiting.',
  },
  {
    id: 'th_updates', name: 'No proactive status updates', volume: 1240, trend: -6,
    avgRating: 4.4, confidence: 'high',
    summary: 'Respondents accept delays but not silence — the complaint clusters on the missing notification, not the delay.',
  },
  {
    id: 'th_onboarding', name: 'Repetitive address and sign-up steps', volume: 860, trend: 22,
    avgRating: 3.1, confidence: 'medium',
    summary: 'Almost entirely first-order users. The address is requested up to three times before checkout.',
  },
  {
    id: 'th_support', name: 'In-app support chat drops out', volume: 540, trend: 4,
    avgRating: 3.9, confidence: 'medium',
    summary: 'Session times out mid-conversation and reopens as a new ticket, so context is lost.',
  },
  {
    id: 'th_reorder', name: 'Reorder buried in navigation', volume: 310, trend: -2,
    avgRating: 7.4, confidence: 'low',
    summary: 'Below the volume threshold to read as a finding.',
  },
  {
    id: 'th_praise', name: 'Unprompted praise for reliability', volume: 2210, trend: 12,
    avgRating: 9.2, confidence: 'high',
    summary: 'Names payments and the live map specifically — usable as evidence for what not to change.',
  },
];

/* ==========================================================================
   FR-101 — the open-text vocabulary, for the word cloud above the verbatims.

   Counts are mentions across all 16,000 responses, not across the ten
   verbatims the list happens to show: a cloud built from ten sentences gives
   almost every word a count of one, which is a picture of the sample rather
   than of what people wrote. Each term rolls up to one of the THEMES, and the
   per-theme totals here stay inside that theme's own `volume` — a term cannot
   be mentioned more often than the cluster it belongs to.

   `rating` is the mean rating of the responses that used the term, on the
   0–10 scale, so the cloud can be coloured on the shared ramp: a red word is
   a word that turns up in low ratings, not merely a frequent one. That is the
   whole reason to draw this rather than a bar chart of the same numbers —
   size says how often, colour says how badly, and the two together find the
   term that is both common and damaging in one look.

   `also` lists the surface forms a term is actually written in — "froze" for
   freeze, "signing up" for sign up. Clicking a term searches the verbatims for
   the term or any of these, so a word plainly present in the sample is not
   reported as absent on a suffix.
   ========================================================================== */
export const TERM_CLOUD = [
  { term: 'tracking',       count: 1840, rating: 3.1, themeId: 'th_tracking' },
  { term: 'slow',           count: 1620, rating: 2.8, themeId: 'th_performance' },
  { term: 'crash',          count: 1180, rating: 2.2, themeId: 'th_performance' },
  { term: 'payment',        count: 1090, rating: 3.4, themeId: 'th_performance' },
  { term: 'late',           count: 1040, rating: 3.6, themeId: 'th_updates' },
  { term: 'rider',          count: 980,  rating: 3.9, themeId: 'th_tracking' },
  { term: 'refresh',        count: 870,  rating: 3.0, themeId: 'th_tracking' },
  { term: 'notification',   count: 820,  rating: 4.2, themeId: 'th_updates' },
  { term: 'freeze',         count: 760,  rating: 2.1, themeId: 'th_performance', also: ['froze'] },
  { term: 'address',        count: 690,  rating: 3.0, themeId: 'th_onboarding' },
  { term: 'checkout',       count: 640,  rating: 3.3, themeId: 'th_onboarding' },
  { term: 'search',         count: 610,  rating: 2.9, themeId: 'th_performance' },
  { term: 'map',            count: 590,  rating: 6.8, themeId: 'th_tracking' },
  { term: 'wait',           count: 560,  rating: 3.8, themeId: 'th_updates' },
  { term: 'sign up',        count: 480,  rating: 2.7, themeId: 'th_onboarding', also: ['signing up'] },
  { term: 'support',        count: 460,  rating: 3.5, themeId: 'th_support' },
  { term: 'chat',           count: 420,  rating: 3.4, themeId: 'th_support' },
  { term: 'missing item',   count: 380,  rating: 2.4, themeId: 'th_support', also: ['missing-item'] },
  { term: 'delivery',       count: 1240, rating: 5.4, themeId: 'th_updates' },
  { term: 'reorder',        count: 300,  rating: 7.1, themeId: 'th_reorder' },
  { term: 'buried',         count: 190,  rating: 6.6, themeId: 'th_reorder' },
  { term: 'taps',           count: 170,  rating: 6.9, themeId: 'th_reorder' },
  { term: 'reliable',       count: 940,  rating: 9.3, themeId: 'th_praise' },
  { term: 'smooth',         count: 720,  rating: 9.1, themeId: 'th_praise' },
  { term: 'accurate',       count: 540,  rating: 8.8, themeId: 'th_praise' },
  { term: 'quick',          count: 510,  rating: 8.6, themeId: 'th_praise' },
  { term: 'easy',           count: 430,  rating: 8.4, themeId: 'th_praise' },
  { term: 'never fails',    count: 260,  rating: 9.4, themeId: 'th_praise', also: ['never fail'] },
  { term: 'coupon',         count: 340,  rating: 5.9, themeId: 'th_unclustered' },
  { term: 'price',          count: 310,  rating: 4.8, themeId: 'th_unclustered' },
];

/* FR-106 / FR-107 — score driver breakdown. Replaces the food-vs-delivery
   attribution matrix: attribution now keys off theme, and each driver is
   ranked by how far it pulls the overall score down.
   `drag` = points of the campaign average attributable to this theme. */
export const SCORE_DRIVERS = [
  {
    themeId: 'th_performance', name: 'App slowness and crashes',
    volume: 3140, share: 17.0, lowShare: 74, highShare: 9, avgRating: 2.6, drag: 1.42,
    owner: 'Engineering', action: 'Export to engineering triage',
  },
  {
    themeId: 'th_tracking', name: 'Live tracking out of sync',
    volume: 1980, share: 10.7, lowShare: 66, highShare: 12, avgRating: 3.2, drag: 0.81,
    owner: 'Engineering', action: 'Open a tracking-accuracy ticket',
  },
  {
    themeId: 'th_onboarding', name: 'Repetitive address and sign-up steps',
    volume: 860, share: 4.7, lowShare: 71, highShare: 8, avgRating: 3.1, drag: 0.37,
    owner: 'Product', action: 'Send filtered link to onboarding squad',
  },
  {
    themeId: 'th_support', name: 'In-app support chat drops out',
    volume: 540, share: 2.9, lowShare: 52, highShare: 18, avgRating: 3.9, drag: 0.19,
    owner: 'CX', action: 'Route to CX escalation queue',
  },
  {
    themeId: 'th_updates', name: 'No proactive status updates',
    volume: 1240, share: 6.7, lowShare: 38, highShare: 24, avgRating: 4.4, drag: 0.16,
    owner: 'Product', action: 'Send filtered link to notifications squad',
  },
  {
    themeId: 'th_praise', name: 'Unprompted praise for reliability',
    volume: 2210, share: 12.0, lowShare: 3, highShare: 91, avgRating: 9.2, drag: -0.94,
    owner: 'Growth', action: 'Export for store-review prompts',
  },
];

export const OWNER_TEAMS = ['Engineering', 'Product', 'CX', 'Growth', 'City Ops', 'Unassigned'];

/* FR-108 / FR-109 */
export const VARIANT_RESULTS = [
  { name: 'Plain ask', weight: 42, completionRate: 41.2, avgRating: 6.5, responses: 7740, trigger: 'order_delivered + 20 min' },
  { name: 'Coupon-led ask', weight: 58, completionRate: 53.8, avgRating: 7.0, responses: 10682, trigger: 'order_delivered + 2 hour' },
];

export const WEIGHT_HISTORY = [
  { date: '12 Jul', a: 50, b: 50 },
  { date: '20 Jul', a: 48, b: 52 },
  { date: '28 Jul', a: 45, b: 55 },
  { date: '05 Aug', a: 43, b: 57 },
  { date: '14 Aug', a: 42, b: 58 },
];

/* FR-91 — machine inference, rendered in the reserved accent. */
export const AI_SUGGESTIONS = [
  'App slowness is the single largest driver, pulling 1.4 points off the overall score on its own.',
  'Detractor volume is concentrated on Android 12 and 13 — the same builds named in the tracking cluster.',
  '“Repetitive sign-up steps” is up 22% period-on-period and is almost entirely first-order users.',
];

/* ==========================================================================
   Workspace activity (FR-71) — the 24-point series behind the dashboard
   summary strip. Distinct from DELIVERY_SERIES, which belongs to one
   campaign: this is every campaign in the workspace added together.

   Generated from a fixed seed rather than typed out, so the shape is organic
   without being random — the same numbers on every load, and one place to
   change if the seed campaigns change.
   ========================================================================== */
export const WORKSPACE_SERIES = (() => {
  // Deterministic PRNG: the prototype must not draw a different chart on a
  // reload, and hand-writing 24 plausible points is worse than seeding one.
  let s = 20260814;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

  const days = 24;
  const end = Date.UTC(2026, 7, 24); // 24 Aug 2026 — the seed campaigns' last update
  return Array.from({ length: days }, (_, i) => {
    const at = new Date(end - (days - 1 - i) * 86400000);
    const weekday = at.getUTCDay();
    // Order volume dips at the weekend, so prompt volume dips with it.
    const weekend = weekday === 0 || weekday === 6 ? 0.72 : 1;
    const ramp = 0.7 + (i / days) * 0.5;
    const sent = Math.round((1650 + rand() * 520) * weekend * ramp);
    const failed = Math.round(sent * (0.14 + rand() * 0.05));
    const shown = sent - failed;
    const completed = Math.round(shown * (0.44 + rand() * 0.1));
    const abandoned = Math.round(shown * (0.19 + rand() * 0.06));
    // Reach counts people, not prompts. One customer can be prompted by more
    // than one campaign in a day, so reach always trails sent — and the two
    // are not interchangeable on a screen that carries both.
    const reach = Math.round(sent * (0.78 + rand() * 0.08));
    // The price of that reach. Small, but it is the number that decides how
    // often the workspace can afford to ask again.
    const optOuts = Math.round(reach * (0.004 + rand() * 0.005));
    return {
      date: at.toISOString().slice(0, 10),
      label: at.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      sent,
      failed,
      completed,
      abandoned,
      reach,
      optOuts,
      // Normalised 0–10, so it can be read against the ramp without rescaling.
      rating: Number((5.6 + rand() * 1.9).toFixed(2)),
    };
  });
})();

/** The dashboard's range picker. Each option is a slice off the tail. */
export const RANGES = {
  '7d': { label: 'Last 7 days', points: 7 },
  '30d': { label: 'Last 30 days', points: 24 },
};

/* ==========================================================================
   Announcement seed — scoped to CMP-4884, a two-variant push sale campaign.

   An announcement collects no answers, so none of the blocks above apply to it.
   The reader's question is not what people said but whether anybody acted, and
   whether that was worth what it cost — which is why the cost side (dismissals,
   opt-outs, discount) is seeded here as first-class rather than as a footnote.

   The figures reconcile: failure reasons sum to Sent − Delivered, the
   engagement states sum to impressions, every per-cut breakdown sums to the
   totals, and the variants sum to the campaign.
   ========================================================================== */

/* FR-95, announcement steps. Delivered is the step a feedback campaign never
   needed: the OS can accept a push and still never surface it. */
export const ANNOUNCE_FUNNEL = [
  { label: 'Sent', value: 128400 },
  { label: 'Delivered', value: 118960 },
  { label: 'Shown', value: 104210 },
  { label: 'Tapped', value: 14380 },
];

/* FR-96 — granularity appropriate to the range. This campaign ran four days,
   so a daily point would be four bars and would hide the within-day shape
   entirely; the three send windows a day are what a reader needs to see.
   One version, so there is no boundary to mark. */
export const ANNOUNCE_SERIES = [
  { date: '22 Aug 10:00', sends: 15600, taps: 1980, version: 1 },
  { date: '22 Aug 15:00', sends: 14200, taps: 1690, version: 1 },
  { date: '22 Aug 20:00', sends: 11400, taps: 1310, version: 1 },
  { date: '23 Aug 10:00', sends: 14300, taps: 1700, version: 1 },
  { date: '23 Aug 15:00', sends: 13100, taps: 1500, version: 1 },
  { date: '23 Aug 20:00', sends: 11200, taps: 1210, version: 1 },
  { date: '24 Aug 10:00', sends: 10600, taps: 1180, version: 1 },
  { date: '24 Aug 15:00', sends: 9400, taps: 1000, version: 1 },
  { date: '24 Aug 20:00', sends: 7900, taps: 800, version: 1 },
  { date: '25 Aug 10:00', sends: 8100, taps: 830, version: 1 },
  { date: '25 Aug 15:00', sends: 6900, taps: 660, version: 1 },
  { date: '25 Aug 20:00', sends: 5700, taps: 520, version: 1 },
];

/* FR-97 — sums to 9,440, the Sent → Delivered gap. */
export const ANNOUNCE_FAILURE_REASONS = [
  { reason: 'Push permission opted out', count: 5120 },
  { reason: 'Device token invalid', count: 2610 },
  { reason: 'App uninstalled', count: 1180 },
  { reason: 'Suppressed by exclusion list', count: 530 },
];

/* Engagement — the three outcomes of an impression are exhaustive:
   tapped + dismissed + ignored = impressions. */
export const ENGAGEMENT = {
  impressions: 104210,
  uniqueReach: 96400,
  taps: 14380,
  dismissals: 21640,
  ignored: 68190,
  // The cost of reach. A campaign that converts 4% and mutes 2% is not free.
  optOuts: 1842,
};

/** Whether the trigger delay is right, read off when people actually acted. */
export const TIME_TO_TAP = [
  { bucket: 'Under 1 min', count: 4910 },
  { bucket: '1 – 10 min', count: 3720 },
  { bucket: '10 – 60 min', count: 2840 },
  { bucket: '1 – 6 hours', count: 1690 },
  { bucket: '6 – 24 hours', count: 810 },
  { bucket: 'Over 24 hours', count: 410 },
];

/** Which part of the creative did the work. */
export const TAP_DESTINATIONS = [
  { label: 'Primary CTA · “Shop the sale”', count: 9640 },
  { label: 'Notification body', count: 3560 },
  { label: 'Secondary CTA · “See terms”', count: 1180 },
];

export const ENGAGEMENT_BY_APP = [
  { label: 'Android', shown: 61480, taps: 7910 },
  { label: 'iOS', shown: 38220, taps: 6010 },
  { label: 'Web', shown: 4510, taps: 460 },
];

export const ENGAGEMENT_BY_SEGMENT = [
  { label: 'New', shown: 18240, taps: 2010 },
  { label: 'Repeat', shown: 54910, taps: 7880 },
  { label: 'Loyal', shown: 31060, taps: 4490 },
];

/* Impact — what happened after the tap. */
export const CONVERSION_FUNNEL = [
  { label: 'Tapped', value: 14380 },
  { label: 'Landed on offer', value: 13110 },
  { label: 'Added to cart', value: 6240 },
  { label: 'Order placed', value: 3912 },
];

export const CONVERSION = {
  orders: 3912,
  revenue: 2902704,
  aov: 742,
  currency: '₹',
  // An attribution number without its window is unreadable, so the window is
  // part of the data rather than a caption someone might drop.
  windowHours: 48,
};

/* The only figure that survives "would they have ordered anyway". */
export const HOLDOUT = {
  controlSize: 9640,
  audienceRate: 4.06,
  controlRate: 2.41,
  incrementalOrders: 1591,
};

export const OFFER = {
  code: 'FLASH40',
  redemptions: 3180,
  discountCost: 756840,
  netRevenue: 2145864,
};

/* FR-108 — variants compared on what an announcement is for. Reach, taps and
   orders each sum to the campaign totals. */
export const ANNOUNCE_VARIANTS = [
  {
    name: 'Flat 40% off', weight: 50, reach: 48140, shown: 52020, taps: 6540,
    orders: 1704, revenuePerRecipient: 26.3, trigger: 'app_opened + 0 min',
  },
  {
    name: 'Free delivery + 30%', weight: 50, reach: 48260, shown: 52190, taps: 7840,
    orders: 2208, revenuePerRecipient: 33.9, trigger: 'app_opened + 0 min',
  },
];

/* FR-91 — machine inference, in the reserved accent. */
export const ANNOUNCE_AI_SUGGESTIONS = [
  'Free delivery out-converts a deeper discount: 29% more taps and 30% more orders at a lower discount cost per order.',
  'Two in three taps arrived within ten minutes — the send window matters more here than the creative.',
  '1,842 users muted the channel after this send, against 3,912 orders. One opt-out for every two orders is the real price of the reach.',
];
