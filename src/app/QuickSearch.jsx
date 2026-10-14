/* ==========================================================================
   QuickSearch.jsx — ⌘K, on Kumo's CommandPalette.

   §11.4 called the vanilla popover "a sketch of" this, and the sketch said so
   on its face: a text field over the words "Placeholder in this prototype".
   The component that replaces it does the filtering, the keyboard navigation
   and the grouping, and the data it needs — campaigns, segments, templates —
   was already in the store, so the placeholder is now a working search.
   ========================================================================== */
import { useMemo, useState, useEffect } from 'react';
import { CommandPalette } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { useStore } from '../lib/useStore.js';
import { TEMPLATES } from '../lib/data.js';

export function QuickSearch({ open, onOpenChange }) {
  const store = useStore();
  const [query, setQuery] = useState('');

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (text) => !q || String(text).toLowerCase().includes(q);
    const out = [];

    const campaigns = store.state.campaigns
      .filter((c) => match(c.name) || match(c.campaignId))
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        title: c.name,
        note: `${c.campaignId} · ${c.status}`,
        icon: 'megaphone',
        href: `insights.html?c=${encodeURIComponent(c.id)}`,
      }));
    if (campaigns.length) out.push({ id: 'campaigns', label: 'Campaigns', items: campaigns });

    const segments = store.state.segments
      .filter((s) => match(s.name))
      .slice(0, 4)
      .map((s) => ({ id: s.id, title: s.name, note: 'Segment', icon: 'users', href: '#' }));
    if (segments.length) out.push({ id: 'segments', label: 'Segments', items: segments });

    const templates = TEMPLATES
      .filter((t) => match(t.name))
      .slice(0, 4)
      .map((t) => ({ id: t.id, title: t.name, note: t.channel, icon: 'layout', href: '#' }));
    if (templates.length) out.push({ id: 'templates', label: 'Templates', items: templates });

    return out;
  }, [query, store.state.campaigns, store.state.segments]);

  return (
    <CommandPalette.Root
      open={open}
      onOpenChange={onOpenChange}
      items={groups}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(group) => group.label}
      getSelectableItems={(group) => group.items}
    >
      <CommandPalette.Input placeholder="Search campaigns, segments, templates" />
      <CommandPalette.List>
        <CommandPalette.Results>
          {(group) => (
            <CommandPalette.Group key={group.id} items={group.items}>
              <CommandPalette.GroupLabel>{group.label}</CommandPalette.GroupLabel>
              <CommandPalette.Items>
                {(item) => (
                  <CommandPalette.Item
                    key={item.id}
                    value={item}
                    onClick={() => {
                      onOpenChange(false);
                      if (item.href && item.href !== '#') window.location.href = item.href;
                    }}
                  >
                    <span className="ih-cmd-row">
                      <span className="ih-cmd-icon"><Icon name={item.icon} size={14} /></span>
                      <span>{item.title}</span>
                      <span className="ih-cmd-note">{item.note}</span>
                    </span>
                  </CommandPalette.Item>
                )}
              </CommandPalette.Items>
            </CommandPalette.Group>
          )}
        </CommandPalette.Results>
        <CommandPalette.Empty>No matches</CommandPalette.Empty>
      </CommandPalette.List>
    </CommandPalette.Root>
  );
}
