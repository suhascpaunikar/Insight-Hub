/* ==========================================================================
   DateField.jsx — a date field, composed from Popover + DatePicker.

   §11.4 gained "DatePicker" as the answer for the wizard's raw
   `<input type="date">`, and that is half right. Kumo's DatePicker is an
   always-visible calendar — react-day-picker under a Kumo skin, taking
   `mode` / `selected` / `onChange` — not a field that opens one. Dropping
   two of them into the Schedule step would put two month grids where two
   170px inputs belong.

   So it is composed, the way §11.4 says to compose the radio card: Kumo's
   Popover for the anchoring and dismissal, Kumo's Button for the field,
   Kumo's DatePicker inside. Nothing here re-implements a calendar.

   The value stays the `YYYY-MM-DD` string the draft has always stored, so
   validation, persistence and the publish summary are untouched.
   ========================================================================== */
import { Popover, Button, DatePicker } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';

const toDate = (value) => {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return Number.isFinite(y) ? new Date(y, m - 1, d) : undefined;
};

const toValue = (date) => {
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function DateField({ value, onChange, disabled, label }) {
  const selected = toDate(value);
  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            variant="secondary"
            className="ih-date-field"
            disabled={disabled}
            aria-label={label}
          >
            <Icon name="clock" size={14} />
            {selected
              ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : <span className="ih-date-empty">Pick a date</span>}
          </Button>
        }
      />
      <Popover.Content>
        <DatePicker
          mode="single"
          selected={selected}
          onChange={(date) => { if (date) onChange(toValue(date)); }}
        />
      </Popover.Content>
    </Popover>
  );
}
