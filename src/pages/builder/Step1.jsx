/* ==========================================================================
   Step 1 — Start & details (FR-5 … FR-11)

   The old steps 1 and 2, which were one decision wearing two hats: what this
   campaign is for, and what it is called and where it runs. The goal grid is
   full width because it is a gallery; everything under it is prose and short
   fields, and is held to a column so the name input does not run the width of
   a 2560px console.
   ========================================================================== */
import { Button, Input, Textarea, Badge, Banner, Surface, Text, Field, Grid } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { StepPanel, StepHead, OptionCard } from '../../app/wizard-kit.jsx';
import { GOALS } from '../../lib/data.js';
import { suggestGoalFromObjective } from '../../lib/store.js';

export const APP_OPTIONS = [
  { id: 'android', label: 'Android', note: 'Push, in-app, web view' },
  { id: 'ios', label: 'iOS', note: 'Push, in-app' },
  { id: 'web', label: 'Web', note: 'On-site, web push' },
];

export const TYPE_OPTIONS = [
  { id: 'regular', label: 'Regular', note: 'One piece of content, one tab in the Content step.' },
  { id: 'ab', label: 'A/B Testing', note: 'Two variants you weight yourself. Extensible to more.' },
  { id: 'intelligent-ab', label: 'Intelligent A/B', note: 'Starts at an even split, then AI shifts weight to the winner.', recommended: true },
];

const OBJECTIVE_MAX = 400;

export function Step1({ draft, issues, showIssues, update, onSuggestName }) {
  const issue = (f) => issues.find((i) => i.field === f);
  // The dwell recommendations read the objective, so without one there is
  // nothing to say and the section is not a target at all — an empty answer
  // would teach the reader that resting on a panel does nothing.
  const hasObjective = Boolean(draft.objective && draft.objective.trim());
  const tip = (key) => (hasObjective ? key : '');

  return (
    <section className="ih-ssections">
      <StepHead title="Campaign details" id="s1">
        What this campaign is for, and where it runs.
      </StepHead>

      <StepPanel
        id="s1-goal"
        title="Select a template"
        insightKey={tip('pick-template')}
        required
        desc="Sets the defaults for the rest of the campaign. You can change them later."
        // FR-69 — only the goal blocks here; the name and app errors ride on
        // their own panels below, where the field the reader has to fix is.
        error={showIssues && issue('goal') ? 'Choose what you want to start from to continue.' : ''}
      >
        <div className="ih-grid ih-g4">
          {GOALS.map((goal) => (
            <Surface
              key={goal.id}
              render={<button type="button" />}
              className={`ih-goal${draft.goal === goal.id ? ' ih-opt-on' : ''}`}
              aria-pressed={draft.goal === goal.id}
              onClick={() => update({ goal: goal.id })}
            >
              <span className="ih-row-between">
                <span className="ih-opt-icon"><Icon name={goal.icon} size={16} /></span>
                {draft.goal === goal.id && (
                  <Badge variant="primary" size="sm"><Icon name="check" size={11} />Selected</Badge>
                )}
              </span>
              {/* Name and one line, and nothing under it. */}
              <span className="ih-goal-name">{goal.name}</span>
              <span className="ih-goal-note">{goal.summary}</span>
            </Surface>
          ))}

          {/* FR-6 — present but non-interactive, cannot be focused, does not count. */}
          <Surface className="ih-goal ih-goal-soon" aria-disabled="true" tabIndex={-1}>
            <span className="ih-opt-icon"><Icon name="sparkles" size={16} /></span>
            <span className="ih-goal-name">Create Template</span>
            <span className="ih-goal-note">Build your own starting point from scratch.</span>
            <Badge variant="neutral" size="sm" className="ih-goal-badge">
              <Icon name="lock" size={11} />Coming soon
            </Badge>
          </Surface>
        </div>
      </StepPanel>

      <StepPanel
        title="Campaign name"
        required
        narrow
        desc="Shown in your campaign list and on its insights page."
      >
        {/* The field is the point of this section, so it gets the width and
            sits directly under the heading. Behind a label in a right-hand
            column it read as a footnote to its own section. */}
        <Field
          error={showIssues && issue('name') ? { message: issue('name').message } : undefined}
          description={hasObjective
            ? 'Generate reads your objective, or write your own.'
            : 'Write the campaign objective below to generate one from it.'}
        >
          <div className="ih-row-stretch">
            <Input
              className="ih-grow"
              // The panel's heading names the section, not the control: a
              // screen reader on this field would otherwise have only the
              // placeholder, which disappears the moment anything is typed.
              aria-label="Campaign name"
              value={draft.name}
              placeholder="e.g. Post-delivery feedback · Bandra"
              aria-invalid={Boolean(showIssues && issue('name'))}
              onChange={(e) => update({ name: e.target.value })}
            />
            {/* Reads the objective, so it cannot run before there is one.
                Disabled rather than hidden: a control that appears out of
                nowhere never teaches what unlocked it. */}
            <Button
              variant="outline"
              disabled={!hasObjective}
              title={hasObjective ? 'Suggest a name from your objective' : 'Write the campaign objective first'}
              onClick={onSuggestName}
            >
              <Icon name="sparkles" size={14} />Generate
            </Button>
          </div>
        </Field>
      </StepPanel>

      <ObjectiveSection draft={draft} update={update} onSuggestName={onSuggestName} />

      <StepPanel
        title="Apps"
        insightKey={tip('pick-apps')}
        required
        narrow
        desc="Pick at least one. This limits which components you can use later."
        error={showIssues && issue('apps') ? issue('apps').message : ''}
      >
        <div className="ih-grid ih-g3">
          {APP_OPTIONS.map((a) => (
            <OptionCard
              key={a.id}
              checked={draft.apps.includes(a.id)}
              title={a.label}
              note={a.note}
              onChange={(on) => update({
                apps: on ? [...draft.apps, a.id] : draft.apps.filter((x) => x !== a.id),
              })}
            />
          ))}
        </div>
      </StepPanel>

      <StepPanel
        title="Campaign type"
        insightKey={tip('pick-type')}
        required
        narrow
        desc="How many versions of your content to run, and who decides the split."
        // FR-11 — channel is deliberately not here.
        note="You’ll choose the channel in the Content step."
      >
        <div className="ih-stack-sm">
          {TYPE_OPTIONS.map((t) => (
            <OptionCard
              key={t.id}
              as="radio"
              name="ctype"
              checked={draft.type === t.id}
              title={t.label}
              badge={t.recommended ? 'Recommended' : undefined}
              note={t.note}
              onChange={() => update({ type: t.id })}
            />
          ))}
        </div>
      </StepPanel>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Step 1 — campaign objective.

   The one field in the wizard that configures nothing. A goal id, a trigger
   and an audience describe what a campaign *does*; between them they cannot
   say what it is for, or what the reader is supposed to do with the answers.

   Deliberately not gated: FR-1 blocks on configuration, and a blocked advance
   on a free-text box is the fastest way to teach people to type "asdf".
   -------------------------------------------------------------------------- */
function ObjectiveSection({ draft, update, onSuggestName }) {
  const value = draft.objective || '';
  const current = GOALS.find((g) => g.id === draft.goal) || null;
  const read = suggestGoalFromObjective(value);
  const suggested = read && read !== draft.goal ? GOALS.find((g) => g.id === read) : null;

  return (
    <StepPanel
      id="s1-obj"
      title="Campaign objective"
      narrow
      desc="Gives the AI assistant context, so it can suggest what to pick as you build."
      actions={<Badge variant="neutral" size="sm">Optional</Badge>}
    >
      <div className="ih-stack">
        <Field>
          <Textarea
            rows={4}
            aria-label="Campaign objective"
            maxLength={OBJECTIVE_MAX}
            className="ih-objective"
            placeholder="e.g. Repeat orders in Bandra dropped 8% after the March update. Find out if it is the new tracking screen or the delivery time."
            value={value}
            onChange={(e) => update({ objective: e.target.value })}
          />
          <div className="ih-row-between ih-align-start">
            <Text size="xs" variant="secondary">
              Plain English — this doesn’t change what gets sent.
            </Text>
            <Text size="xs" variant="mono-secondary">{value.length}/{OBJECTIVE_MAX}</Text>
          </div>
        </Field>

        {/* The same action as Generate on the name field, offered where the
            text it reads is actually written. Appears with the objective:
            there is nothing to read before that. */}
        {value.trim() && (
          <div className="ih-row-wrap">
            <Button variant="outline" size="sm" onClick={onSuggestName}>
              <Icon name="sparkles" size={14} />Name this campaign
            </Button>
            <Text size="xs" variant="secondary">
              Fills the campaign name above from what you wrote.
            </Text>
          </div>
        )}

        {/* A keyword read of what was typed, offered and never applied. It is
            a claim about the text, so FR-91 puts it in the AI accent; it names
            the goal it read rather than silently re-picking one.

            Kumo's Banner has no AI variant — its four are default, alert,
            error and secondary — so the violet stays the product's own. */}
        {suggested && (
          <div className="ih-notice-ai" role="status">
            <Icon name="sparkles" size={16} />
            <span>
              This sounds like a <strong>{suggested.name}</strong> campaign
              {current && <>, not <strong>{current.name}</strong></>}.
              <Button
                variant="ghost" size="xs" className="ih-ml-6"
                onClick={() => update({ goal: suggested.id })}
              >
                Switch to {suggested.name}
              </Button>
            </span>
          </div>
        )}
      </div>
    </StepPanel>
  );
}
