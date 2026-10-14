/* ==========================================================================
   settings-kit.jsx — the console's settings row patterns (§6.7, §6.11).

   Every settings row is the same object: an explanation on the left, one
   control on the right. The variants differ only in what the right side is.
   The row layout stays the product's CSS — Kumo has no settings-row component
   — but everything *inside* a row is Kumo's now, and the panel it sits in is
   a `LayerCard`.
   ========================================================================== */
import { LayerCard, Button, Badge, Text, InputGroup, Tooltip } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { toast } from '../lib/toast.js';

/* §6.7 — the violet pill beside a section title, linking to that section's
   documentation. There is no docs site behind the prototype, so it says
   plainly that the control is there for the shape of the page rather than
   dead-ending on a 404. */
export function DocsChip({ section }) {
  /* `render` rather than a wrapped child: Kumo's Tooltip supplies its own
     button for the trigger, so wrapping one put a <button> inside a <button>
     — invalid HTML, which React logged on every render of this page. Passing
     the chip as the trigger makes the two one element. */
  return (
    <Tooltip
      content={`${section} documentation`}
      render={
        <button
          type="button"
          className="ih-docs-chip"
          aria-label={`${section} documentation`}
          onClick={() => toast(`${section} documentation is not part of the prototype`,
            'The control is here for the shape of the page.', 'info')}
        />
      }
    >
      <Icon name="book" size={12} />
    </Tooltip>
  );
}

export function SectionHead({ title, children, docs }) {
  return (
    <div className="ih-section-head">
      <h2>{title}{docs && <DocsChip section={docs} />}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export const SettingsPanel = ({ children }) => (
  <LayerCard className="ih-spanel p-0">{children}</LayerCard>
);

export function SettingsRow({ label, desc, badge, control, top, auto }) {
  return (
    <div className={`ih-srow${top ? ' ih-srow-top' : ''}`}>
      <div className="ih-srow-main">
        <div className="ih-srow-label">{label}{badge}</div>
        {desc && <p className="ih-srow-desc">{desc}</p>}
      </div>
      <div className={`ih-srow-ctl${auto ? ' ih-srow-ctl-auto' : ''}`}>{control}</div>
    </div>
  );
}

/** A row that opens something. The whole row is the target (FR-63). */
export function SettingsRowLink({ label, desc, badge, status, onClick }) {
  return (
    <button type="button" className="ih-srow ih-srow-link" onClick={onClick}>
      <span className="ih-srow-main">
        <span className="ih-srow-label">{label}{badge}</span>
        {desc && <span className="ih-srow-desc ih-block">{desc}</span>}
      </span>
      <span className="ih-srow-ctl ih-srow-ctl-auto">
        {status}
        <span className="ih-srow-chev"><Icon name="chevron" size={14} /></span>
      </span>
    </button>
  );
}

/**
 * A number with the unit it counts, and underneath it what that number works
 * out to. `note` is derived from the live edit, so the reader sees the
 * consequence of a value before saving it rather than after.
 *
 * This is the row §11.4 had no entry for: Kumo ships `InputGroup` with a
 * `Suffix`, and the vanilla build's `.unit` / `.unit-suffix` pair was a
 * hand-built version of exactly it.
 */
export function UnitInput({ label, value, unit, note, onChange }) {
  return (
    <>
      <InputGroup size="sm">
        <InputGroup.Input
          type="number"
          min="0"
          inputMode="numeric"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        <InputGroup.Suffix>{unit}</InputGroup.Suffix>
      </InputGroup>
      {note && (
        <Text size="xs" variant={note.warn ? 'error' : 'secondary'} className="ih-unit-note">
          {note.text}
        </Text>
      )}
    </>
  );
}

/**
 * The panel's own Save. Inert until this panel's fields differ from the store.
 *
 * Neutral until there is something to save: a dimmed primary button reads as
 * "nearly enabled" rather than "nothing to do".
 */
export function PanelFoot({ dirty, hint, onSave, onCancel }) {
  return (
    <div className="ih-spanel-foot" data-dirty={String(dirty)}>
      <Text size="xs" variant="secondary">{dirty ? 'Unsaved changes' : hint}</Text>
      <span className="ih-row-gap">
        {dirty && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button
          size="sm"
          variant={dirty ? 'primary' : 'secondary'}
          disabled={!dirty}
          onClick={onSave}
        >
          Save changes
        </Button>
      </span>
    </div>
  );
}

export const StatusPill = ({ on }) => (
  <Badge variant={on ? 'success' : 'neutral'} size="sm">{on ? 'On' : 'Off'}</Badge>
);
