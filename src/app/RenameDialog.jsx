/* ==========================================================================
   RenameDialog.jsx — FR-74, rename in place.

   Its own component rather than a case in ConfirmDialog because it holds a
   value: the field has to open with the current name selected, and Save has
   to be inert on an empty one.
   ========================================================================== */
import { useEffect, useState } from 'react';
import { Dialog, Button, Field, Input } from '@cloudflare/kumo';

export function RenameDialog({ open, name, onClose, onRename }) {
  const [value, setValue] = useState(name);
  useEffect(() => { if (open) setValue(name); }, [open, name]);

  const trimmed = value.trim();
  const submit = () => { if (trimmed) onRename(trimmed); };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title className="ih-dialog-title">Rename campaign</Dialog.Title>
        <Dialog.Description render={<div />} className="ih-dialog-body">
          <Field label="Campaign name">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </Field>
        </Dialog.Description>
        <div className="ih-dialog-foot">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!trimmed} onClick={submit}>Save</Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
