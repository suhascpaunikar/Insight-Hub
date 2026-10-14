/* ==========================================================================
   Step 3 — Content (FR-19 … FR-45)

   Each variant has its own content, questions and trigger. The variant tabs
   sit below the step chrome and read a level down, which is what §11.4's
   "`underline` is the sub-tabs" is for.
   ========================================================================== */
import { useEffect, useState } from 'react';
import {
  Button, Input, Select, Switch, Badge, Banner, Text, Field, Tabs,
  DropdownMenu, LayerCard, Empty, Surface,
} from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { StepPanel, StepHead, OptionCard, focusPanel } from '../../app/wizard-kit.jsx';
import { PhonePreview } from '../../app/PhonePreview.jsx';
import { ConfirmDialog } from '../../app/dialogs.jsx';
import { AddContentDialog } from './AddContentDialog.jsx';
import { useStore } from '../../lib/useStore.js';
import { toast } from '../../lib/toast.js';
import { clamp } from '../../lib/format.js';
import { templateOf, variantScaleMax, createVariant, evenSplit } from '../../lib/store.js';
import { BANDS, BAND_LABEL, bandRange } from '../../lib/palette.js';
import {
  CHANNELS, TEMPLATE_CATEGORIES, TEMPLATES, TRIGGER_EVENTS, ELEMENTS,
} from '../../lib/data.js';

export function ContentStep({ draft, issues, showIssues, update, jump = null }) {
  const store = useStore();
  const [activeId, setActiveId] = useState(draft.variants[0].id);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [confirm, setConfirm] = useState(null);
  const [addContent, setAddContent] = useState(false);
  /* The rating tapped in the preview, and what it was tapped against.
     This step has variant tabs and step 4 does not, so a pick here cannot be a
     bare number: variant B can carry a different rating element and a
     different scale, and a 9 picked on a 1–10 NPS means nothing on the
     5-point star next door. Stored with the reading it was made under and
     ignored the moment that reading changes, which keeps it out of an effect
     — there is no stale value to clear, only one that stops applying. */
  const [pick, setPick] = useState(null);

  useEffect(() => {
    if (!draft.variants.some((v) => v.id === activeId)) setActiveId(draft.variants[0].id);
  }, [draft.variants, activeId]);

  /* A readiness jump lands on a panel, and on this step every panel is a
     panel *of a variant* — so "Variant B needs a whole-number delay" has to
     select Variant B before the delay field is the one under the cursor.
     Keyed on the jump object rather than on the id: taking the same line twice
     is two jumps, and the second one must still land. */
  useEffect(() => {
    if (jump?.variantId && draft.variants.some((v) => v.id === jump.variantId)) {
      setActiveId(jump.variantId);
    }
  }, [jump, draft.variants]);

  const variant = draft.variants.find((v) => v.id === activeId) || draft.variants[0];
  const template = templateOf(variant);
  /* Which preview a pick belongs to. The scale is in the key because the band
     a number falls in is decided by it — 3 is a detractor out of 10 and a
     passive out of 5. */
  const previewKey = `${variant.id}:${variant.ratingElement}:${variantScaleMax(variant)}`;
  const picked = pick && pick.key === previewKey ? pick.value : null;
  const aiManaged = draft.type === 'intelligent-ab';
  const weightTotal = draft.variants.reduce((s, v) => s + Number(v.weight || 0), 0);
  const issue = (field) => issues.find((i) => i.field === field);

  // FR-19 / FR-20 — A/B reconciles back up to two variants, so deleting is only
  // offered above that floor; Regular never has more than one tab.
  const canDelete = draft.type !== 'regular' && draft.variants.length > 2;
  const divergent = draft.variants.length > 1
    && new Set(draft.variants.map((v) => `${v.trigger.event}|${v.trigger.delayValue}|${v.trigger.delayUnit}`)).size > 1;

  const patch = (p) => store.patchVariant(variant.id, p);
  const patchTrigger = (p) => patch({ trigger: { ...variant.trigger, ...p } });

  return (
    <section className="ih-ssections" aria-labelledby="step-3-heading">
      <StepHead title="Content" id="step-3-heading">
        Each variant has its own content, questions and trigger.
      </StepHead>

      {/* FR-70 — variant tabs sit below the step rail and read a level down. */}
      <div className="ih-variant-tabs">
        <Tabs
          variant="underline"
          size="sm"
          value={variant.id}
          onValueChange={setActiveId}
          aria-label="Variants"
          tabs={draft.variants.map((v) => ({
            value: v.id,
            label: (
              <span className="ih-variant-tab">
                {v.name || 'Untitled variant'}
                <Badge variant="outline" size="sm">{v.weight}%</Badge>
              </span>
            ),
          }))}
        />
        {canDelete && (
          <Button
            variant="ghost" size="sm" shape="square"
            aria-label={`Delete ${variant.name || 'this variant'}`}
            onClick={() => setConfirm({ kind: 'del-variant', victim: variant })}
          >
            <Icon name="x" size={13} />
          </Button>
        )}
        {draft.type !== 'regular' && (
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              const letter = String.fromCharCode(65 + draft.variants.length);
              const next = evenSplit([...draft.variants, createVariant(`Variant ${letter}`, 0, draft.goal)]);
              update({ variants: next });
              setActiveId(next[next.length - 1].id);
            }}
          >
            <Icon name="plus" size={14} />Add variant
          </Button>
        )}
      </div>

      <div className="ih-content-grid">
        <div className="ih-stack-lg">
          <StepPanel
            title="Variant"
            field="variant"
            desc="What this variant is called, and how much of the audience it gets."
          >
            <div className="ih-srow">
              <div className="ih-srow-main">
                {/* FR-22 / FR-23 — the name drives the tab label live and never versions. */}
                <label className="ih-srow-label" htmlFor="vname">Variant name</label>
                <p className="ih-srow-desc">
                  Renaming does not create a new version, and it carries through to the insights page.
                </p>
              </div>
              <div className="ih-srow-ctl">
                <Input
                  id="vname"
                  value={variant.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
            </div>

            {/* FR-24 — weightage sits above the template/component picker. */}
            <div className="ih-srow ih-srow-top">
              <div className="ih-srow-main">
                <label className="ih-srow-label" htmlFor="weight">Weightage</label>
                <p className="ih-srow-desc">The share of the audience this variant is served to.</p>
              </div>
              <div className="ih-srow-ctl ih-srow-ctl-auto">
                {aiManaged ? (
                  /* FR-25 / OD-6 — the even starting split is visible; the AI
                     moves it after launch. Kumo's Banner has no AI variant, so
                     the violet stays the product's (FR-91). */
                  <div className="ih-notice-ai">
                    <Icon name="sparkles" size={16} />
                    <span>
                      <span className="ih-mono">{variant.weight}%</span> · AI-managed, starting at
                      an even split. Weight shifts toward whichever variant accumulates more
                      engagement.
                    </span>
                  </div>
                ) : (
                  <div className="ih-row-gap">
                    <Input
                      id="weight" type="number" min="0" max="100" className="ih-w-88"
                      disabled={draft.variants.length === 1}
                      value={variant.weight}
                      onChange={(e) => patch({ weight: clamp(Number(e.target.value) || 0, 0, 100) })}
                    />
                    <Text size="sm" variant="secondary">%</Text>
                    {draft.variants.length > 1 && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => update({ variants: evenSplit(draft.variants) })}
                      >
                        Even split
                      </Button>
                    )}
                  </div>
                )}
                <Text size="xs" variant={weightTotal === 100 ? 'mono-secondary' : 'error'}>
                  Total across variants: {weightTotal}%
                </Text>
              </div>
            </div>
          </StepPanel>

          <StepPanel
            title="Template & component"
            field="template"
            required
            desc="How this variant is delivered, and what it looks like."
            actions={variant.templateId && (
              <Text size="xs" variant="mono-secondary">In use: {variant.templateId}</Text>
            )}
            error={issue(`template:${variant.id}`)?.message || ''}
          >
            <TemplatePicker
              draft={draft} variant={variant}
              query={query} setQuery={setQuery}
              group={group} setGroup={setGroup}
              onChannel={(channel) => patch({ channel, templateId: null })}
              onCategory={(templateCategory) => { setGroup('all'); patch({ templateCategory }); }}
              onPick={(id) => {
                if (variant.templateId === id) return;
                // FR-34 — switching template destroys configured content.
                if (variant.templateId) { setConfirm({ kind: 'template', from: variant.templateId, to: id }); return; }
                patch({ templateId: id, elements: [] });
              }}
            />
          </StepPanel>

          {template && (
            <StepPanel
              title="Content elements"
              field="elements"
              desc="What goes inside the template. You edit the content, not the layout."
              // FR-35 — the add-content modal lists the elements this component allows.
              actions={
                <Button variant="outline" size="sm" onClick={() => setAddContent(true)}>
                  <Icon name="plus" size={14} />Add content
                </Button>
              }
            >
              {variant.elements.length === 0 ? (
                <Text size="sm" variant="secondary">
                  The template’s own slots are already populated. Add an element to place another
                  one inside them — you edit values, never the layout.
                </Text>
              ) : (
                <ul className="ih-stack-sm">
                  {variant.elements.map((e) => {
                    const meta = ELEMENTS.find((x) => x.type === e.type);
                    return (
                      <LayerCard render={<li />} className="ih-element-row" key={e.id}>
                        <span className="ih-row-gap">
                          <Icon name={meta?.icon || 'dot'} size={15} />
                          <span className="ih-col">
                            <Input
                              size="sm" className="ih-w-280"
                              aria-label="Element label"
                              value={e.label}
                              onChange={(ev) => patch({
                                elements: variant.elements.map((x) => (
                                  x.id === e.id ? { ...x, label: ev.target.value } : x)),
                              })}
                            />
                            <Text size="xs" variant="secondary">{meta?.name || e.type}</Text>
                          </span>
                        </span>
                        <Button
                          variant="ghost" size="sm" shape="square"
                          aria-label="Remove element"
                          onClick={() => patch({ elements: variant.elements.filter((x) => x.id !== e.id) })}
                        >
                          <Icon name="trash" size={14} />
                        </Button>
                      </LayerCard>
                    );
                  })}
                </ul>
              )}
            </StepPanel>
          )}

          {template && (
            <StepPanel
              title="Questions"
              required
              desc="What people are asked, and where each answer takes them next."
            >
              <QuestionLogic variant={variant} template={template} patch={patch} />
            </StepPanel>
          )}

          <StepPanel
            title="Trigger, event & delay"
            field="trigger"
            required
            desc="What enrols someone into this variant, and how long after to ask them."
            // FR-44 / FR-45 — per-variant trigger; delay is a text input, not a dropdown.
            actions={draft.variants.length > 1 && (
              <DropdownMenu>
                <DropdownMenu.Trigger render={
                  <Button variant="secondary" size="sm">
                    <Icon name="copy" size={14} />Copy trigger from a variant
                  </Button>
                } />
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Group>
                    <DropdownMenu.Label>Copy from</DropdownMenu.Label>
                    {draft.variants.filter((v) => v.id !== variant.id).map((v) => (
                      <DropdownMenu.Item
                        key={v.id}
                        icon={<Icon name="copy" size={14} />}
                        onClick={() => patch({ trigger: { ...v.trigger } })}
                      >
                        <span className="ih-col">
                          <span>{v.name}</span>
                          <Text size="xs" variant="mono-secondary">
                            {v.trigger.event} + {v.trigger.delayValue} {v.trigger.delayUnit}
                          </Text>
                        </span>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          >
            <div className="ih-stack">
              <div className="ih-grid ih-g3">
                <Field label="Event">
                  <Select
                    value={variant.trigger.event}
                    items={Object.fromEntries(TRIGGER_EVENTS.map((e) => [e, e]))}
                    onValueChange={(event) => patchTrigger({ event })}
                  />
                </Field>
                <Field
                  label="Delay"
                  error={issue(`delay:${variant.id}`)
                    ? { message: issue(`delay:${variant.id}`).message } : undefined}
                  description="Any whole number — 35 minutes is as valid as 30."
                >
                  <Input
                    className="ih-mono"
                    inputMode="numeric"
                    placeholder="e.g. 35"
                    value={variant.trigger.delayValue}
                    aria-invalid={Boolean(issue(`delay:${variant.id}`))}
                    onChange={(e) => patchTrigger({ delayValue: e.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Select
                    value={variant.trigger.delayUnit}
                    items={{ min: 'minutes', hour: 'hours', day: 'days' }}
                    onValueChange={(delayUnit) => patchTrigger({ delayUnit })}
                  />
                </Field>
              </div>

              {divergent && (
                <Banner
                  variant="alert"
                  icon={<Icon name="warn" size={16} />}
                  description="Your variants use different triggers, so content is no longer the only thing that changed. The insights page will flag this comparison as not like-for-like."
                />
              )}
            </div>
          </StepPanel>
        </div>

        <aside className="ih-preview-rail">
          <div className="ih-row-between ih-mb-10">
            <h3 className="ih-t-h2">Preview</h3>
            {picked && (
              <Button variant="ghost" size="xs" onClick={() => setPick(null)}>Reset</Button>
            )}
          </div>
          {/* FR-54, on the step that writes the branches rather than only on
              the one that ships them. A rating is what reveals the follow-up
              and the open text — without one this preview showed the rating
              question and stopped, which is a preview of a third of what this
              step configures. Tapping through is also what makes the rest of
              it reachable: every field the preview can point at is on this
              step, so pressing a part is a scroll and a focus rather than a
              journey, and Q2 and Q3 had no part to press. */}
          <PhonePreview
            variant={variant}
            interactive
            picked={picked}
            onRate={(value) => setPick({ key: previewKey, value })}
            onEdit={focusPanel}
          />
          <Text size="xs" variant="secondary" className="ih-block ih-mt-8">
            Tap a rating to walk the branch it leads to. Press any wording to edit what wrote it.
          </Text>
        </aside>
      </div>

      <AddContentDialog
        open={addContent}
        variant={variant}
        template={template}
        onClose={() => setAddContent(false)}
        onAdd={(element) => { patch({ elements: [...variant.elements, element] }); setAddContent(false); }}
      />

      <ConfirmDialog
        open={confirm?.kind === 'template'}
        title="Change the template?"
        confirmLabel="Change and discard content"
        cancelLabel="Keep current template"
        onClose={() => setConfirm(null)}
        onConfirm={() => { patch({ templateId: confirm.to, elements: [] }); setConfirm(null); }}
      >
        Changing from <span className="ih-mono">{confirm?.from}</span> to{' '}
        <span className="ih-mono">{confirm?.to}</span> will result in the loss of the content
        configured in this variant — every added element, and any copy in slots the new template
        does not have.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'del-variant'}
        title={`Delete ${confirm?.victim?.name || 'this variant'}?`}
        confirmLabel="Delete variant"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          /* Weights must total 100, so the remainder is re-split the same way
             add-variant splits them. */
          const next = evenSplit(draft.variants.filter((v) => v.id !== confirm.victim.id));
          update({ variants: next });
          setActiveId(next[0].id);
          toast('Variant deleted', `${confirm.victim.name || 'The variant'} was removed and weights re-split.`);
          setConfirm(null);
        }}
      >
        Its template, elements, questions and trigger go with it. The remaining variants go back
        to an even split.
      </ConfirmDialog>
    </section>
  );
}

/* ---------- Template picker (FR-26 … FR-34) ---------- */

function TemplatePicker({
  draft, variant, query, setQuery, group, setGroup, onChannel, onCategory, onPick,
}) {
  // OD-1 resolved: channel is chosen above the category tabs, before the grid.
  // FR-29 — a channel the selected apps cannot serve never appears at all.
  const channels = CHANNELS.filter((c) => c.apps.some((a) => draft.apps.includes(a)));
  const categories = TEMPLATE_CATEGORIES.filter((c) =>
    (draft.goal === 'sale-push' ? c.id === 'basic' || c.id === 'custom-html' : true));

  const inCategory = TEMPLATES.filter(
    (t) => t.category === variant.templateCategory && t.channels.includes(variant.channel));
  const groups = [...new Set(inCategory.map((t) => t.group))];

  const q = query.trim().toLowerCase();
  const visible = inCategory.filter((t) => {
    const matches = !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    return matches && (group === 'all' || t.group === group);
  });

  return (
    <div className="ih-stack">
      <div className="ih-stack-sm">
        <Text size="xs" variant="secondary">Channel</Text>
        {/* OD-1 — channel is a card, not a chip: it decides which elements
            exist later, so it reads as a choice rather than a filter. */}
        <div className="ih-grid ih-g3" role="group" aria-label="Channel">
          {channels.map((c) => (
            <Surface
              key={c.id}
              render={<button type="button" />}
              className={`ih-opt${variant.channel === c.id ? ' ih-opt-on' : ''}`}
              aria-pressed={variant.channel === c.id}
              onClick={() => onChannel(c.id)}
            >
              <span className="ih-opt-icon"><Icon name={c.icon} size={16} /></span>
              <span className="ih-opt-body">
                <span className="ih-opt-title">{c.label}</span>
                <span className="ih-opt-note">{c.note}</span>
              </span>
            </Surface>
          ))}
        </div>
        <Text size="xs" variant="secondary">
          Components your apps cannot render are hidden, not disabled.
        </Text>
      </div>

      {/* FR-26 — the category tabs. */}
      <Tabs
        variant="segmented"
        size="sm"
        value={variant.templateCategory}
        onValueChange={onCategory}
        aria-label="Template categories"
        tabs={categories.map((c) => ({ value: c.id, label: c.label }))}
      />

      <div className="ih-row-wrap">
        <Input
          size="sm"
          className="ih-grow"
          placeholder="Search templates"
          aria-label="Search templates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Text size="xs" variant="mono-secondary">Showing: {visible.length} Templates</Text>
        <DropdownMenu>
          <DropdownMenu.Trigger render={
            <Button variant="secondary" size="sm"><Icon name="filter" size={14} />Filter</Button>
          } />
          <DropdownMenu.Content align="end">
            <DropdownMenu.RadioGroup value={group} onValueChange={setGroup}>
              <DropdownMenu.RadioItem value="all">All templates</DropdownMenu.RadioItem>
              {groups.map((g) => (
                <DropdownMenu.RadioItem key={g} value={g}>{g}</DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {visible.length === 0 ? (
        <Empty description={`Nothing in ${TEMPLATE_CATEGORIES.find((c) => c.id === variant.templateCategory)?.label || ''} matches your search and filter on this channel.`}>
          <Button
            variant="outline" size="sm"
            onClick={() => { setQuery(''); setGroup('all'); }}
          >
            Clear search and filter
          </Button>
        </Empty>
      ) : (
        [...new Set(visible.map((t) => t.group))].map((g) => (
          <div key={g}>
            {/* FR-27 — grouped by content composition, each a labelled row. */}
            <div className="ih-tpl-group-head"><Text size="xs" variant="secondary">{g}</Text></div>
            <div className="ih-tpl-grid">
              {visible.filter((t) => t.group === g).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ih-tpl-card${variant.templateId === t.id ? ' ih-opt-on' : ''}`}
                  aria-pressed={variant.templateId === t.id}
                  onClick={() => onPick(t.id)}
                >
                  <span className="ih-tpl-name">
                    <b className="truncate">{t.name}</b>
                    <i>{t.id}</i>
                  </span>
                  <DevicePreview kind={t.preview} />
                  {/* FR-32 — hover surfaces the primary action over the preview. */}
                  <span className="ih-tpl-hover">
                    <span className="ih-tpl-cta">
                      {variant.templateId === t.id && <Icon name="check" size={13} />}
                      {variant.templateId === t.id ? 'In use' : 'Use This Template'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** A wireframe of what the template lays out — bars and blocks, never copy. */
function DevicePreview({ kind }) {
  const bar = (w, key) => <div className={`ih-dv-line ih-${w}`} key={key} />;
  const bodies = {
    'content-image': <><div className="ih-dv ih-dv-img ih-h-34" /><div className="ih-dv-col">{bar('w70', 1)}{bar('w45', 2)}</div></>,
    'image-only': <div className="ih-dv ih-dv-img ih-h-70" />,
    rating: (
      <div className="ih-dv-col">
        {bar('w70', 1)}
        <div className="ih-dv-dots">{Array.from({ length: 5 }, (_, i) => <span className="ih-dv-dot" key={i} />)}</div>
        {bar('w45', 2)}
        <div className="ih-dv ih-h-22" />
      </div>
    ),
    form: (
      <div className="ih-dv-col">
        {bar('w70', 1)}
        <div className="ih-dv ih-h-14" /><div className="ih-dv ih-h-14" />
        <div className="ih-dv ih-h-16 ih-dv-cta" />
      </div>
    ),
    html: <><div className="ih-dv-col">{bar('w45', 1)}<div className="ih-dv ih-dv-img ih-h-38" />{bar('w70', 2)}</div></>,
  };
  return <span className="ih-device">{bodies[kind] || bodies.form}</span>;
}

/* ---------- Question logic (FR-38 … FR-43) ---------- */

function QuestionLogic({ variant, template, patch }) {
  const supports = template?.supports || [];
  const canRate = supports.includes('nps') || supports.includes('star');
  const max = variantScaleMax(variant);
  // FR-40 — star rating branching is always on; NPS branching is opt-in.
  const branchingOn = variant.ratingElement === 'star' ? true : variant.branchingEnabled;

  if (!canRate) {
    return (
      <Banner
        variant="secondary"
        icon={<Icon name="info" size={16} />}
        title={`${template?.name || 'This component'} cannot carry a rating question`}
        description="There is no question logic to set. Use Add content above to add what it does support."
      />
    );
  }

  const patchBranch = (band, p) => patch({
    branches: { ...variant.branches, [band]: { ...variant.branches[band], ...p } },
  });

  return (
    <div className="ih-stack">
      <div className="ih-grid ih-g2">
        <Field label="Q1 · Rating element" description="NPS is the default. Star rating is always 5 points.">
          <div className="ih-row-gap">
            {/* FR-38 — NPS is pre-selected on a Ratings template; star is a swap. */}
            <Button
              size="sm"
              variant={variant.ratingElement === 'nps' ? 'secondary' : 'ghost'}
              aria-pressed={variant.ratingElement === 'nps'}
              disabled={!supports.includes('nps')}
              onClick={() => patch({ ratingElement: 'nps' })}
            >
              <Icon name="target" size={14} />NPS rating
            </Button>
            <Button
              size="sm"
              variant={variant.ratingElement === 'star' ? 'secondary' : 'ghost'}
              aria-pressed={variant.ratingElement === 'star'}
              disabled={!supports.includes('star')}
              onClick={() => patch({ ratingElement: 'star' })}
            >
              <Icon name="star" size={14} />Star rating
            </Button>
          </div>
        </Field>

        <Field label="Scale">
          {variant.ratingElement === 'star' ? (
            <div className="ih-row-gap">
              <Badge variant="outline" size="sm">1–5</Badge>
              <Text size="sm" variant="secondary">Star rating is always a 5-point scale.</Text>
            </div>
          ) : (
            /* FR-39 — 1–5 or 1–10; the higher number is the more positive response. */
            <div className="ih-row-gap">
              {[5, 10].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={max === s ? 'secondary' : 'ghost'}
                  aria-pressed={max === s}
                  onClick={() => patch({ npsScale: s })}
                >
                  1–{s}
                </Button>
              ))}
              <Text size="sm" variant="secondary">{max} is the most positive response.</Text>
            </div>
          )}
        </Field>
      </div>

      <div data-field="q1-text" tabIndex={-1}>
        <Field label="Q1 · Question text">
          <Input
            value={variant.ratingQuestion}
            onChange={(e) => patch({ ratingQuestion: e.target.value })}
          />
        </Field>
      </div>

      <div className="ih-well">
        <div className="ih-row-between">
          <div>
            <span className="ih-t-h3">Q2 · Follow-up differs by rating band</span>
            <Text size="sm" variant="secondary" className="ih-block">
              {variant.ratingElement === 'star'
                ? 'Star rating always branches, so all three bands below are in play.'
                : 'Off by default. Turn it on to ask different follow-ups by rating.'}
            </Text>
          </div>
          <Switch
            aria-label="Enable conditional branching"
            checked={branchingOn}
            disabled={variant.ratingElement === 'star'}
            onCheckedChange={(checked) => patch({ branchingEnabled: checked })}
          />
        </div>
      </div>

      {branchingOn ? (
        <div className="ih-stack">
          {BANDS.map((band) => (
            <BranchEditor
              key={band}
              band={band}
              max={max}
              branch={variant.branches[band]}
              onPatch={(p) => patchBranch(band, p)}
            />
          ))}
        </div>
      ) : (
        <Banner
          variant="secondary"
          icon={<Icon name="info" size={16} />}
          description="Everyone sees the same follow-up. Turn branching on to ask detractors, passives and promoters different questions."
        />
      )}

      {/* FR-43 — Q3 is always present regardless of branch. */}
      <div data-field="q3-text" tabIndex={-1}>
        <Field label="Q3 · Open text — always asked" description="Shown to everyone, whatever they answered.">
          <Input
            value={variant.openTextQuestion}
            onChange={(e) => patch({ openTextQuestion: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function BranchEditor({ band, max, branch, onPatch }) {
  const move = (id, dir) => {
    const list = [...branch.choices];
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onPatch({ choices: list });
  };

  return (
    /* The preview's follow-up points here, at the band it is showing rather
       than at the Questions panel as a whole — three bands share that panel
       and only one of them wrote the words on screen. */
    <div className="ih-well" data-field={`q2-${band}`} tabIndex={-1}>
      <div className="ih-row-between ih-mb-8">
        <span className="ih-row-gap">
          <span className="ih-t-h3">{BAND_LABEL[band]}</span>
          <Badge variant="outline" size="sm">{bandRange(band, max)}</Badge>
        </span>
        <Text size="xs" variant="secondary">{branch.choices.length} choices</Text>
      </div>
      <Input
        size="sm"
        value={branch.question}
        placeholder="Type here"
        aria-label={`${BAND_LABEL[band]} follow-up question`}
        onChange={(e) => onPatch({ question: e.target.value })}
      />
      <ul className="ih-stack-sm ih-mt-8">
        {branch.choices.map((choice, i) => (
          <li className="ih-choice-row" key={choice.id}>
            {/* FR-42 — each choice renders as a labelled chip with editable text. */}
            <Badge variant="outline" size="sm" className="ih-choice-letter">
              {String.fromCharCode(65 + i)}
            </Badge>
            <Input
              size="sm" className="ih-grow"
              aria-label={`Choice ${String.fromCharCode(65 + i)}`}
              value={choice.text}
              onChange={(e) => onPatch({
                choices: branch.choices.map((c) => (c.id === choice.id ? { ...c, text: e.target.value } : c)),
              })}
            />
            <Button variant="ghost" size="sm" shape="square" disabled={i === 0}
              aria-label="Move choice up" onClick={() => move(choice.id, -1)}>
              <Icon name="up" size={13} />
            </Button>
            <Button variant="ghost" size="sm" shape="square" disabled={i === branch.choices.length - 1}
              aria-label="Move choice down" onClick={() => move(choice.id, 1)}>
              <Icon name="down" size={13} />
            </Button>
            <Button variant="ghost" size="sm" shape="square" disabled={branch.choices.length <= 2}
              aria-label="Remove choice"
              onClick={() => onPatch({ choices: branch.choices.filter((c) => c.id !== choice.id) })}>
              <Icon name="trash" size={13} />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline" size="sm" className="ih-mt-8"
        onClick={() => onPatch({
          choices: [...branch.choices, { id: `ch_${Math.random().toString(36).slice(2, 9)}`, text: '' }],
        })}
      >
        <Icon name="plus" size={14} />Add choice
      </Button>
    </div>
  );
}
