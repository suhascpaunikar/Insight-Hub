/* ==========================================================================
   TopBar.tsx — the page's own header strip.

   The reference puts the account and app switchers inside the sidebar, which
   leaves this bar doing what it does there: naming the screen you are on and
   holding the environment indicator (FR-62), which must be visible from every
   screen. It is 58px to line up with `Sidebar.Header`'s own height, so the
   hairline under it runs unbroken across both.
   ========================================================================== */
import { Badge, Button, DropdownMenu, Sidebar } from '@cloudflare/kumo';
import { CaretDownIcon, GridFourIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { store } from '../legacy';

const APPS = ['InsightHub', 'Engage', 'CPaaS', 'CDP'];

export function TopBar({ view }: { view: string }) {
  const [app, setApp] = useState<string>((store.state.app as string) || APPS[0]);
  const [env, setEnv] = useState<string>((store.state.environment as string) || 'Production');

  return (
    <header className="flex h-[58px] shrink-0 items-center gap-2 border-b border-kumo-line px-4">
      {/* Below Kumo's 768px breakpoint the sidebar renders as a sheet and its
          footer trigger goes off-canvas with it, so the way back into the nav
          has to be here. */}
      <Sidebar.Trigger className="md:hidden" />
      <span className="truncate text-sm font-medium text-kumo-strong">{view}</span>

      <span aria-hidden className="mx-1 h-4 w-px bg-kumo-line" />

      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button variant="ghost" size="sm" icon={<GridFourIcon />}>
              {app}
              <CaretDownIcon className="size-3" />
            </Button>
          }
        />
        <DropdownMenu.Content align="start">
          {APPS.map((name) => (
            <DropdownMenu.Item key={name} onClick={() => { setApp(name); store.set({ app: name }); }}>
              {name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        {/* FR-62 — the environment indicator is always visible. */}
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="ghost" className="gap-1.5">
                <Badge variant={env === 'Production' ? 'success' : 'warning'}>{env}</Badge>
                <CaretDownIcon className="size-3" />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            {['Production', 'Staging'].map((name) => (
              <DropdownMenu.Item key={name} onClick={() => { setEnv(name); store.set({ environment: name }); }}>
                {name}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>

        <span
          className="grid size-7 place-items-center rounded-full bg-kumo-tint text-[11px]
                     font-medium text-kumo-subtle"
          title="Prashant Kulkarni"
        >
          PK
        </span>
      </div>
    </header>
  );
}
