/* ==========================================================================
   HoverCard.jsx — a card that opens on hover and can be clicked into.

   The product already has two hover readouts and neither fits this job.
   `Tooltip` is a sentence that vanishes the moment you reach for it, and
   `ChartTip` is a measured readout with nothing in it to press. What the
   stepper, the reach figure and the campaign rows all want is the third
   thing: a small panel that appears on rest, stays while you travel into it,
   and holds controls.

   Kumo has no hovercard, but its `Popover` is Base UI's, and Base UI's
   trigger already carries `openOnHover` with an open delay and a close delay.
   So the anchoring, the portal, the dismissal and the hover machinery are all
   Kumo's; what this file adds is one decision.

   That decision is the press. Most triggers here already do something when
   clicked — a step travels, a row opens a campaign — and a popover that also
   toggled on press would fight its own trigger. So the card is controlled,
   and by default `trigger-press` closes it instead of toggling: the click does
   its own job and the card gets out of the way.

   `pressOpens` is for the other kind of trigger, the hint mark whose only job
   *is* this card. There a press has nothing to collide with, and it is the
   one route a device without hover has to the card at all.

   `delay` is the 400ms every other hover hint in the wizard waits
   (`TooltipProvider delay={400}` in both shells), so resting on a step reads
   the same as resting on anything else. `closeDelay` is not padding — it is
   the time it takes to cross the 8px gap between trigger and card, without
   which an interactive card cannot be reached at all.

   On a device with no hover there is no dwell to gate, so a card whose
   trigger has its own click job never opens there. Everything inside one is
   therefore a second route to something already reachable, and the fact the
   card states is also carried in its trigger's accessible name.
   ========================================================================== */
import { useState } from 'react';
import { Popover } from '@cloudflare/kumo';

/** The wizard's tooltip gate, so every hover in the product waits the same. */
const OPEN_DELAY = 400;
/** Travel time from the trigger, across `sideOffset`, into the card. */
const CLOSE_DELAY = 140;

/**
 * `children` may be a function, which receives a `close` callback — for a
 * control inside the card that has acted and should take the card with it.
 */
export function HoverCard({
  trigger, children, label, pressOpens = false,
  side = 'bottom', align = 'center', sideOffset = 8, className = '',
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        // The trigger's click belongs to the trigger, unless this card *is*
        // the trigger's job. Dismiss rather than toggle: once you have acted
        // on what the card said, it is spent.
        if (details?.reason === 'trigger-press' && !pressOpens) { setOpen(false); return; }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        render={trigger}
        openOnHover
        delay={OPEN_DELAY}
        closeDelay={CLOSE_DELAY}
      />
      <Popover.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={`ih-hovercard ${className}`.trim()}
        aria-label={label}
      >
        {typeof children === 'function' ? children(close) : children}
      </Popover.Content>
    </Popover>
  );
}
