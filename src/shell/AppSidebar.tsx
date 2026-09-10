/* ==========================================================================
   AppSidebar.tsx — the navigation rail.

   This is Kumo's `Sidebar` as it ships, composed the way the Cloudflare
   dashboard composes it, with InsightHub's own destinations in it. Nothing
   about the collapse is reimplemented here and nothing about it is tuned:
   the 260px ↔ 57px travel, the 250ms on cubic-bezier(0.77, 0, 0.175, 1), the
   labels truncating as the width closes, the group labels cross-fading into
   separator hairlines, the sub-tree folding away and the panel icon flipping
   are all `Sidebar`'s own behaviour. The only thing this file decides is what
   goes in it.

   The structure mirrors the reference recording rather than our old flat
   rail, because the motion in it needs something to act on: one group open
   with the current screen as an active child, labelled groups either side of
   it, and badges that leave before the labels do.
   ========================================================================== */
import { Badge, Button, DropdownMenu, Sidebar } from '@cloudflare/kumo';
import {
  BellIcon,
  CaretUpDownIcon,
  ChartPieIcon,
  ClockCounterClockwiseIcon,
  DatabaseIcon,
  GearIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PaperPlaneTiltIcon,
  RobotIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { type Campaign, type CampaignStatus, count, store } from '../legacy';

const WORKSPACES = ['QuickEats India', 'QuickEats UAE', 'QuickEats Sandbox'];

/** The campaign views the list can be sliced to, as sub-items under Campaigns. */
export const STATUS_VIEWS = [
  { key: 'all', label: 'All campaigns', match: () => true },
  { key: 'Live', label: 'Live', match: (c: Campaign) => c.status === 'Live' },
  { key: 'Draft', label: 'Drafts', match: (c: Campaign) => c.status === 'Draft' },
  { key: 'Scheduled', label: 'Scheduled', match: (c: Campaign) => c.status === 'Scheduled' },
  { key: 'Completed', label: 'Completed', match: (c: Campaign) => c.status === 'Completed' },
  {
    key: 'held',
    label: 'Paused & stopped',
    match: (c: Campaign) => c.status === 'Paused' || c.status === 'Stopped',
  },
] as const;

export type StatusView = (typeof STATUS_VIEWS)[number]['key'];

interface Props {
  campaigns: Campaign[];
  statusView: StatusView;
  onStatusView: (key: StatusView) => void;
  onSearch: () => void;
  workspace: string;
  onWorkspace: (name: string) => void;
}

export function AppSidebar({
  campaigns, statusView, onStatusView, onSearch, workspace, onWorkspace,
}: Props) {
  const tally = (status: CampaignStatus) => campaigns.filter((c) => c.status === status).length;
  // The three campaigns a reader is most likely to be coming back to. Real
  // rows, not a placeholder list — opening one goes where the list's own
  // Open button goes.
  const recents = [...campaigns]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 3);

  return (
    <Sidebar>
      {/* The account switcher, in the position the reference puts it: inside
          the sidebar rather than up in a topbar, so it narrows with everything
          else and leaves the brand mark alone in the collapsed strip. */}
      <Sidebar.Header>
        {/* The reference sits its logo bare on the sidebar background rather
            than in a filled chip, and takes the brand's own colour — which in
            Kumo is `text-kumo-brand`, not `bg-kumo-brand`: that one is the
            primary-action blue the New Campaign button uses. */}
        <span aria-hidden className="shrink-0 px-1 text-sm font-bold tracking-tight text-kumo-brand">
          IH
        </span>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 flex-1 justify-between gap-1 px-2 group-data-[state=collapsed]/sidebar:opacity-0"
              >
                <span className="truncate">{workspace}</span>
                <CaretUpDownIcon className="size-3.5 shrink-0 text-kumo-subtle" />
              </Button>
            }
          />
          <DropdownMenu.Content align="start">
            {WORKSPACES.map((name) => (
              <DropdownMenu.Item key={name} onClick={() => onWorkspace(name)}>
                {name}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
      </Sidebar.Header>

      <Sidebar.Content>
        {/* Quick search. One node in both states rather than two swapped at
            the end of the animation: the border and the padding close on the
            sidebar's own duration and curve, so it narrows into the magnifier
            instead of cutting to it. */}
        <Sidebar.Group>
          <button
            type="button"
            onClick={onSearch}
            aria-label="Quick search"
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-kumo-line
                       bg-kumo-base px-2.5 text-sm text-kumo-placeholder
                       transition-[border-color,padding,background-color] duration-(--sidebar-animation-duration)
                       ease-(--sidebar-easing) hover:bg-kumo-tint hover:text-kumo-subtle
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-kumo-brand
                       group-data-[state=collapsed]/sidebar:justify-center
                       group-data-[state=collapsed]/sidebar:border-transparent
                       group-data-[state=collapsed]/sidebar:bg-transparent
                       group-data-[state=collapsed]/sidebar:px-0
                       motion-reduce:transition-none"
          >
            <MagnifyingGlassIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Quick search…</span>
            <kbd
              className="max-w-8 shrink-0 overflow-hidden font-sans text-xs text-kumo-inactive
                         transition-[max-width,opacity] duration-(--sidebar-animation-duration)
                         ease-(--sidebar-easing) group-data-[state=collapsed]/sidebar:max-w-0
                         group-data-[state=collapsed]/sidebar:opacity-0 motion-reduce:transition-none"
            >
              ⌘K
            </kbd>
          </button>
        </Sidebar.Group>

        <Sidebar.Group>
          <Sidebar.Menu>
            {/* The open group, with the screen you are on as its active child
                — the one arrangement that shows the sub-tree folding away. */}
            <Sidebar.MenuItem>
              <Sidebar.Collapsible defaultOpen>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={MegaphoneIcon} tooltip="Campaigns">
                      Campaigns
                      <Sidebar.MenuChevron />
                    </Sidebar.MenuButton>
                  }
                />
                <Sidebar.CollapsibleContent>
                  <Sidebar.MenuSub>
                    {STATUS_VIEWS.map((v) => {
                      const n = v.key === 'all'
                        ? campaigns.length
                        : v.key === 'held'
                          ? tally('Paused') + tally('Stopped')
                          : tally(v.key as CampaignStatus);
                      return (
                        <Sidebar.MenuSubButton
                          key={v.key}
                          active={statusView === v.key}
                          onClick={() => onStatusView(v.key)}
                        >
                          <span className="flex-1 truncate">{v.label}</span>
                          <span className="shrink-0 tabular-nums text-kumo-inactive">{count(n)}</span>
                        </Sidebar.MenuSubButton>
                      );
                    })}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>

            <Sidebar.MenuItem>
              <Sidebar.Collapsible>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={ClockCounterClockwiseIcon} tooltip="Recents">
                      Recents
                      <Sidebar.MenuChevron />
                    </Sidebar.MenuButton>
                  }
                />
                <Sidebar.CollapsibleContent>
                  <Sidebar.MenuSub>
                    {recents.map((c) => (
                      <Sidebar.MenuSubButton
                        key={c.id}
                        href={c.status === 'Draft' || c.status === 'Scheduled'
                          ? 'builder.html'
                          : 'insights.html'}
                        onClick={() => {
                          if (c.status === 'Draft' || c.status === 'Scheduled') store.resumeCampaign(c.id);
                          else store.set({ insightsCampaignId: c.id });
                        }}
                      >
                        <span className="truncate">{c.name}</span>
                      </Sidebar.MenuSubButton>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>

        <Sidebar.Group>
          <Sidebar.GroupLabel>Measure</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.Collapsible>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={ChartPieIcon} tooltip="Insights">
                      Insights
                      <Sidebar.MenuChevron />
                    </Sidebar.MenuButton>
                  }
                />
                <Sidebar.CollapsibleContent>
                  <Sidebar.MenuSub>
                    {['Delivery', 'Responses', 'Impact'].map((tab) => (
                      <Sidebar.MenuSubButton key={tab} href="insights.html">
                        {tab}
                      </Sidebar.MenuSubButton>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>
            <Sidebar.MenuButton icon={SparkleIcon} tooltip="AI themes · BETA">
              <span className="flex-1 truncate">AI themes</span>
              <Badge variant="beta">BETA</Badge>
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        <Sidebar.Group>
          <Sidebar.GroupLabel>Audience</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.Collapsible>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={UsersThreeIcon} tooltip="Segments">
                      Segments
                      <Sidebar.MenuChevron />
                    </Sidebar.MenuButton>
                  }
                />
                <Sidebar.CollapsibleContent>
                  <Sidebar.MenuSub>
                    {['Repeat orderers', 'Lapsed 21 days', 'New this month', 'Bandra · all'].map((s) => (
                      <Sidebar.MenuSubButton key={s}>{s}</Sidebar.MenuSubButton>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>
            <Sidebar.MenuButton icon={DatabaseIcon} tooltip="User data table">
              User data table
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={SquaresFourIcon} tooltip="Templates">
              Templates
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>

        <Sidebar.Group>
          <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuButton icon={RobotIcon} tooltip="Assistant · BETA">
              <span className="flex-1 truncate">Assistant</span>
              <Badge variant="beta">BETA</Badge>
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={PaperPlaneTiltIcon} tooltip="Delivery">
              Delivery
            </Sidebar.MenuButton>
            <Sidebar.MenuButton icon={BellIcon} tooltip="Alerts">
              Alerts
            </Sidebar.MenuButton>
            <Sidebar.MenuItem>
              <Sidebar.Collapsible>
                <Sidebar.CollapsibleTrigger
                  render={
                    <Sidebar.MenuButton icon={GearIcon} tooltip="Settings">
                      Settings
                      <Sidebar.MenuChevron />
                    </Sidebar.MenuButton>
                  }
                />
                <Sidebar.CollapsibleContent>
                  <Sidebar.MenuSub>
                    {['General', 'Delivery', 'Alerts'].map((panel) => (
                      <Sidebar.MenuSubButton key={panel} href="settings.html">
                        {panel}
                      </Sidebar.MenuSubButton>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.CollapsibleContent>
              </Sidebar.Collapsible>
            </Sidebar.MenuItem>
            <Sidebar.MenuButton icon={SlidersHorizontalIcon} tooltip="Manage workspace">
              Manage workspace
            </Sidebar.MenuButton>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>

      {/* The panel icon flips its bar across the same duration and curve the
          width travels on — Sidebar.Trigger's own doing, not ours. */}
      <Sidebar.Footer>
        <Sidebar.Trigger />
      </Sidebar.Footer>
    </Sidebar>
  );
}
