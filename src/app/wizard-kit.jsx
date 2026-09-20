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

export function StepPanel({
  id, title, desc, required, actions, note, error, narrow, insightKey, children,
}) {
  return (
    <section
      className={`ih-ssection${narrow ? ' ih-ssection-narrow' : ''}`}
      data-insight={insightKey || undefined}
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
 * A choice that is a card rather than a line: the label, a note under it, and
 * the control that actually carries the state.
 *
 * `as` picks which Kumo control sits inside — `checkbox` for a set, `radio`
 * for a choice. Either way the card is a <label>, so the whole surface is the
 * target and the control keeps its own semantics.
 */
export function OptionCard({
  as = 'checkbox', name, checked, onChange, title, note, badge, children,
}) {
  const Control = as === 'radio' ? Radio : Checkbox;
  return (
    <Surface
      render={<label />}
      className={`ih-opt${checked ? ' ih-opt-on' : ''}`}
    >
      {/* Named for the card's title rather than by the <label> around it:
          that label holds the note and the badge too, and a control announced
          as its own three-line description is worse than one announced as
          what it is. */}
      <Control
        name={name}
        aria-label={typeof title === 'string' ? title : undefined}
        checked={checked}
        onCheckedChange={(next) => onChange(as === 'radio' ? true : next)}
      />
      <span className="ih-opt-body">
        <span className="ih-opt-title">
          {title}
          {badge && <Badge variant="primary" size="sm" className="ih-ml-6">{badge}</Badge>}
        </span>
        {note && <span className="ih-opt-note">{note}</span>}
        {children}
      </span>
    </Surface>
  );
}

/** The estimated-reach figures (§6.9's stat, not Kumo's Meter). */
export function Stat({ icon: glyph, label, value, keyed }) {
  return (
    <div className={`ih-stat${keyed ? ' ih-stat-key' : ''}`}>
      <span className="ih-stat-label">{glyph}{label}</span>
      <span className="ih-stat-value">{value}</span>
    </div>
  );
}
