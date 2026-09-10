/* ==========================================================================
   store.js — campaign state: the draft model, variant reconciliation, step
   validation (FR-1), and persistence so a draft survives a reload (FR-4).
   ========================================================================== */
import { uid, minutesAgo, clamp, triggerLabel, loadState, saveState } from './core.js';
import { SEED_CAMPAIGNS, SEGMENTS, TEMPLATES, OBJECTIVE_SIGNALS, campaignKind } from './data.js';

let seq = 4970;
const nextCampaignId = () => `CMP-${++seq}`;

/* ---------- Draft construction ---------- */

/** FR-43 — a Ratings template arrives with Q1 · Q2 · Q3 pre-populated. */
function defaultBranches() {
  return {
    detractor: {
      question: 'Which areas can we improve?',
      choices: [
        { id: uid('ch'), text: 'App is slow or crashes' },
        { id: uid('ch'), text: 'Order tracking is wrong' },
        { id: uid('ch'), text: 'Too many steps to reorder' },
      ],
    },
    passive: {
      question: 'What would have made this a great experience?',
      choices: [
        { id: uid('ch'), text: 'Faster, more reliable app' },
        { id: uid('ch'), text: 'Clearer status updates' },
        { id: uid('ch'), text: 'Better offers' },
      ],
    },
    promoter: {
      question: 'How satisfied are you with the app?',
      choices: [
        { id: uid('ch'), text: 'Very satisfied' },
        { id: uid('ch'), text: 'Satisfied' },
        { id: uid('ch'), text: 'It was fine' },
      ],
    },
  };
}

export function createVariant(name, weight, goal) {
  const feedback = goal === 'user-feedback' || goal === 'churn-rate';
  return {
    id: uid('v'),
    name,
    weight,
    channel: goal === 'sale-push' ? 'push' : 'in-app',
    // FR-26 — Ratings is the default active tab for a User Feedback campaign.
    templateCategory: feedback ? 'ratings' : 'basic',
    templateId: null,
    // FR-38 — NPS is the default rating element.
    ratingElement: 'nps',
    // FR-39 — 1–5 or 1–10; the higher number is the more positive response.
    npsScale: 10,
    // FR-40 — branching is off by default. Churn Rate pre-enables it.
    branchingEnabled: goal === 'churn-rate',
    branches: defaultBranches(),
    ratingQuestion: 'How would you rate your experience with the app?',
    openTextQuestion: 'What can be done better?',
    elements: [],
    trigger: { event: 'order_delivered', delayValue: '20', delayUnit: 'min' },
  };
}

/**
 * The template a rebuilt draft lands on. A Ratings template cannot render a
 * push notification and a Basic one cannot carry a rating, so the kind picks it
 * — cloning or editing a Sale Push must not drop the user on a ratings layout.
 */
export function defaultTemplateFor(goal) {
  return campaignKind({ goal }) === 'announcement' ? 'TPL-1042' : 'TPL-2010';
}

export function createDraft(goal = null) {
  return {
    id: uid('d'),
    campaignId: nextCampaignId(),
    goal,
    name: '',
    // The campaign's own words for why it exists. Configures nothing; it is the
    // context the assistant answers from, and it travels with the row on save.
    objective: '',
    apps: ['android', 'ios'],
    type: 'regular',
    // `userList` is the parsed CSV behind the User Data Table mode: the file's
    // name, how many unique ids came out of it, which column they were read
    // from, and a handful of them to show back. The ids themselves are not
    // kept — a draft is persisted, and forty thousand of them would be a
    // localStorage quota error rather than a feature.
    audience: { mode: 'all', segments: [], exclusions: [], userList: null },
    variants: [createVariant('Variant A', 100, goal)],
    schedule: {
      startMode: 'now', startDate: '', startTime: '',
      endMode: 'never', endDate: '', endTime: '',
      allowReentry: false,
    },
    test: { account: '', userId: '', hasRun: false },
    currentStep: 1,
    completedSteps: [],
    status: 'Draft',
    version: 1,
    updatedAt: new Date().toISOString(),
    lastSavedAt: null,
    dirty: false,
  };
}

/** Weights across variants must total 100%; the default is an even split (FR-24). */
export function evenSplit(variants) {
  const base = Math.floor(100 / variants.length);
  return variants.map((v, i) => ({
    ...v,
    weight: i === 0 ? 100 - base * (variants.length - 1) : base,
  }));
}

/** FR-19 / FR-20 — Regular has one tab; A/B and Intelligent A/B open with two. */
export function reconcileVariants(draft) {
  const { type, variants, goal } = draft;
  if (type === 'regular') return [{ ...variants[0], weight: 100 }];
  if (variants.length < 2) {
    return evenSplit([...variants, createVariant('Variant B', 0, goal)]);
  }
  return variants;
}

/* ---------- Validation (FR-1, FR-69) ---------- */

/**
 * How many steps the wizard has. Lives here rather than beside the labels in
 * builder.js because it is the validation that decides what a step is: every
 * loop below counts to it, and a label list that disagreed with the validator
 * would let the reader reach a step nothing checks. builder.js imports it.
 */
export const STEP_COUNT = 4;

export function validateStep(draft, step) {
  const issues = [];
  const add = (field, message) => issues.push({ field, message });

  // Step 1 is the old 1 + 2: what the campaign is for, and what it is called.
  if (step === 1) {
    if (!draft.goal) add('goal', 'Choose what you want to start from.');
    if (!draft.name.trim()) add('name', 'Campaign name is required.');
    if (draft.apps.length === 0) add('apps', 'Select at least one app.');
  }

  if (step === 2) {
    if (draft.audience.mode === 'segmented' && draft.audience.segments.length === 0) {
      add('segments', 'Select at least one segment, or switch to All users.');
    }
    if (draft.audience.mode === 'user-data-table' && !draft.audience.userList) {
      add('userList', 'Upload a CSV of user IDs, or switch to All users.');
    }
    if (audienceReach(draft).reach === 0 && audienceReach(draft).included > 0) {
      // FR-17 — exclusion emptying the audience blocks publication, not progression.
      add('exclusions', 'Your exclusions remove everyone in the included audience.');
    }
  }

  if (step === 3) {
    draft.variants.forEach((variant) => {
      if (!variant.templateId) {
        add(`template:${variant.id}`, `${variant.name || 'A variant'} has no template selected.`);
      }
      // FR-44 — invalid or non-numeric delay is blocked with inline validation.
      const n = Number(variant.trigger.delayValue);
      if (variant.trigger.delayValue === '' || Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
        add(`delay:${variant.id}`, `${variant.name || 'A variant'} needs a whole-number delay.`);
      }
      if (!variant.trigger.event) {
        add(`event:${variant.id}`, `${variant.name || 'A variant'} has no trigger event.`);
      }
      if (!variant.name.trim()) {
        add(`vname:${variant.id}`, 'Every variant needs a name.');
      }
    });
    const total = draft.variants.reduce((sum, v) => sum + Number(v.weight || 0), 0);
    if (draft.variants.length > 1 && total !== 100) {
      add('weight', `Weights total ${total}%. They must total 100%.`);
    }
  }

  // Step 4 is the old 5 + 6. Only the schedule half validates: testing is not a
  // gate (OD-5), so there has never been anything on the publish half to block.
  if (step === 4) {
    const s = draft.schedule;
    if (s.startMode === 'later' && (!s.startDate || !s.startTime)) {
      add('start', 'A later start needs both a date and a time.');
    }
    if (s.endMode === 'end-on') {
      if (!s.endDate || !s.endTime) add('end', 'An end date and time are both required.');
      else if (s.startMode === 'later' && s.startDate && s.startTime) {
        if (new Date(`${s.endDate}T${s.endTime}`) <= new Date(`${s.startDate}T${s.startTime}`)) {
          add('end', 'The end must be after the start.');
        }
      }
    }
  }

  return issues;
}

/** The furthest step the draft's current state allows the user to reach. */
export function furthestReachableStep(draft) {
  for (let step = 1; step <= STEP_COUNT; step += 1) {
    if (validateStep(draft, step).length > 0) return step;
  }
  return STEP_COUNT;
}

/* ---------- Derived ---------- */

/**
 * A keyword reading of the objective, offered under the field on step 1.
 * There is no model behind it: `OBJECTIVE_SIGNALS` is the whole of it, and the
 * suggestion is never applied on its own — the user clicks to take it. Two
 * goals matching equally often is not a reading, so it says nothing.
 */
export function suggestGoalFromObjective(text) {
  const q = String(text || '').toLowerCase();
  if (q.trim().length < 15) return null;
  const ranked = OBJECTIVE_SIGNALS
    .map((signal) => ({ goal: signal.goal, hits: signal.words.filter((w) => q.includes(w)).length }))
    .filter((signal) => signal.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  if (ranked.length === 0) return null;
  if (ranked[1] && ranked[1].hits === ranked[0].hits) return null;
  return ranked[0].goal;
}

export function audienceReach(draft) {
  const { audience } = draft;
  const included =
    audience.mode === 'all' ? 486320
    : audience.mode === 'user-data-table' ? (audience.userList ? audience.userList.size : 0)
    : SEGMENTS.filter((s) => audience.segments.includes(s.id)).reduce((sum, s) => sum + s.size, 0);
  const excluded = EXCLUSION_SIZES(audience.exclusions);
  return { included, excluded, reach: Math.max(0, included - excluded) };
}

function EXCLUSION_SIZES(ids) {
  // Kept local so store.js has a single import surface from data.js.
  const sizes = { ex_optout: 12903, ex_recent: 34110, ex_internal: 214, ex_loyal: 61034 };
  return ids.reduce((sum, id) => sum + (sizes[id] || 0), 0);
}

export function variantScaleMax(variant) {
  // A star rating is always 5-point; NPS carries its own scale (FR-39, FR-41).
  return variant.ratingElement === 'star' ? 5 : Number(variant.npsScale);
}

export function templateOf(variant) {
  return TEMPLATES.find((t) => t.id === variant.templateId) || null;
}

export function draftTriggerLabel(draft) {
  const labels = draft.variants.map((v) =>
    triggerLabel(v.trigger.event, v.trigger.delayValue, v.trigger.delayUnit));
  // FR-77 — where variants diverge the cell says so rather than showing the first.
  return new Set(labels).size > 1 ? 'multiple triggers' : labels[0];
}

export function hasDivergentTriggers(draft) {
  const keys = draft.variants.map((v) => `${v.trigger.event}|${v.trigger.delayValue}|${v.trigger.delayUnit}`);
  return new Set(keys).size > 1;
}

/* ---------- Store ---------- */
/* FR-63 — workspace configuration, the values every campaign inherits when it
   does not override them. Grouped by the panel that owns them so a Save commits
   one panel's worth of change and nothing else's. */
export const DEFAULT_SETTINGS = {
  /* General */
  workspaceName: 'QuickEats India',
  defaultRating: 'nps',
  region: 'ap-south-1',
  /* Response handling */
  onePerUser: true,
  responseWindow: 72,
  cooldown: 14,
  /* Send rate limits */
  inAppRate: 4,
  pushRate: 2,
  perUserRate: 30,
  /* Alerts and digests */
  channelConnected: false,
  alertRating: true,
  alertStall: false,
  alertComplete: true,
  alertTheme: false,
  digestWeekly: true,
  digestDaily: false,
  ratingFloor: 3.5,
};

const DEFAULT_STATE = {
  campaigns: SEED_CAMPAIGNS,
  segments: SEGMENTS,
  draft: null,
  navCollapsed: false,
  // FR-61, scoped: the wizard opens with the rail collapsed to the icon strip
  // so the Content step keeps its width, and remembers its own answer rather
  // than collapsing the console the user left expanded.
  builderNavCollapsed: true,
  /* Which chrome the wizard wears. 'strip' puts the four steps in the shell's
     tab strip, the way every other screen carries its tabs; 'stepper' keeps
     the boxed stepper the wizard was built with, which says more per step —
     a state word under each label — at the cost of a band of its own. Both
     are wired; Settings → Prototype state switches them. */
  builderChrome: 'strip',
  emptyDashboard: false,
  settings: { ...DEFAULT_SETTINGS },
};

export const store = {
  state: (() => {
    const stored = loadState() || {};
    // A state saved before a setting existed must still get that setting's
    // default rather than `undefined`, so the merge is per-group, not shallow.
    return { ...DEFAULT_STATE, ...stored, settings: { ...DEFAULT_SETTINGS, ...(stored.settings || {}) } };
  })(),

  save() {
    this.state.campaigns = this.state.campaigns.map((c) => ({ ...c }));
    saveState(this.state);
  },

  set(patch) {
    Object.assign(this.state, patch);
    this.save();
  },

  /** Commits one settings panel. Untouched fields keep their stored value. */
  saveSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.save();
    return this.state.settings;
  },

  /* --- draft lifecycle --- */
  startNew(goal = null) {
    this.state.draft = createDraft(goal);
    this.save();
    return this.state.draft;
  },

  updateDraft(patch) {
    if (!this.state.draft) return null;
    this.state.draft = {
      ...this.state.draft,
      ...patch,
      dirty: true,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.draft;
  },

  patchVariant(id, patch) {
    const draft = this.state.draft;
    if (!draft) return null;
    return this.updateDraft({
      variants: draft.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });
  },

  setStep(step) {
    const draft = this.state.draft;
    if (!draft) return null;
    const completed = new Set(draft.completedSteps);
    // FR-2 — completed steps stay marked complete when you navigate back.
    for (let s = 1; s < step; s += 1) {
      if (validateStep(draft, s).length === 0) completed.add(s);
      else completed.delete(s);
    }
    return this.updateDraft({
      currentStep: clamp(step, 1, STEP_COUNT),
      completedSteps: [...completed].sort((a, b) => a - b),
    });
  },

  saveDraft() {
    const draft = this.state.draft;
    if (!draft) return null;
    const now = new Date().toISOString();
    this.state.draft = { ...draft, dirty: false, lastSavedAt: now, updatedAt: now };
    this.upsertCampaignFromDraft(this.state.draft);
    this.save();
    return this.state.draft;
  },

  discardDraft() {
    this.state.draft = null;
    this.save();
  },

  /** Mirror the draft into the campaign list so it is resumable (FR-4, FR-82). */
  upsertCampaignFromDraft(draft, statusOverride) {
    const status = statusOverride || draft.status;
    const row = {
      id: draft.id,
      campaignId: draft.campaignId,
      name: draft.name || 'Untitled campaign',
      objective: draft.objective || '',
      status,
      // The kind is derived from the goal, so the goal has to survive publish —
      // without it every published campaign opened the feedback screen, rating
      // distributions and all, whatever it had actually asked people to do.
      goal: draft.goal,
      channel: draft.variants[0].channel,
      triggerLabel: draftTriggerLabel(draft),
      divergentTriggers: hasDivergentTriggers(draft),
      responses: 0,
      avgRating: 0,
      ratingElement: draft.variants[0].ratingElement,
      ratingScaleMax: variantScaleMax(draft.variants[0]),
      updatedAt: draft.updatedAt,
      versions: draft.version,
      type: draft.type,
      audienceLabel: audienceLabel(draft),
      runningDates: scheduleLabel(draft),
      resumeStep: draft.currentStep,
    };
    const index = this.state.campaigns.findIndex((c) => c.id === draft.id);
    if (index >= 0) {
      this.state.campaigns[index] = { ...this.state.campaigns[index], ...row };
    } else {
      this.state.campaigns.unshift(row);
    }
    return row;
  },

  /** FR-53 / FR-56 — publishing a live campaign increments its version. */
  publishDraft() {
    const draft = this.state.draft;
    if (!draft) return null;
    const wasLive = draft.status === 'Live';
    const status = wasLive ? 'Live' : draft.schedule.startMode === 'later' ? 'Scheduled' : 'Live';
    const published = {
      ...draft,
      status,
      version: wasLive ? draft.version + 1 : draft.version,
      dirty: false,
      updatedAt: new Date().toISOString(),
    };
    this.upsertCampaignFromDraft(published, status);
    this.state.draft = null;
    this.save();
    return { status, version: published.version, wasLive };
  },

  /* --- list actions --- */
  /** FR-81 — clone copies content, audience and trigger; never schedule or responses. */
  cloneCampaign(id) {
    const source = this.state.campaigns.find((c) => c.id === id);
    if (!source) return null;
    const goal = source.goal || 'user-feedback';
    const draft = createDraft(goal);
    const clone = {
      ...draft,
      name: `${source.name} (copy)`,
      // FR-81 copies configuration; the objective travels with it because a
      // clone is almost always the same question asked of a different audience.
      objective: source.objective || '',
      type: source.type,
      audience: { mode: 'segmented', segments: ['seg_repeat'], exclusions: [] },
      variants: reconcileVariants({ ...draft, type: source.type }).map((v) => ({
        ...v,
        templateId: defaultTemplateFor(goal),
        ratingElement: source.ratingElement || 'nps',
        npsScale: source.ratingScaleMax === 5 ? 5 : 10,
      })),
      currentStep: 1,
      completedSteps: [],
      status: 'Draft',
    };
    this.state.draft = clone;
    this.upsertCampaignFromDraft(clone, 'Draft');
    this.save();
    return clone;
  },

  /** FR-82 — a Draft or Scheduled campaign reopens the builder where it was left. */
  resumeCampaign(id) {
    const source = this.state.campaigns.find((c) => c.id === id);
    if (!source) return null;
    const goal = source.goal || 'user-feedback';
    const draft = {
      ...createDraft(goal),
      id: source.id,
      campaignId: source.campaignId,
      name: source.name,
      objective: source.objective || '',
      type: source.type,
      status: source.status,
      version: source.versions,
      audience: { mode: 'segmented', segments: ['seg_repeat'], exclusions: ['ex_recent'] },
      currentStep: source.resumeStep || 1,
      lastSavedAt: source.updatedAt,
    };
    draft.variants = reconcileVariants(draft).map((v) => ({ ...v, templateId: defaultTemplateFor(goal) }));
    draft.completedSteps = [];
    for (let s = 1; s < draft.currentStep; s += 1) {
      if (validateStep(draft, s).length === 0) draft.completedSteps.push(s);
    }
    this.state.draft = draft;
    this.save();
    return draft;
  },

  /** FR-87 — Edit routes a live campaign back into the builder. */
  editCampaign(id) {
    const draft = this.resumeCampaign(id);
    if (!draft) return null;
    // Content — the step an edit is nearly always for, and the one after the
    // two the campaign already satisfies.
    draft.currentStep = 3;
    draft.completedSteps = [1, 2];
    this.save();
    return draft;
  },

  /** FR-74 — rename in place. The name is the identifier every list shows. */
  renameCampaign(id, name) {
    const index = this.state.campaigns.findIndex((c) => c.id === id);
    if (index < 0) return null;
    this.state.campaigns[index] = {
      ...this.state.campaigns[index],
      name,
      updatedAt: new Date().toISOString(),
    };
    // A rename while that campaign is open in the builder has to reach the
    // draft too, or the next save writes the old name straight back over it.
    if (this.state.draft && this.state.draft.id === id) {
      this.state.draft = { ...this.state.draft, name };
    }
    this.save();
    return this.state.campaigns[index];
  },

  /**
   * Remove a campaign, handing back everything needed to put it back.
   *
   * The index matters as much as the row: restoring to the top of the list
   * would move a campaign the reader did not ask to move, and an undo that
   * rearranges the screen is not an undo. Nothing here is a real deletion —
   * this is a prototype over localStorage — but the shape is the shape a real
   * one needs, and the caller holds the returned record only for as long as
   * its toast is on screen.
   */
  deleteCampaign(id) {
    const index = this.state.campaigns.findIndex((c) => c.id === id);
    if (index < 0) return null;
    const [row] = this.state.campaigns.splice(index, 1);
    // A draft open in the builder for the row just deleted has nothing left to
    // save into, and leaving it would resurrect the campaign on the next save.
    if (this.state.draft && this.state.draft.id === id) this.state.draft = null;
    this.save();
    return { row, index };
  },

  /** Undo of the above, back into the position it was taken from. */
  restoreCampaign(record) {
    if (!record) return null;
    const { row, index } = record;
    if (this.state.campaigns.some((c) => c.id === row.id)) return row;
    this.state.campaigns.splice(Math.min(index, this.state.campaigns.length), 0, row);
    this.save();
    return row;
  },

  setCampaignStatus(id, status) {
    const index = this.state.campaigns.findIndex((c) => c.id === id);
    if (index < 0) return;
    this.state.campaigns[index] = {
      ...this.state.campaigns[index],
      status,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  },

  addSegment(segment) {
    const id = uid('seg');
    this.state.segments = [...this.state.segments, { ...segment, id, userCreated: true }];
    this.save();
    return id;
  },
};

export function audienceLabel(draft) {
  const { audience } = draft;
  const base =
    audience.mode === 'all' ? 'All users'
    : audience.mode === 'user-data-table'
      ? (audience.userList ? audience.userList.name : 'User Data Table')
    : store.state.segments
        .filter((s) => audience.segments.includes(s.id))
        .map((s) => s.name).join(' · ') || 'No segment';
  if (audience.exclusions.length === 0) return base;
  return `${base} · excl. ${audience.exclusions.length}`;
}

export function scheduleLabel(draft) {
  const s = draft.schedule;
  if (draft.status === 'Draft') return 'Not scheduled';
  const start = s.startMode === 'now' ? 'Starts on publish' : `Starts ${s.startDate} ${s.startTime}`;
  const end = s.endMode === 'never' ? 'runs until stopped' : `ends ${s.endDate}`;
  return `${start} — ${end}`;
}

export { minutesAgo };
