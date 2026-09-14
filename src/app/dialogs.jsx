/* ==========================================================================
   dialogs.jsx — the console's dialogs, on Kumo's Dialog.

   The vanilla build's `dialog()` was a promise-returning function that built
   markup, mounted it on document.body, trapped focus and resolved on a
   button's `value`. All of that is Kumo's Dialog now; what is left is the two
   shapes this product actually asks for.
   ========================================================================== */
import { Dialog, Button, Badge, Text } from '@cloudflare/kumo';

/**
 * A destructive confirm. `kind` decides the weight of the confirm button, so
 * the same component covers "discard this draft" and "reset everything".
 */
export function ConfirmDialog({
  open, title, children, confirmLabel = 'Discard and continue',
  cancelLabel = 'Cancel', destructive = true, onConfirm, onClose,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title className="ih-dialog-title">{title}</Dialog.Title>
        <Dialog.Description render={<div />} className="ih-dialog-body">
          {children}
        </Dialog.Description>
        <div className="ih-dialog-foot">
          <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={() => { onConfirm(); }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

/**
 * An alert row opens what it watches, and toggles it from there — the row is
 * a door, not a switch, so the state change happens where the explanation is.
 */
export function AlertDialog({ alert, saved, onClose, onToggle }) {
  const isOn = alert ? Boolean(saved[alert.key]) : false;
  return (
    <Dialog.Root open={Boolean(alert)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog size="base" className="p-6">
        <Dialog.Title className="ih-dialog-title">{alert?.label}</Dialog.Title>
        <Dialog.Description render={<div />} className="ih-dialog-body">
          <Text>{alert?.desc}</Text>
          <div className="ih-well">
            <div className="ih-row-between">
              <Text size="sm" variant="secondary">Currently</Text>
              <Badge variant={isOn ? 'success' : 'neutral'} size="sm">{isOn ? 'On' : 'Off'}</Badge>
            </div>
            {alert?.key === 'alertRating' && (
              <div className="ih-row-between">
                <Text size="sm" variant="secondary">Rating floor</Text>
                <Text size="sm" variant="mono">{saved.ratingFloor} / 5 normalised</Text>
              </div>
            )}
            <div className="ih-row-between">
              <Text size="sm" variant="secondary">Would have fired</Text>
              <Text size="sm" variant="mono">
                {alert?.key === 'alertRating' ? '2 times'
                  : alert?.key === 'alertComplete' ? '1 time' : '0 times'} in the last 30 days
              </Text>
            </div>
          </div>
          <Text size="sm" variant="secondary">
            Delivered to the workspace owner’s email until a channel is connected.
          </Text>
        </Dialog.Description>
        <div className="ih-dialog-foot">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button
            variant={isOn ? 'destructive' : 'primary'}
            onClick={() => onToggle(alert.key, !isOn)}
          >
            {isOn ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
