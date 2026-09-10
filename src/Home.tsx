/* ==========================================================================
   Home.tsx — the campaign dashboard, the product's landing screen.

   The layout is Kumo's `Sidebar.Provider` shell: the sidebar and the content
   beside it are one flex row, so the content reflows as the sidebar travels
   rather than being overlaid by it — the behaviour in the reference
   recording, and Kumo's own default.

   The wait before the list arrives is the prototype's, kept: a section
   already seen this session is one a real client would have cached, and a
   workspace with no campaigns is not waiting on anything — the empty state is
   the answer, not a placeholder for one.
   ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import {
  Button, CommandPalette, Empty, LayerCard, Sidebar, Tooltip, TooltipProvider,
} from '@cloudflare/kumo';
import {
  ArrowClockwiseIcon, MegaphoneIcon, PlusIcon, QuestionIcon,
} from '@phosphor-icons/react';
import { AppSidebar, STATUS_VIEWS, type StatusView } from './shell/AppSidebar';
import { ActivityStrip } from './components/ActivityStrip';
import { CampaignTable } from './components/CampaignTable';
import { TopBar } from './shell/TopBar';
import { StripSkeleton, TableSkeleton } from './components/Skeletons';
import { hasLoaded, lazyLoad } from './motion';
import { type Campaign, store } from './legacy';

export function Home() {
  const [tick, setTick] = useState(0);
  const [statusView, setStatusView] = useState<StatusView>('all');
  const [workspace, setWorkspace] = useState<string>(
    (store.state.workspace as string) || 'QuickEats India',
  );
  const [paletteOpen, setPaletteOpen] = useState(false);

  const source: Campaign[] = store.state.emptyDashboard ? [] : store.state.campaigns;
  const refresh = () => setTick((n) => n + 1);

  // `pending` is the skeleton; `entering` is the one repaint that followed a
  // wait and therefore gets the fade-up. Chrome that was on screen throughout
  // the wait never animates — it would only flicker.
  const [pending, setPending] = useState(() => source.length > 0 && !hasLoaded('campaigns'));
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (!pending) return;
    return lazyLoad('campaigns', () => { setPending(false); setEntering(true); });
  }, [pending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const view = STATUS_VIEWS.find((v) => v.key === statusView)!;
  const scoped = useMemo(
    () => source.filter(view.match),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, statusView, tick],
  );

  return (
    <TooltipProvider>
      <Sidebar.Provider defaultOpen className="h-dvh">
        <AppSidebar
          campaigns={source}
          statusView={statusView}
          onStatusView={setStatusView}
          onSearch={() => setPaletteOpen(true)}
          workspace={workspace}
          onWorkspace={(name) => { setWorkspace(name); store.set({ workspace: name }); }}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-kumo-bg">
          <TopBar view={view.label} />

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6">
              <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-kumo-strong">
                    {view.label === 'All campaigns' ? 'Campaigns' : view.label}
                  </h1>
                  {/* FR-73 — what the two campaign states are actually for. */}
                  <p className="mt-1 max-w-[74ch] text-sm text-kumo-subtle">
                    Open a live campaign to watch delivery and responses arrive, or a completed
                    one to read its insights. Drafts and scheduled campaigns reopen in the builder
                    at the step you left.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tooltip
                    content="Help and docs"
                    render={<Button variant="ghost" shape="square" icon={<QuestionIcon />} aria-label="Help and docs" />}
                  />
                  {/* FR-72 — the only route into campaign creation. */}
                  <Button
                    variant="primary"
                    icon={<PlusIcon />}
                    onClick={() => { store.startNew(null); location.href = 'builder.html'; }}
                  >
                    New Campaign
                  </Button>
                </div>
              </header>

              {source.length === 0 ? (
                /* FR-85 — explain what a campaign does rather than showing
                   empty headers. */
                <LayerCard className="px-6 py-16">
                  <Empty
                    icon={<MegaphoneIcon size={44} />}
                    title="No campaigns yet"
                    description="A campaign asks your users a question at a moment you choose — after a
                      delivery, after a cancellation, after they lapse — and collects the answers here
                      so you can see what actually happened."
                    contents={
                      <Button variant="primary" icon={<PlusIcon />}
                              onClick={() => { store.startNew(null); location.href = 'builder.html'; }}>
                        New Campaign
                      </Button>
                    }
                  />
                </LayerCard>
              ) : pending ? (
                <>
                  <StripSkeleton />
                  <TableSkeleton rows={Math.min(source.length, 6)} />
                </>
              ) : (
                <>
                  <ActivityStrip campaigns={source} entering={entering} />
                  <CampaignTable
                    key={statusView}
                    campaigns={scoped}
                    total={source.length}
                    entering={entering}
                    viewLabel={view.label}
                    onChanged={refresh}
                  />
                </>
              )}

              <p className="mt-4 text-[11px] text-kumo-inactive">
                Prototype data.{' '}
                <button
                  type="button"
                  className="cursor-pointer underline underline-offset-2 hover:text-kumo-subtle"
                  onClick={() => {
                    store.set({ emptyDashboard: !store.state.emptyDashboard });
                    refresh();
                  }}
                >
                  {store.state.emptyDashboard ? 'Show the seeded campaigns' : 'Preview the first-run empty state'}
                </button>
                {' · '}
                <button
                  type="button"
                  className="cursor-pointer underline underline-offset-2 hover:text-kumo-subtle"
                  onClick={() => { localStorage.clear(); location.reload(); }}
                >
                  <ArrowClockwiseIcon className="inline size-3" /> Reset all prototype state
                </button>
              </p>
            </div>
          </main>
        </div>

        <QuickSearch
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          campaigns={source}
          onPick={(c) => {
            setPaletteOpen(false);
            if (c.status === 'Draft' || c.status === 'Scheduled') {
              store.resumeCampaign(c.id);
              location.href = 'builder.html';
            } else {
              store.set({ insightsCampaignId: c.id });
              location.href = 'insights.html';
            }
          }}
        />
      </Sidebar.Provider>
    </TooltipProvider>
  );
}

/** ⌘K — the sidebar's search box and the keyboard shortcut open the same thing. */
function QuickSearch({
  open, onOpenChange, campaigns, onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: Campaign[];
  onPick: (c: Campaign) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const items = campaigns
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.campaignId.toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <CommandPalette.Root
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      value={search}
      onValueChange={setSearch}
      itemToStringValue={(c: Campaign) => c.name}
      onSelect={(c: Campaign) => onPick(c)}
    >
      <CommandPalette.Input placeholder="Search campaigns, segments, templates" />
      <CommandPalette.List>
        <CommandPalette.Results>
          {(c: Campaign) => (
            <CommandPalette.Item key={c.id} value={c} onClick={() => onPick(c)}>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[11px] text-kumo-inactive">{c.campaignId}</span>
            </CommandPalette.Item>
          )}
        </CommandPalette.Results>
        <CommandPalette.Empty>No campaign matches “{search}”.</CommandPalette.Empty>
      </CommandPalette.List>
    </CommandPalette.Root>
  );
}
