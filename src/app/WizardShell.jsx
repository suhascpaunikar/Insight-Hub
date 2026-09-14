/* ==========================================================================
   WizardShell.jsx — the builder's own chrome (§9.3).

   OD-15 revisited: the wizard keeps its own head and footer, but the console
   rail stays mounted beside it so the builder is not an unanchored full-screen
   surface. It opens as the icon strip and not the full column — filling a
   campaign in is the one place where the 152px matters more than the labels,
   and the Content step spends all of it. Expanding is one click, and the
   wizard remembers that answer separately from the console's (FR-61).

   Two chromes, switched from Settings → Prototype state: the steps ride in the
   shell's tab strip like every other screen's tabs, or the wizard wears its
   own boxed stepper.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Sidebar, Toasty, TooltipProvider, Breadcrumbs, Badge, Button } from '@cloudflare/kumo';
import { NavRail } from './NavRail.jsx';
import { TabGroup } from './TabStrip.jsx';
import { QuickSearch } from './QuickSearch.jsx';
import { Assistant } from './Assistant.jsx';
import { Icon } from '../lib/icons.jsx';
import { useStore, useTheme } from '../lib/useStore.js';
import { toastManager } from '../lib/toast.js';
import { relativeTime } from '../lib/format.js';

export function WizardShell({ draft, tabs, stepper, footer, onExit, children }) {
  return (
    <Toasty toastManager={toastManager}>
      <TooltipProvider delay={400}>
        <WizardFrame
          draft={draft} tabs={tabs} stepper={stepper} footer={footer} onExit={onExit}
        >
          {children}
        </WizardFrame>
      </TooltipProvider>
    </Toasty>
  );
}

function WizardFrame({ draft, tabs, stepper, footer, onExit, children }) {
  const store = useStore();
  useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const scrollRef = useRef(null);
  const stripRef = useRef(null);

  const collapsed = store.state.builderNavCollapsed !== false;

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

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !tabs) return undefined;
    const update = () => {
      const band = stripRef.current;
      const height = band ? band.offsetHeight : 0;
      setDocked(height > 0 && scroller.scrollTop >= height);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, [tabs]);

  /* FR-68 — the draft indicator, in the shape every other state in the product
     takes: a badge whose dot carries the colour. */
  const savedLabel = draft.dirty ? 'Unsaved changes'
    : draft.lastSavedAt ? `Saved ${relativeTime(draft.lastSavedAt)}` : 'Nothing to save yet';

  return (
    <Sidebar.Provider
      collapsible="icon"
      open={!collapsed}
      onOpenChange={(open) => store.set({ builderNavCollapsed: !open })}
    >
      <NavRail
        active="campaigns"
        onOpenAssistant={() => document.dispatchEvent(new CustomEvent('assistant:open'))}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <div className="ih-main">
        {/* Both chromes wear this, so the breadcrumb is the way back to the
            campaign list no matter which one is on. */}
        <header className="ih-topbar" data-docked={String(docked)}>
          {docked && tabs ? (
            <div className="ih-topbar-dock"><TabGroup spec={tabs} /></div>
          ) : (
            <Breadcrumbs size="sm">
              <Breadcrumbs.Link href="index.html" icon={<Icon name="megaphone" size={14} />}>
                Campaigns
              </Breadcrumbs.Link>
              <Breadcrumbs.Separator />
              <Breadcrumbs.Current>{draft.name || 'New campaign'}</Breadcrumbs.Current>
            </Breadcrumbs>
          )}
          <div className="ih-topbar-right ih-topbar-wide">
            <Badge variant="outline" size="sm">{draft.campaignId}</Badge>
            <Badge variant={draft.dirty ? 'warning' : 'success'} size="sm">
              <span className="ih-dot" aria-hidden="true" />{savedLabel}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onExit}>
              <Icon name="x" size={14} />Close
            </Button>
          </div>
        </header>

        {/* FR-64 / FR-67 — all four steps visible at once, and the chrome
            persists on scroll. */}
        {stepper && <div className="ih-stepper-bar">{stepper}</div>}

        <div className="ih-scroll" ref={scrollRef}>
          {tabs && (
            <div className="ih-tabstrip" ref={stripRef} hidden={docked}>
              {!docked && <TabGroup spec={tabs} />}
            </div>
          )}
          <div className="ih-page ih-step-page">{children}</div>
        </div>

        {/* OD-16 revisited — the stepper is the way back. It is on screen at
            every step, every completed step in it is clickable, and it says
            where each one lands; a Back button beside it was a second, worse
            route to the same place, and the only one that could not skip. */}
        <footer className="ih-builder-foot">
          <span />
          <span className="ih-row-gap">{footer}</span>
        </footer>
      </div>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {/* The wizard renders its own chrome rather than the console's, so the
          companion is mounted here too. */}
      <Assistant />
    </Sidebar.Provider>
  );
}
