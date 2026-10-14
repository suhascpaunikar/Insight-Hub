/* ==========================================================================
   NavRail.jsx — the primary navigation, on Kumo's Sidebar (FR-58 … FR-61).

   This is the component the mirror cost the most to fake. `Sidebar` ships the
   56px-icon ⇄ 260px-label collapse the guideline §5.1/5.2 measured, the
   tooltip a collapsed item needs, and the badge slot — so `wireRailTips()`,
   `applyRailState()` and the whole `.rail-*` block are gone. `collapsible`
   is "icon", which is exactly the vanilla build's collapsed strip: the items
   stay, their labels do not.

   The workspace and app switchers live behind the logo cell, as Cloudflare's
   account switcher does, and are now a real `DropdownMenu.RadioGroup` rather
   than buttons with `role="menuitemradio"` written by hand.
   ========================================================================== */
import { Sidebar, DropdownMenu, Button } from '@cloudflare/kumo';
import { CaretUpDown, MagnifyingGlass } from '@phosphor-icons/react';
import { Icon } from '../lib/icons.jsx';
import { useStore } from '../lib/useStore.js';

const NAV_GROUPS = [
  [
    { href: 'index.html', label: 'Campaigns', icon: 'megaphone', key: 'campaigns' },
    { href: 'insights.html', label: 'Insights', icon: 'chart', key: 'insights' },
  ],
  [
    { href: '#', label: 'Segments', icon: 'users', key: 'segments' },
    { href: '#', label: 'Templates', icon: 'layout', key: 'templates' },
    { href: '#', label: 'User data table', icon: 'database', key: 'user-data' },
  ],
  [
    // FR-60 — a limited-release badge in the AI accent, never mistakable for a metric.
    { href: '#', label: 'AI themes', icon: 'sparkles', key: 'ai-themes', badge: 'Beta' },
    // The one nav entry that does something: it opens the companion card.
    { href: '#', label: 'Assistant', icon: 'bot', key: 'assistant', badge: 'Beta', act: 'assistant' },
    { href: 'settings.html', label: 'Settings', icon: 'settings', key: 'settings' },
  ],
];

export const NAV_ITEMS = NAV_GROUPS.flat();
export const WORKSPACES = ['QuickEats India', 'QuickEats UAE', 'QuickEats Sandbox'];
export const APPS = ['InsightHub', 'Engage', 'CPaaS', 'CDP'];
export const ENVIRONMENTS = ['Production', 'Staging'];

export function NavRail({ active, onOpenAssistant, onOpenSearch }) {
  const store = useStore();
  const workspace = store.state.workspace || WORKSPACES[0];
  const app = store.state.app || APPS[0];

  return (
    <Sidebar collapsible="icon">
      {/* The logo cell is the top of the rail and the switcher's trigger: the
          collapsed strip has no other room for one. */}
      <Sidebar.Header>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                aria-label={`Workspace ${workspace}, app ${app}. Switch workspace or app`}
              >
                <span className="ih-rail-mark" aria-hidden="true">IH</span>
                <span className="truncate group-data-[collapsible=icon]:hidden">{workspace}</span>
                <CaretUpDown size={14} className="ml-auto group-data-[collapsible=icon]:hidden" />
              </Button>
            }
          />
          <DropdownMenu.Content align="start">
            <DropdownMenu.RadioGroup
              value={workspace}
              onValueChange={(value) => store.set({ workspace: value })}
            >
              <DropdownMenu.Label>Workspace</DropdownMenu.Label>
              {WORKSPACES.map((name) => (
                <DropdownMenu.RadioItem key={name} value={name}>{name}</DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator />
            <DropdownMenu.RadioGroup
              value={app}
              onValueChange={(value) => store.set({ app: value })}
            >
              <DropdownMenu.Label>App</DropdownMenu.Label>
              {APPS.map((name) => (
                <DropdownMenu.RadioItem key={name} value={name}>{name}</DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu>
      </Sidebar.Header>

      <Sidebar.Content>
        {/* Quick search sits above the groups, as its own item, so the
            collapsed strip and the expanded sidebar share one control. */}
        <Sidebar.Group>
          <Sidebar.Menu>
            <Sidebar.MenuButton
              icon={MagnifyingGlass}
              tooltip="Quick search"
              onClick={onOpenSearch}
            >
              Quick search
              <kbd className="ih-kbd ml-auto" aria-hidden="true">⌘K</kbd>
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        {NAV_GROUPS.map((group, i) => (
          <Sidebar.Group key={i}>
            <Sidebar.Menu>
              {group.map((item) => (
                <Sidebar.MenuItem key={item.key}>
                  <Sidebar.MenuButton
                    icon={(props) => <Icon name={item.icon} {...props} />}
                    active={item.key === active}
                    href={item.act ? undefined : item.href}
                    tooltip={item.label}
                    onClick={item.act === 'assistant' ? onOpenAssistant : undefined}
                  >
                    {item.label}
                  </Sidebar.MenuButton>
                  {/* MenuBadge is already Kumo's dashed beta chip — §11.2's
                      "Kumo's `beta` badge variant is border-dashed" — so it
                      takes the word, not a nested Badge. It hides itself when
                      the rail collapses; the placement is ours, because Kumo
                      styles it `inline-flex` and leaves it to the consumer to
                      lift out of the button's flow. */}
                  {item.badge && <Sidebar.MenuBadge>{item.badge}</Sidebar.MenuBadge>}
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>

      {/* FR-61 — the collapse control. Kumo's Trigger owns the state and
          persists nothing, so the Provider above is what remembers. */}
      <Sidebar.Footer>
        <Sidebar.Trigger />
      </Sidebar.Footer>
    </Sidebar>
  );
}
