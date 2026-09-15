/* ==========================================================================
   assistant-context.js — what the assistant can see.

   Clicky photographs the screen because it is a bystander to the app it is
   describing: no access to the data, so ScreenCaptureKit takes a picture and
   a vision model guesses at the numbers. InsightHub *is* the app. The
   campaigns, themes and drivers are already structured objects, so this
   module reads them directly. Same role in the pipeline, exact instead of
   inferred — and no screenshot, no vision call, no coordinate estimation.

   One thing the React port improved. The vanilla version read the insights
   filters back out of the rendered `<select>` elements, because `filters` was
   module-private to insights.js and scraping the DOM was less coupling than
   reaching into another module. React gives the page somewhere to publish
   them instead, so `publishFilters()` replaces the scrape — and with it the
   assumption that a control's rendered value is the state.
   ========================================================================== */
import { store } from './store.js';
import { tabsFor } from './insights-lib.js';

const param = (key) => new URLSearchParams(window.location.search).get(key);

/* What the insights page is currently filtered to. Written by that page on
   every change, and empty everywhere else — which is correct: no other screen
   has filters for the assistant to describe. */
let liveFilters = {};
export const publishFilters = (filters) => { liveFilters = filters || {}; };

/** Which of the three screens is on show. */
function currentPage() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  if (file.startsWith('insights')) return 'insights';
  if (file.startsWith('builder')) return 'builder';
  return 'dashboard';
}

/**
 * The campaign the user is looking at. Insights addresses one by `?id=`;
 * elsewhere the live campaign is the one worth talking about, because it is
 * the only one still accumulating responses.
 */
function currentCampaign() {
  const campaigns = store.state.campaigns || [];
  const addressed = param('id') && campaigns.find((c) => c.id === param('id'));
  return addressed || campaigns.find((c) => c.status === 'Live') || campaigns[0] || null;
}

/** One immutable read of everything the assistant is allowed to talk about. */
export function snapshot() {
  const campaigns = store.state.campaigns || [];
  const campaign = currentCampaign();
  return {
    page: currentPage(),
    // A stale ?tab= renders as Delivery, so the assistant must not claim to be
    // looking at a tab that is not on screen. The valid set is the campaign's
    // kind's: `responses` is not a tab an announcement has.
    tab: campaign && tabsFor(campaign).includes(param('tab')) ? param('tab') : 'delivery',
    campaign,
    campaigns,
    liveCount: campaigns.filter((c) => c.status === 'Live').length,
    totalResponses: campaigns.reduce((sum, c) => sum + (c.responses || 0), 0),
    filters: liveFilters,
    draft: store.state.draft || null,
  };
}
