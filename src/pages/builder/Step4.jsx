/* ==========================================================================
   Step 4 — Schedule, test & publish (FR-46 … FR-54)

   The old steps 5 and 6. Setting a start date and publishing were never two
   sittings: nobody schedules a campaign and then walks away from it, and the
   summary panel that used to open step 6 existed largely to tell the reader
   what they had just set on step 5. One step, one column, in the order the
   decision is actually made — when it runs, what it is, prove it, send it —
   with the phone preview alongside the whole of it.
   ========================================================================== */
import { Button, Input, Select, Radio, Badge, Banner, Text, Field } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { StepPanel, StepHead } from '../../app/wizard-kit.jsx';
import { PhonePreview } from '../../app/PhonePreview.jsx';
import { DateField } from '../../app/DateField.jsx';
import { GOALS, TEST_ACCOUNTS } from '../../lib/data.js';
import { audienceReach, templateOf } from '../../lib/store.js';
import { count } from '../../lib/format.js';
import { APP_OPTIONS, TYPE_OPTIONS } from './Step1.jsx';

export function Step4({
  draft, issues, showIssues, update, previewPick, onPreviewPick, onSendTest, onGoto,
}) {
  const s = draft.schedule;
  const variant = draft.variants[0];
  const reach = audienceReach(draft);
  const issue = (f) => issues.find((i) => i.field === f);
  const patchSchedule = (patch) => update({ schedule: { ...s, ...patch } });

  return (
    <section className="ih-ssections" aria-labelledby="s4">
      <StepHead title="Schedule & publish" id="s4">
        When enrolment opens, whether it closes, and a last look before you send.
      </StepHead>

      <div className="ih-step4-grid">
        <div className="ih-stack-lg">
          <StepPanel
            title="Start"
            required
            desc="When people start being enrolled."
            error={showIssues && issue('start') ? issue('start').message : ''}
          >
            {/* FR-46 — Now or Later; the date and time inputs are inert under Now. */}
            <div className="ih-stack-sm">
              <label className="ih-radio-row">
                <Radio
                  name="start"
                  checked={s.startMode === 'now'}
                  onCheckedChange={() => patchSchedule({ startMode: 'now' })}
                />
                <span className="ih-radio-label">Now</span>
                <Text size="sm" variant="secondary">Enrolment opens the moment you publish.</Text>
              </label>
              <label className="ih-radio-row">
                <Radio
                  name="start"
                  checked={s.startMode === 'later'}
                  onCheckedChange={() => patchSchedule({ startMode: 'later' })}
                />
                <span className="ih-radio-label">Later</span>
              </label>
              <div className="ih-when-row">
                {/* §11.4 had no entry for the raw <input type="date"> here.
                    Kumo's DatePicker is the calendar, not the field, so
                    DateField composes it with a Popover — see its own note.
                    Not DateRangePicker either: Start and End carry independent
                    Now/Never modes, which a range cannot express. */}
                <DateField
                  label="Start date"
                  disabled={s.startMode === 'now'}
                  value={s.startDate}
                  onChange={(startDate) => patchSchedule({ startDate })}
                />
                <Input
                  type="time"
                  className="ih-w-130"
                  aria-label="Start time"
                  disabled={s.startMode === 'now'}
                  value={s.startTime}
                  onChange={(e) => patchSchedule({ startTime: e.target.value })}
                />
              </div>
            </div>
          </StepPanel>

          <StepPanel
            title="End"
            required
            desc="Whether enrolment closes on its own. Any end date must be after the start."
            // FR-48 — a Never campaign keeps enrolling until an explicit manual stop.
            note={s.endMode === 'never' ? (
              <>
                With no end date this campaign keeps enrolling people until you{' '}
                <strong>Stop</strong> it, from its insights page after publishing.
              </>
            ) : ''}
            error={showIssues && issue('end') ? issue('end').message : ''}
          >
            {/* FR-47 — Never or End on; End must be after Start. */}
            <div className="ih-stack-sm">
              <label className="ih-radio-row">
                <Radio
                  name="end"
                  checked={s.endMode === 'never'}
                  onCheckedChange={() => patchSchedule({ endMode: 'never' })}
                />
                <span className="ih-radio-label">Never</span>
                <Text size="sm" variant="secondary">Runs until you stop it manually.</Text>
              </label>
              <label className="ih-radio-row">
                <Radio
                  name="end"
                  checked={s.endMode === 'end-on'}
                  onCheckedChange={() => patchSchedule({ endMode: 'end-on' })}
                />
                <span className="ih-radio-label">End on</span>
              </label>
              <div className="ih-when-row">
                <DateField
                  label="End date"
                  disabled={s.endMode === 'never'}
                  value={s.endDate}
                  onChange={(endDate) => patchSchedule({ endDate })}
                />
                <Input
                  type="time"
                  className="ih-w-130"
                  aria-label="End time"
                  disabled={s.endMode === 'never'}
                  value={s.endTime}
                  onChange={(e) => patchSchedule({ endTime: e.target.value })}
                />
              </div>
            </div>
          </StepPanel>

          <StepPanel
            title="Re-entry"
            desc="Whether someone who already responded can qualify again."
            note={s.allowReentry
              ? 'With re-entry on, one person can be counted more than once — so response figures on the insights page will read higher than unique users.'
              : ''}
          >
            <label className="ih-radio-row">
              <Radio
                name="reentry"
                checked={!s.allowReentry}
                onCheckedChange={() => patchSchedule({ allowReentry: false })}
              />
              <span className="ih-radio-label">Once per user</span>
              <Text size="sm" variant="secondary">A user who responded is never asked again.</Text>
            </label>
            <label className="ih-radio-row">
              <Radio
                name="reentry"
                checked={Boolean(s.allowReentry)}
                onCheckedChange={() => patchSchedule({ allowReentry: true })}
              />
              <span className="ih-radio-label">Allow re-entry</span>
              <Text size="sm" variant="secondary">They qualify again on the next trigger.</Text>
            </label>
          </StepPanel>

          <StepPanel
            title="Ready to publish"
            desc="A last look at everything you have set."
            actions={<Badge variant="outline" size="sm">{draft.campaignId}</Badge>}
          >
            <div className="ih-stack-sm">
              {[
                ['Goal', GOALS.find((g) => g.id === draft.goal)?.name || '—'],
                ['Apps', draft.apps.map((a) => APP_OPTIONS.find((o) => o.id === a)?.label || a).join(' · ')],
                ['Type', TYPE_OPTIONS.find((t) => t.id === draft.type)?.label || '—'],
                ['Audience', `${count(reach.reach)} estimated reach`],
                ['Variants', draft.variants.map((v) => `${v.name} ${v.weight}%`).join(' · ')],
                ['Trigger', draft.variants.map((v) => `${v.trigger.event} + ${v.trigger.delayValue} ${v.trigger.delayUnit}`).join(' · ')],
                ['Schedule', s.startMode === 'now' ? 'Starts on publish' : `Starts ${s.startDate} ${s.startTime}`],
                ['Ends', s.endMode === 'never' ? 'Never — until manually stopped' : `${s.endDate} ${s.endTime}`],
              ].map(([k, v]) => (
                <div className="ih-summary-row" key={k}>
                  <Text size="xs" variant="secondary">{k}</Text>
                  <Text size="sm" className="ih-ta-r">{v}</Text>
                </div>
              ))}

              {/* The objective is prose, so it gets a block rather than a
                  right-aligned cell — and it is repeated here because this is
                  the last screen before the campaign leaves the builder and
                  the reason it exists stops being editable in one place. */}
              <div className="ih-mt-8">
                <Text size="xs" variant="secondary">Objective</Text>
                {draft.objective && draft.objective.trim() ? (
                  <Text className="ih-block ih-mt-4">{draft.objective.trim()}</Text>
                ) : (
                  <Text variant="secondary" className="ih-block ih-mt-4">
                    Not set. This campaign will publish with no record of why you built it.
                    <Button variant="ghost" size="xs" onClick={() => onGoto(1)}>
                      Add one on step 1
                    </Button>
                  </Text>
                )}
              </div>
            </div>
          </StepPanel>

          {/* FR-51 — a Test action beside a saved-account select and a direct user ID. */}
          <StepPanel
            title="Send a test"
            desc="See the real thing on your own device before anyone else does."
            // OD-5 — test is not a hard gate, and the preview simulates branches.
            note="Testing is optional. The preview on the right is interactive — tap a rating to see where that answer leads."
          >
            <div className="ih-stack">
              <div className="ih-grid ih-g2">
                <Field label="Test account">
                  <Select
                    placeholder="Select a saved test account"
                    value={draft.test.account || ''}
                    items={Object.fromEntries(TEST_ACCOUNTS.map((t) => [t.id, t.label]))}
                    onValueChange={(account) => update({ test: { ...draft.test, account } })}
                  />
                </Field>
                <Field label="…or a user ID">
                  <Input
                    className="ih-mono"
                    placeholder="e.g. u_88213045"
                    value={draft.test.userId}
                    onChange={(e) => update({ test: { ...draft.test, userId: e.target.value } })}
                  />
                </Field>
              </div>
              <div className="ih-row-gap">
                <Button
                  variant="secondary"
                  disabled={!draft.test.account && !draft.test.userId}
                  onClick={onSendTest}
                >
                  <Icon name="send" size={14} />Send test
                </Button>
                {draft.test.hasRun && (
                  <Badge variant="primary" size="sm"><Icon name="check" size={11} />Test sent</Badge>
                )}
              </div>
              {/* FR-52 — test sends never reach the results dashboard. */}
              <Banner
                variant="secondary"
                icon={<Icon name="info" size={16} />}
                description="Test responses never appear on the insights page."
              />
            </div>
          </StepPanel>
        </div>

        <aside className="ih-preview-rail">
          <div className="ih-row-between ih-mb-10">
            <h3 className="ih-t-h2">Mobile preview</h3>
            {previewPick && (
              <Button variant="ghost" size="xs" onClick={() => onPreviewPick(null)}>Reset</Button>
            )}
          </div>
          {/* FR-50 / FR-54 — the actual configured questions, tappable through the branch. */}
          <PhonePreview
            variant={variant}
            interactive
            picked={previewPick}
            onRate={onPreviewPick}
          />
          <Text size="sm" variant="secondary" className="ih-block ih-mt-8 ih-w-292">
            Showing {templateOf(variant)?.name || 'no template'} on {variant.channel}, with the
            questions from the Content step.
          </Text>
        </aside>
      </div>
    </section>
  );
}
