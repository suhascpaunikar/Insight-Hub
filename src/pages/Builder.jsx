/* ==========================================================================
   Builder.jsx — the four-step wizard.

   OD-15 resolved as focus mode with the console rail still mounted; OD-9 /
   OD-18 resolved with the template gallery inside the stepper rather than in
   front of it; OD-16 resolved as the stepper alone — it is on screen at every
   step and every completed step in it is clickable, so a Back button was a
   second route to the same place and the only one that could not skip.

   Six steps became four: see STEPS for which two pairs merged and why.
   ========================================================================== */
import { useEffect, useState } from 'react';
import { Button, Banner } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { WizardShell } from '../app/WizardShell.jsx';
import { ConfirmDialog } from '../app/dialogs.jsx';
import { Step1 } from './builder/Step1.jsx';
import { Step2 } from './builder/Step2.jsx';
import { ContentStep } from './builder/ContentStep.jsx';
import { Step4 } from './builder/Step4.jsx';
import { SegmentCreator } from './builder/SegmentCreator.jsx';
import { useStore } from '../lib/useStore.js';
import { toast } from '../lib/toast.js';
import {
  validateStep, furthestReachableStep, audienceReach, reconcileVariants, createVariant,
  suggestNameFromObjective, STEP_COUNT,
} from '../lib/store.js';

/**
 * Four steps, not six. The two merges are the same argument made twice: a
 * step should be a decision, and "name it" and "start it" were each half of
 * one.
 */
export const STEPS = [
  { n: 1, label: 'Details' },
  { n: 2, label: 'Audience' },
  { n: 3, label: 'Content' },
  { n: 4, label: 'Schedule & publish' },
];

export function Builder() {
  const store = useStore();
  const [showIssues, setShowIssues] = useState(false);
  const [attention, setAttention] = useState(() => new Set());
  const [previewPick, setPreviewPick] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [pendingGuard, setPendingGuard] = useState(null);

  // Opened directly without a draft — seed one so the screen is explorable.
  useEffect(() => {
    if (!store.state.draft) {
      store.startNew('user-feedback');
      store.updateDraft({ name: 'Post-delivery feedback · Bandra' });
    }
  }, [store]);

  const draft = store.state.draft;
  if (!draft) return null;

  const step = draft.currentStep;
  const issues = validateStep(draft, step);

  /* FR-3 — a backward edit that invalidates downstream state must warn first. */
  function guardedUpdate(patch) {
    const downstreamConfigured = draft.completedSteps.some((s) => s > step);
    const losses = [];
    if (downstreamConfigured) {
      if ('goal' in patch && patch.goal !== draft.goal) {
        losses.push('the template, questions and branch logic configured in the Content step');
      }
      if ('type' in patch && patch.type !== draft.type) {
        losses.push(patch.type === 'regular'
          ? 'every variant except the first, along with its content and trigger'
          : 'the current weightage split');
      }
      if (patch.audience && patch.audience.mode !== draft.audience.mode) {
        losses.push('the segment and exclusion selection on this step');
      }
    }
    if (losses.length > 0) { setPendingGuard({ patch, losses }); return; }
    applyUpdate(patch);
  }

  function applyUpdate(patch) {
    if ('type' in patch) {
      store.updateDraft({ ...patch, variants: reconcileVariants({ ...draft, ...patch }) });
    } else if ('goal' in patch && patch.goal !== draft.goal) {
      // A different goal means different defaults, so content resets with it.
      store.updateDraft({
        ...patch,
        variants: draft.variants.map((v) => ({ ...createVariant(v.name, v.weight, patch.goal), id: v.id })),
      });
    } else {
      store.updateDraft(patch);
    }
  }

  function advance(target) {
    if (target > step && validateStep(draft, step).length > 0) {
      setShowIssues(true);
      setAttention((set) => new Set(set).add(step));
      return;
    }
    setShowIssues(false);
    setAttention((set) => { const next = new Set(set); next.delete(step); return next; });
    // Clicking the step you are already on is not a move, and travelling for
    // it would read as the wizard having lost your place.
    if (target === step) return;
    store.setStep(target);
  }

  function publish() {
    const reach = audienceReach(draft);
    if (reach.included > 0 && reach.reach === 0) {
      toast('Cannot publish',
        'Your exclusions empty the audience — this campaign would reach nobody.', 'danger');
      return;
    }
    if (draft.status === 'Live') { setPublishing(true); return; }
    commitPublish();
  }

  function commitPublish() {
    const result = store.publishDraft();
    toast(
      result.wasLive ? 'Changes published' : `Campaign ${result.status.toLowerCase()}`,
      result.wasLive
        ? `Version ${result.version} is live. Responses are split at this boundary.`
        : result.status === 'Scheduled'
          ? 'Enrolment opens at the scheduled start time.'
          : 'Enrolment is open and rolling.',
    );
    setTimeout(() => { window.location.href = 'index.html'; }, 600);
  }

  /* One step model, two presentations. Both chromes read this, so a step's
     reachability, its completion and the mark it carries are decided once and
     cannot drift between them. */
  const reachable = furthestReachableStep(draft);
  const model = STEPS.map((s) => {
    const isCurrent = s.n === step;
    const isComplete = draft.completedSteps.includes(s.n) && !isCurrent;
    const isLocked = s.n > reachable && !isComplete && !isCurrent;
    const needsAttention = attention.has(s.n) && !isCurrent;
    const state = needsAttention ? 'attention'
      : isCurrent ? 'current' : isComplete ? 'complete' : isLocked ? 'locked' : 'ready';
    const glyph = needsAttention ? <Icon name="alert" size={11} />
      : isComplete ? <Icon name="check" size={11} />
      : isLocked ? <Icon name="lock" size={11} /> : String(s.n);
    return { ...s, state, glyph, isCurrent, isLocked };
  });

  const useStrip = store.state.builderChrome !== 'stepper';
  const tabs = useStrip ? {
    label: 'Campaign creation steps',
    items: model.map((s) => ({
      key: String(s.n), label: s.label, glyph: s.glyph, disabled: s.isLocked,
    })),
    active: String(step),
    onSelect: (key) => advance(Number(key)),
  } : null;

  return (
    <WizardShell
      draft={draft}
      tabs={tabs}
      stepper={useStrip ? null : <Stepper model={model} onGoto={advance} />}
      onExit={() => setLeaving(true)}
      footer={
        <>
          <Button variant="outline" onClick={() => { store.saveDraft(); toast('Draft saved'); }}>
            <Icon name="save" size={14} />Save draft
          </Button>
          {step < STEP_COUNT ? (
            <Button variant="primary" onClick={() => advance(step + 1)}>
              Next<Icon name="right" size={14} />
            </Button>
          ) : (
            <Button variant="primary" onClick={publish}>
              <Icon name="rocket" size={14} />
              {draft.status === 'Live' ? 'Publish changes' : 'Publish campaign'}
            </Button>
          )}
        </>
      }
    >
      {/* FR-69 — blocking fields are surfaced inline on a failed advance. */}
      {showIssues && issues.length > 0 && (
        <Banner
          className="ih-mb-20"
          variant="error"
          icon={<Icon name="alert" size={16} />}
          title={`${STEPS[step - 1].label} needs attention before you can continue.`}
          description={<ul className="ih-issue-list">{issues.map((i) => <li key={i.field}>{i.message}</li>)}</ul>}
        />
      )}

      {step === 1 && (
        <Step1
          draft={draft} issues={issues} showIssues={showIssues}
          update={guardedUpdate}
          onSuggestName={() => {
            const name = suggestNameFromObjective(draft.objective, draft.goal);
            if (!name) return;
            store.updateDraft({ name });
            // Quoted, because the field this writes to is above the objective
            // section and the reader may be nowhere near it.
            toast('Campaign named', `“${name}” — edit it like any other field.`);
          }}
        />
      )}
      {step === 2 && (
        <Step2
          draft={draft} issues={issues} showIssues={showIssues}
          segments={store.state.segments}
          update={guardedUpdate}
          onNewSegment={() => setSegmentOpen(true)}
        />
      )}
      {step === 3 && (
        <ContentStep
          draft={draft} issues={issues} showIssues={showIssues}
          update={applyUpdate}
        />
      )}
      {step === 4 && (
        <Step4
          draft={draft} issues={issues} showIssues={showIssues}
          update={applyUpdate}
          previewPick={previewPick}
          onPreviewPick={setPreviewPick}
          onGoto={advance}
          onSendTest={() => {
            store.updateDraft({ test: { ...draft.test, hasRun: true } });
            toast('Test sent', 'Check the device signed in to that account.');
          }}
        />
      )}

      {/* FR-68 — leaving the builder always goes through this, whether by the
          exit control or by the rail. OD-17 — save-and-exit returns to the
          campaign list. */}
      <ConfirmDialog
        open={leaving}
        title="Leave the builder?"
        confirmLabel="Save & exit"
        destructive={false}
        cancelLabel="Keep editing"
        onClose={() => setLeaving(false)}
        onConfirm={() => { store.saveDraft(); window.location.href = 'index.html'; }}
      >
        This draft keeps everything you have set. You can pick it up from the campaign list.
      </ConfirmDialog>

      {/* FR-53 / FR-56 — publishing over a live campaign versions it. */}
      <ConfirmDialog
        open={publishing}
        title="Publish changes to a live campaign?"
        confirmLabel={`Publish version ${draft.version + 1}`}
        destructive={false}
        onClose={() => setPublishing(false)}
        onConfirm={() => { setPublishing(false); commitPublish(); }}
      >
        This creates <strong>version {draft.version + 1}</strong> and timestamps it. Responses
        collected before and after this moment stay distinguishable on the insights page, so an
        edited question never silently blends two datasets into one.
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingGuard)}
        title="This change resets later steps"
        confirmLabel="Change it anyway"
        onClose={() => setPendingGuard(null)}
        onConfirm={() => { applyUpdate(pendingGuard.patch); setPendingGuard(null); }}
      >
        Continuing will discard {pendingGuard?.losses.join(', and ')}. You will need to configure
        those steps again.
      </ConfirmDialog>

      <SegmentCreator
        open={segmentOpen}
        onClose={() => setSegmentOpen(false)}
        onCreate={(segment) => {
          const id = store.addSegment(segment);
          store.updateDraft({
            audience: { ...draft.audience, segments: [...draft.audience.segments, id] },
          });
          toast('Segment created', `“${segment.name}” is selected for this campaign.`);
          setSegmentOpen(false);
        }}
      />
    </WizardShell>
  );
}

/**
 * The wizard's stepper: a numbered stop per step, joined by the line between
 * them. The line after a completed step is filled, so how far through the
 * wizard you are is one continuous read across the row rather than something
 * to infer from which tab happens to be highlighted.
 */
function Stepper({ model, onGoto }) {
  return (
    <ol className="ih-stepper" aria-label="Campaign creation steps">
      {model.map((s, i) => (
        <li className="ih-stepstop" data-state={s.state} key={s.n}>
          <button
            type="button"
            className="ih-step"
            data-state={s.state}
            disabled={s.isLocked}
            aria-current={s.isCurrent ? 'step' : undefined}
            onClick={() => onGoto(s.n)}
          >
            <span className="ih-step-num">{s.glyph}</span>
            <span className="ih-step-label truncate">{s.label}</span>
          </button>
          {i < model.length - 1 && <span className="ih-step-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
