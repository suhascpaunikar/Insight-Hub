/* ==========================================================================
   wizard-kit.jsx — the wizard's own section and card patterns.

   The settings screen's shape, borrowed for the wizard. A heading and one line
   of explanation sit outside the box; every choice that heading governs sits
   inside it. What this buys is scanning: a step reads as three or four bounded
   regions with a name each, rather than one undifferentiated column of
   controls the reader has to parse in order to find the boundaries.

   The radio card is §11.4's "no single Kumo card-radio; compose it" — Surface
   plus a real Radio or Checkbox, so the control is Kumo's and keyboard and
   screen-reader behaviour come with it, while the card around it is ours.
   ========================================================================== */
import { Surface, Text, Checkbox, Radio, Badge } from '@cloudflare/kumo';
import { HoverCard } from './HoverCard.jsx';
import { Icon } from '../lib/icons.jsx';

/**
 * `field` names the validation fields this panel owns, so the readiness card
 * on the stepper can send a reader to the place a blocking issue is fixed
 * rather than only telling them which step it is on. `store.issueTarget` maps
 * an issue's field onto one of these names.
 */
export function StepPanel({
  id, title, desc, required, actions, note, error, narrow, insightKey, field, children,
}) {
  return (
    <section
      className={`ih-ssection${narrow ? ' ih-ssection-narrow' : ''}`}
      data-insight={insightKey || undefined}
      data-field={field || undefined}
      /* Focusable only as the target of a jump, never in the tab order: the
         controls inside it are what a reader tabs through. */
      tabIndex={field ? -1 : undefined}
    >
      <div className="ih-ssection-head">
        <div className="ih-min-0">
          <h3 className="ih-ssection-title" id={id}>
            {title}{required && <span className="ih-req">*</span>}
          </h3>
          {desc && <p className="ih-ssection-desc">{desc}</p>}
        </div>
        {actions && <div className="ih-ssection-actions">{actions}</div>}
      </div>
      <div className="ih-sbody">
        {children}
        {note && <div className="ih-sbody-note">{note}</div>}
      </div>
      {error && <p className="ih-error" role="alert">{error}</p>}
    </section>
  );
}

export function StepHead({ title, children, id }) {
  return (
    <header className="ih-sstep-head">
      <h2 className="ih-t-h1" id={id}>{title}</h2>
      {children && <p className="ih-sstep-desc">{children}</p>}
    </header>
  );
}

/**
 * A set of choice cards, exactly one of which is picked.
 *
 * §11.4's note — "no single Kumo card-radio; compose it" — was read as "a
 * Surface with a `Radio` inside", and `Radio` is not a control. It is a
 * namespace: `Radio.Group` holds the value and the arrow-key navigation,
 * `Radio.Item` is the control. A bare `<Radio>` renders the group's own shell
 * around no items at all — `<div role="radiogroup"><fieldset/></div>` — which
 * is why the campaign type and the target audience could be read and never
 * chosen. `Checkbox` does work standalone, which is how the two variants of
 * one component came to behave differently.
 *
 * So the group is a component now, because that is the shape of the thing
 * Kumo actually ships: one radiogroup per question, not one per answer.
 *
 * `columns` lays the items out. The class goes on the group and the rule
 * reaches the wrapper Kumo renders inside it, since `Radio.Group` composes its
 * own fieldset and there is no prop for the box the items sit in.
 */
export function OptionCardGroup({ legend, value, onValueChange, columns, children }) {
  return (
    <Radio.Group
      value={value}
      onValueChange={onValueChange}
      className={`ih-optgroup${columns ? ` ih-optgroup-${columns}` : ''}`}
    >
      {/* `Radio.Legend` rather than the `legend` prop, which renders a visible
          heading — and the panel this sits in already carries that heading, so
          the prop printed the question twice. The group still needs a name, so
          it is hidden rather than dropped. */}
      <Radio.Legend className="ih-sr-only">{legend}</Radio.Legend>
      {children}
    </Radio.Group>
  );
}

/**
 * A choice that is a card rather than a line: the label, a note under it, and
 * the control that actually carries the state.
 *
 * `as` picks which Kumo control sits inside — `checkbox` for a set, `radio`
 * for a choice. The two are composed differently because Kumo composes them
 * differently: a checkbox owns its own checked state and stands alone, while a
 * radio is an item of the group that owns the value, so the radio variant
 * takes its `value` and must sit inside an `OptionCardGroup`.
 *
 * Either way the card is a <label>, so the whole surface is the target and the
 * control keeps its own semantics.
 */
export function OptionCard({
  as = 'checkbox', value, checked, onChange, title, note, badge, children,
}) {
  const body = (
    <span className="ih-opt-body">
      <span className="ih-opt-title">
        {title}
        {badge && <Badge variant="primary" size="sm" className="ih-ml-6">{badge}</Badge>}
      </span>
      {note && <span className="ih-opt-note">{note}</span>}
      {children}
    </span>
  );

  /* Radio.Item renders its own label wrapper and takes the card's contents as
     `label`, so the Surface is not wrapped around it — the product's classes
     go on the wrapper Kumo renders. One label, not a label inside a label. */
  if (as === 'radio') {
    return (
      <Radio.Item
        value={value}
        className={`ih-opt${checked ? ' ih-opt-on' : ''}`}
        label={body}
      />
    );
  }

  return (
    <Surface
      render={<label />}
      className={`ih-opt${checked ? ' ih-opt-on' : ''}`}
    >
      {/* Named for the card's title rather than by the <label> around it:
          that label holds the note and the badge too, and a control announced
          as its own three-line description is worse than one announced as
          what it is. */}
      <Checkbox
        aria-label={typeof title === 'string' ? title : undefined}
        checked={checked}
        onCheckedChange={(next) => onChange(next)}
      />
      {body}
    </Surface>
  );
}

/**
 * A choice that is a row rather than a card: a word, and one line saying what
 * it means.
 *
 * The Schedule step wrote these by hand around the same bare `<Radio>` that
 * rendered nothing, so Start, End and Re-entry could all be read and none of
 * them chosen. Kumo's `description` only shows on a card, so the note rides in
 * the label with the word — which is where this step has always put it, to the
 * right rather than underneath.
 */
export function RadioRows({ legend, value, onValueChange, rows }) {
  return (
    <Radio.Group
      value={value}
      onValueChange={onValueChange}
      className="ih-radio-rows"
    >
      <Radio.Legend className="ih-sr-only">{legend}</Radio.Legend>
      {rows.map((row) => (
        <Radio.Item
          key={row.value}
          value={row.value}
          className="ih-radio-row"
          label={
            <>
              <span className="ih-radio-label">{row.label}</span>
              {row.note && <Text size="sm" variant="secondary">{row.note}</Text>}
            </>
          }
        />
      ))}
    </Radio.Group>
  );
}

/**
 * The estimated-reach figures (§6.9's stat, not Kumo's Meter).
 *
 * `hint` hangs a hover card off the label, which is where the stat strip on
 * the insights page already puts an explanation of a figure (§9.2's
 * `ih-hint-mark`). A real button rather than a bare icon, so the card is
 * reachable by keyboard and by tap and not only by a pointer that happens to
 * rest in the right place.
 */
export function Stat({ icon: glyph, label, value, keyed, hint, hintLabel }) {
  return (
    <div className={`ih-stat${keyed ? ' ih-stat-key' : ''}`}>
      <span className="ih-stat-label">
        {glyph}{label}
        {hint && (
          <HoverCard
            label={hintLabel || `About ${label}`}
            pressOpens
            side="top"
            align="start"
            trigger={
              <button type="button" className="ih-hint-mark" aria-label={hintLabel || `About ${label}`}>
                <Icon name="info" size={12} />
              </button>
            }
          >
            {hint}
          </HoverCard>
        )}
      </span>
      <span className="ih-stat-value">{value}</span>
    </div>
  );
}

/* The controls a jump can land on. A panel whose first control is a Kumo
   Surface-as-label (the option cards) has no focusable input of its own
   until the checkbox inside it, which is why this looks for the control
   rather than the first child. */
const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), textarea, select, '
  + 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Put the reader in front of the panel that owns a failing field.
 *
 * Scroll first and focus second: focusing alone scrolls the panel to wherever
 * the browser decides, which on a long step lands it flush against the top
 * bar. The panel itself is the fallback target, so a panel of read-only
 * content — the exclusion summary, say — still announces rather than swallowing
 * the jump silently.
 */
export function focusPanel(field) {
  if (!field) return false;
  const panel = document.querySelector(`[data-field="${CSS.escape(field)}"]`);
  if (!panel) return false;
  panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const control = panel.querySelector(FOCUSABLE);
  (control || panel).focus({ preventScroll: true });
  // A ring on the panel says which one answered, for the case where the
  // control that took focus is a checkbox three rows into it.
  panel.dataset.jumped = 'true';
  setTimeout(() => { delete panel.dataset.jumped; }, 1200);
  return true;
}
