/* ==========================================================================
   StatStrip.jsx — the detail-page band (§6.8).

   One of the components §11.4 marks "(none)": Kumo has no stat strip, and the
   nearest thing — a row of `LayerCard`s — is a different object, with its own
   frames and its own padding. So this stays the product's own CSS, and the
   only Kumo in it is the Button on each action and the Tooltip on a hint.
   ========================================================================== */
import { Button, Tooltip } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';

export function StatStrip({ spec, entering }) {
  if (!spec) return null;
  return (
    <div className="ih-statstrip" data-enter={entering ? 'true' : undefined}>
      <div className="ih-statstrip-cols">
        {spec.items.map((col, i) => (
          <div className="ih-statstrip-col" key={`${col.label}-${i}`}>
            <span className="ih-statstrip-label">
              {col.label}
              {col.hint && (
                <Tooltip content={col.hint}>
                  <span className="ih-hint-mark"><Icon name="info" size={12} /></span>
                </Tooltip>
              )}
            </span>
            <span className={`ih-statstrip-value${col.mono ? ' ih-mono' : ''}`}>
              {col.glyph}
              <span className="truncate">{col.value}</span>
            </span>
          </div>
        ))}
      </div>
      {spec.actions?.length > 0 && (
        <div className="ih-statstrip-acts">
          {spec.actions.map((act) => (
            <Button
              key={act.key}
              size="sm"
              variant={act.kind || 'outline'}
              onClick={() => spec.onAction?.(act.key)}
            >
              {act.glyph}{act.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
