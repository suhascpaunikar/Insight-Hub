/* ==========================================================================
   AddContentDialog.jsx — FR-35 / FR-29.

   The modal lists only the elements the chosen component can actually render.
   Anything it cannot carry is not listed, rather than listed and disabled:
   a greyed row invites the reader to work out why, and the answer is always
   "not on this template", which the template picker already said.
   ========================================================================== */
import { Dialog, Button, Text, Surface } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { ELEMENTS } from '../../lib/data.js';
import { uid } from '../../lib/format.js';

export function AddContentDialog({ open, variant, template, onClose, onAdd }) {
  const available = template
    ? ELEMENTS.filter((el) => template.supports.includes(el.type))
    : [];

  const add = (el) => onAdd({
    id: uid('el'),
    type: el.type,
    label: el.name,
    ...(el.type === 'mcq'
      ? { choices: [{ id: uid('ch'), text: 'Option A' }, { id: uid('ch'), text: 'Option B' }] }
      : {}),
  });

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog size="base" className="p-6">
        <Dialog.Title className="ih-dialog-title">Add content</Dialog.Title>
        <Dialog.Description render={<div />} className="ih-dialog-body">
          <Text variant="secondary">
            Elements <span className="ih-mono">{template?.name}</span> can render on{' '}
            <span className="ih-mono">{variant?.channel}</span>. Anything it cannot carry is not
            listed.
          </Text>
          <ul className="ih-stack-sm">
            {available.map((el) => (
              <li key={el.type}>
                <Surface
                  render={<button type="button" />}
                  className="ih-opt ih-opt-full"
                  onClick={() => add(el)}
                >
                  <span className="ih-opt-icon"><Icon name={el.icon} size={16} /></span>
                  <span className="ih-opt-body">
                    <span className="ih-opt-title">{el.name}</span>
                    <span className="ih-opt-note">{el.description}</span>
                  </span>
                </Surface>
              </li>
            ))}
          </ul>
        </Dialog.Description>
        <div className="ih-dialog-foot">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
