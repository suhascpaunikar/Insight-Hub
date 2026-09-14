/* ==========================================================================
   SegmentCreator.jsx — the full rule builder, not a reduced one (FR-14/FR-15).

   A segment created here is a real member of the shared library: it appears
   in the picker with the rule it matches on, exactly like a seeded one, and
   it is selected for this campaign on creation.
   ========================================================================== */
import { useState } from 'react';
import { Dialog, Button, Input, Select, Field, Text, Radio } from '@cloudflare/kumo';
import { Icon } from '../../lib/icons.jsx';
import { RULE_FIELDS, RULE_OPERATORS } from '../../lib/data.js';
import { uid } from '../../lib/format.js';

const blankRule = () => ({
  id: uid('r'), field: RULE_FIELDS[0], operator: RULE_OPERATORS[0], value: '',
});

export function SegmentCreator({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [match, setMatch] = useState('all');
  const [rules, setRules] = useState(() => [blankRule()]);

  const reset = () => { setName(''); setMatch('all'); setRules([blankRule()]); };
  const close = () => { reset(); onClose(); };

  const complete = name.trim() && rules.every((r) => String(r.value).trim());

  /* The rule, in the words the picker prints under the segment's name. */
  const ruleText = () => rules
    .map((r) => `${r.field} ${r.operator} ${r.value}`)
    .join(match === 'all' ? ' and ' : ' or ');

  const patchRule = (id, p) => setRules((list) =>
    list.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title className="ih-dialog-title">Create segment</Dialog.Title>
        <Dialog.Description render={<div />} className="ih-dialog-body">
          <Field label="Segment name" required>
            <Input
              autoFocus
              value={name}
              placeholder="e.g. Bandra · lapsed 21d"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="ih-row-gap">
            <Text size="sm" variant="secondary">Match</Text>
            <label className="ih-radio-inline">
              <Radio name="match" checked={match === 'all'} onCheckedChange={() => setMatch('all')} />
              all rules
            </label>
            <label className="ih-radio-inline">
              <Radio name="match" checked={match === 'any'} onCheckedChange={() => setMatch('any')} />
              any rule
            </label>
          </div>

          <ul className="ih-stack-sm">
            {rules.map((rule, i) => (
              <li className="ih-rule-row" key={rule.id}>
                <Text size="xs" variant="secondary" className="ih-rule-join">
                  {i === 0 ? 'Where' : match === 'all' ? 'and' : 'or'}
                </Text>
                <Select
                  size="sm"
                  aria-label="Field"
                  value={rule.field}
                  items={Object.fromEntries(RULE_FIELDS.map((f) => [f, f]))}
                  onValueChange={(field) => patchRule(rule.id, { field })}
                />
                <Select
                  size="sm"
                  aria-label="Operator"
                  value={rule.operator}
                  items={Object.fromEntries(RULE_OPERATORS.map((o) => [o, o]))}
                  onValueChange={(operator) => patchRule(rule.id, { operator })}
                />
                <Input
                  size="sm"
                  aria-label="Value"
                  value={rule.value}
                  placeholder="Value"
                  onChange={(e) => patchRule(rule.id, { value: e.target.value })}
                />
                <Button
                  variant="ghost" size="sm" shape="square"
                  aria-label="Remove rule"
                  disabled={rules.length <= 1}
                  onClick={() => setRules((list) => list.filter((r) => r.id !== rule.id))}
                >
                  <Icon name="trash" size={13} />
                </Button>
              </li>
            ))}
          </ul>

          <Button
            variant="outline" size="sm"
            onClick={() => setRules((list) => [...list, blankRule()])}
          >
            <Icon name="plus" size={14} />Add rule
          </Button>

          <div className="ih-well">
            <Text size="xs" variant="secondary">This segment will match</Text>
            <Text size="sm" variant="mono" className="ih-block">
              {complete ? ruleText() : 'Fill in every rule to see the match.'}
            </Text>
          </div>
        </Dialog.Description>
        <div className="ih-dialog-foot">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!complete}
            onClick={() => {
              onCreate({
                name: name.trim(),
                rule: ruleText(),
                // A prototype estimate: a real segment would be counted by the
                // audience service, and the picker prints whatever it is given.
                size: 4000 + Math.floor(Math.random() * 26000),
              });
              reset();
            }}
          >
            Create segment
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
