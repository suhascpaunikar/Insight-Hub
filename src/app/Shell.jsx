/* ==========================================================================
   Shell.jsx — the persistent console chrome (FR-58 … FR-63).

   The frame the four screens mount into: Kumo's Sidebar on the left, a 58px
   bar carrying the breadcrumb and three utilities, the tab strip and stat
   strip under it, the page, and the footer at the end of the scroll.

   The rail's collapse state is controlled rather than left to Kumo, because
   FR-61 wants it to survive a reload — and because the wizard keeps its own
   key: collapsing the rail to fill in a campaign must not collapse the
   console the reader left open behind it.
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar, Toasty, TooltipProvider } from '@cloudflare/kumo';
import { ShellStateProvider, useShell } from './ShellContext.jsx';
import { NavRail } from './NavRail.jsx';
import { TopBar } from './TopBar.jsx';
import { TabGroup } from './TabStrip.jsx';
import { StatStrip } from './StatStrip.jsx';
import { SiteFooter } from './SiteFooter.jsx';
import { QuickSearch } from './QuickSearch.jsx';
import { Assistant } from './Assistant.jsx';
import { useStore, useTheme } from '../lib/useStore.js';
import { toastManager } from '../lib/toast.js';

/**
 * `collapseKey` is why this takes a prop rather than reading one name: the
 * console persists to `navCollapsed` and the wizard to `builderNavCollapsed`,
 * so the two remember separately.
 */
export function Shell({ active, collapseKey = 'navCollapsed', children }) {
  return (
    <Toasty toastManager={toastManager}>
      {/* Groups the rail's tooltips so moving between collapsed items skips
          the open delay after the first. Kumo's CLI documents this as
          `Tooltip.Provider`, but the package exports it standalone. */}
      <TooltipProvider delay={400}>
        <ShellStateProvider>
          <ShellFrame active={active} collapseKey={collapseKey}>{children}</ShellFrame>
        </ShellStateProvider>
      </TooltipProvider>
    </Toasty>
  );
}

function ShellFrame({ active, collapseKey, children }) {
  const store = useStore();
  useTheme();
  const { crumbs, tabs, strip } = useShell();
  const [searchOpen, setSearchOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const scrollRef = useRef(null);
  const stripRef = useRef(null);

  const collapsed = Boolean(store.state[collapseKey]);

  const openAssistant = useCallback(() => {
    document.dispatchEvent(new CustomEvent('assistant:open'));
  }, []);

  /* ⌘K / Ctrl+K from anywhere. */
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* The tab strip scrolls away with the page; once it has, its group docks
     into the bar in place of the breadcrumb, and comes back when the page
     scrolls up. The strip keeps its height while empty, so docking never
     moves the content. */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return undefined;
    const update = () => {
      const band = stripRef.current;
      const height = band ? band.offsetHeight : 0;
      setDocked(Boolean(tabs) && height > 0 && scroller.scrollTop >= height);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, [tabs]);

  return (
    <Sidebar.Provider
      collapsible="icon"
      open={!collapsed}
      onOpenChange={(open) => store.set({ [collapseKey]: !open })}
    >
      <NavRail
        active={active}
        onOpenAssistant={openAssistant}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <div className="ih-main">
        <TopBar
          crumbs={crumbs}
          docked={docked}
          tabGroup={<TabGroup spec={tabs} />}
          onOpenAssistant={openAssistant}
        />
        <div className="ih-scroll" ref={scrollRef}>
          <div className="ih-tabstrip" ref={stripRef} hidden={!tabs || docked}>
            {!docked && <TabGroup spec={tabs} />}
          </div>
          <StatStrip spec={strip} entering={Boolean(strip?.key)} />
          <div className="ih-content">{children}</div>
          <SiteFooter />
        </div>
      </div>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {/* Docked bottom-right on every screen, outside the scroller. */}
      <Assistant />
    </Sidebar.Provider>
  );
}
