/* ==========================================================================
   store.js — campaign state: the draft model, variant reconciliation, step
   validation (FR-1), and persistence so a draft survives a reload (FR-4).
   ========================================================================== */
import { uid, minutesAgo, clamp, triggerLabel, loadState, saveState } from './core.js';
import { SEED_CAMPAIGNS, SEGMENTS, TEMPLATES } from './data.js';

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

export function createDraft(goal = null) {
  return {
    id: uid('d'),
    campaignId: nextCampaignId(),
    goal,
    name: '',
    apps: ['android', 'ios'],
    type: 'regular',
    audience: { mode: 'all', segments: [], exclusions: [] },
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
export function validateStep(draft, step) {
  const issues = [];
  const add = (field, message) => issues.push({ field, message });

  if (step === 1 && !draft.goal) {
    add('goal', 'Choose what you want to start from.');
  }

  if (step === 2) {
    if (!draft.name.trim()) add('name', 'Campaign name is required.');
    if (draft.apps.length === 0) add('apps', 'Select at least one app.');
  }

  if (step === 3) {
    if (draft.audience.mode === 'segmented' && draft.audience.segments.length === 0) {
      add('segments', 'Select at least one segment, or switch to All users.');
    }
    if (audienceReach(draft).reach === 0 && audienceReach(draft).included > 0) {
      // FR-17 — exclusion emptying the audience blocks publication, not progression.
      add('exclusions', 'Your exclusions remove everyone in the included audience.');
    }
  }

  if (step === 4) {
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

  if (step === 5) {
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
  for (let step = 1; step <= 6; step += 1) {
    if (validateStep(draft, step).length > 0) return step;
  }
  return 6;
}

/* ---------- Derived ---------- */
export function audienceReach(draft) {
  const { audience } = draft;
  const included =
    audience.mode === 'all' ? 486320
    : audience.mode === 'user-data-table' ? 12400
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
const DEFAULT_STATE = {
  campaigns: SEED_CAMPAIGNS,
  segments: SEGMENTS,
  draft: null,
  navCollapsed: false,
  emptyDashboard: false,
};

export const store = {
  state: { ...DEFAULT_STATE, ...(loadState() || {}) },

  save() {
    this.state.campaigns = this.state.campaigns.map((c) => ({ ...c }));
    saveState(this.state);
  },

  set(patch) {
    Object.assign(this.state, patch);
    this.save();
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
      currentStep: clamp(step, 1, 6),
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
      status,
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
    const draft = createDraft('user-feedback');
    const clone = {
      ...draft,
      name: `${source.name} (copy)`,
      type: source.type,
      audience: { mode: 'segmented', segments: ['seg_repeat'], exclusions: [] },
      variants: reconcileVariants({ ...draft, type: source.type }).map((v) => ({
        ...v,
        templateId: 'TPL-2010',
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
    const draft = {
      ...createDraft('user-feedback'),
      id: source.id,
      campaignId: source.campaignId,
      name: source.name,
      type: source.type,
      status: source.status,
      version: source.versions,
      audience: { mode: 'segmented', segments: ['seg_repeat'], exclusions: ['ex_recent'] },
      currentStep: source.resumeStep || 1,
      lastSavedAt: source.updatedAt,
    };
    draft.variants = reconcileVariants(draft).map((v) => ({ ...v, templateId: 'TPL-2010' }));
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
    draft.currentStep = 4;
    draft.completedSteps = [1, 2, 3];
    this.save();
    return draft;
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
    : audience.mode === 'user-data-table' ? 'User Data Table'
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
