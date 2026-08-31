/* ==========================================================================
   assistant-context.js — what the assistant can see.

   Clicky photographs the screen because it is a bystander to the app it is
   describing: no access to the data, so ScreenCaptureKit takes a picture and
   a vision model guesses at the numbers. InsightHub *is* the app. The
   campaigns, themes and drivers are already structured objects, so this
   module reads them directly. Same role in the pipeline, exact instead of
   inferred — and no screenshot, no vision call, no coordinate estimation.
   ========================================================================== */
import { store } from './store.js';
import { TABS } from './insights.js';

const param = (key) => new URLSearchParams(location.search).get(key);

/**
 * The tab the page actually rendered, read from its aria-selected state rather
 * than from the URL. A stale `?tab=` for a tab that no longer exists falls back
 * on the page but would still be believed here, and the assistant would then
 * describe a panel the reader cannot see.
 */
function currentTab() {
  const selected = document.querySelector('[role="tab"][aria-selected="true"][data-tab]');
  return selected ? selected.dataset.tab : (param('tab') || 'delivery');
}

/** Which of the three screens is on show. */
function currentPage() {
  const file = location.pathname.split('/').pop() || 'index.html';
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

/**
 * Insights keeps its `filters` object module-private, so read the rendered
 * selects rather than reaching into another module's internals. The markup
 * already carries `data-key` and the live value — the same pair insights.js
 * reads in its own change handler — so this stays correct without coupling
 * the two modules together.
 */
function currentFilters() {
  const out = {};
  document.querySelectorAll('[data-act="filter"][data-key]').forEach((select) => {
    out[select.dataset.key] = select.value;
  });
  return out;
}

/** One immutable read of everything the assistant is allowed to talk about. */
export function snapshot() {
  const campaigns = store.state.campaigns || [];
  return {
    page: currentPage(),
    // A stale ?tab= (the removed Themes tab) renders as Delivery, so the
    // assistant must not claim to be looking at a tab that is not on screen.
    tab: TABS.includes(param('tab')) ? param('tab') : 'delivery',
    campaign: currentCampaign(),
    campaigns,
    liveCount: campaigns.filter((c) => c.status === 'Live').length,
    totalResponses: campaigns.reduce((sum, c) => sum + (c.responses || 0), 0),
    filters: currentFilters(),
    draft: store.state.draft || null,
  };
}
