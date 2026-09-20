/* ==========================================================================
   TopBar.jsx — the 58px bar: breadcrumb left, three utilities right (§5.3).

   The breadcrumb is Kumo's `Breadcrumbs`, which is where the chevron
   separator, the `aria-current` on the last crumb and the truncation come
   from. The environment indicator (FR-62) is a `DropdownMenu.RadioGroup`, so
   the "which one is current" affordance is the component's rather than a
   check glyph placed by hand.
   ========================================================================== */
import { Breadcrumbs, DropdownMenu, Button, Badge } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { useStore } from '../lib/useStore.js';
import { toast } from '../lib/toast.js';
import { ENVIRONMENTS } from './NavRail.jsx';

export function TopBar({ crumbs, docked, tabGroup, onOpenAssistant }) {
  const store = useStore();
  const env = store.state.environment || 'Production';
  const list = crumbs && crumbs.length ? crumbs : [{ label: 'InsightHub', icon: 'grid' }];

  return (
    <header className="ih-topbar" data-docked={String(Boolean(docked))}>
      {/* While the page is scrolled past the tab strip, the strip's group
          takes the breadcrumb's place here rather than pinning a second band. */}
      {docked ? (
        <div className="ih-topbar-dock">{tabGroup}</div>
      ) : (
        <Breadcrumbs size="sm">
          {list.map((crumb, i) => {
            const last = i === list.length - 1;
            const glyph = crumb.icon ? <Icon name={crumb.icon} size={14} /> : undefined;
            return (
              <Fragmentish key={`${crumb.label}-${i}`}>
                {i > 0 && <Breadcrumbs.Separator />}
                {last || !crumb.href ? (
                  <Breadcrumbs.Current icon={glyph}>{crumb.label}</Breadcrumbs.Current>
                ) : (
                  <Breadcrumbs.Link href={crumb.href} icon={glyph}>{crumb.label}</Breadcrumbs.Link>
                )}
              </Fragmentish>
            );
          })}
        </Breadcrumbs>
      )}

      <div className="ih-topbar-right">
        {/* FR-62 — the environment indicator is always visible. */}
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline" size="sm" aria-label={`Environment: ${env}`}>
                <span className="ih-env-dot" data-env={env} aria-hidden="true" />
                {env}
                <Icon name="down" size={12} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.RadioGroup
              value={env}
              onValueChange={(value) => store.set({ environment: value })}
            >
              <DropdownMenu.Label>Environment</DropdownMenu.Label>
              {ENVIRONMENTS.map((name) => (
                <DropdownMenu.RadioItem key={name} value={name}>{name}</DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={onOpenAssistant}>
          <Icon name="sparkles" size={14} />Assistant
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast('Help is not part of the prototype',
            'The control is here for the shape of the page.', 'info')}
        >
          <Icon name="help" size={14} />Help
        </Button>
        <Button variant="ghost" size="sm" className="ih-avatar" aria-label="Account: Prashant Kulkarni">
          PK
        </Button>
      </div>
    </header>
  );
}

/* Breadcrumbs wants its children flat — a crumb and its separator are
   siblings, not a wrapped pair — so this passes them straight through. */
const Fragmentish = ({ children }) => <>{children}</>;
