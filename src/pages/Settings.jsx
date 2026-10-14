/* ==========================================================================
   Settings.jsx — workspace configuration (FR-63).

   The screen the console's settings patterns are built for: one bordered
   panel per concern, hairline-divided rows, each row a label and its
   explanation on the left with its control on the right, and a single Save
   in the panel's own footer that stays inert until something in that panel
   actually changed.

   Edits are held in component state, not in the store: a control writes to
   `edits`, the footer compares `edits` against what is saved, and only Save
   crosses over. Cancel drops the panel's keys and the rows re-read the
   stored values.
   ========================================================================== */
import { useState } from 'react';
import { Button, Input, Select, Switch, Banner, DropdownMenu, Text } from '@cloudflare/kumo';
import { Icon } from '../lib/icons.jsx';
import { useStore } from '../lib/useStore.js';
import { toast } from '../lib/toast.js';
import { useTabs } from '../app/ShellContext.jsx';
import { count } from '../lib/format.js';
import { resetState } from '../lib/persist.js';
import {
  SectionHead, SettingsPanel, SettingsRow, SettingsRowLink,
  UnitInput, PanelFoot, StatusPill,
} from '../app/settings-kit.jsx';
import { AlertDialog, ConfirmDialog } from '../app/dialogs.jsx';

const TABS = { general: 'General', delivery: 'Delivery', alerts: 'Alerts' };

/* Which panel owns which fields — a Save writes exactly this list, so one
   panel's pending edits can never ride along with another's. */
const PANELS = {
  workspace: ['workspaceName', 'region'],
  defaults: ['defaultRating'],
  responses: ['onePerUser', 'responseWindow', 'cooldown'],
  limits: ['inAppRate', 'pushRate', 'perUserRate'],
  digests: ['digestWeekly', 'digestDaily'],
};

const REGIONS = {
  'ap-south-1': 'Mumbai · ap-south-1',
  'ap-southeast-1': 'Singapore · ap-southeast-1',
  'eu-central-1': 'Frankfurt · eu-central-1',
};

const RATING_ELEMENTS = { nps: 'NPS 1–10', nps5: 'NPS 1–5', star: 'Star 1–5' };

const ALERTS = [
  {
    key: 'alertRating', label: 'Rating drops below the floor',
    desc: 'Fires when a live campaign’s rolling average falls under the floor for two consecutive days.',
  },
  {
    key: 'alertStall', label: 'Response volume stalls',
    desc: 'Fires when a live campaign collects nothing for 24 hours after having collected steadily.',
  },
  {
    key: 'alertComplete', label: 'Campaign completed',
    desc: 'Fires once when a campaign reaches its end date or its response target.',
  },
  {
    key: 'alertTheme', label: 'New theme detected',
    desc: 'Fires when the theme model groups enough new responses to name a theme that was not there last week.',
    beta: true,
  },
];

export function Settings() {
  const store = useStore();
  const [tab, setTab] = useState('general');
  const [edits, setEdits] = useState({});
  const [openAlert, setOpenAlert] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const saved = store.state.settings;
  const val = (field) => (field in edits ? edits[field] : saved[field]);
  const dirty = (panel) => PANELS[panel].some((f) => f in edits && edits[f] !== saved[f]);
  const edit = (field, value) => setEdits((e) => ({ ...e, [field]: value }));

  /* The tabs sit in the shell's strip above the page. Leaving a tab drops its
     pending edits rather than carrying them across to a Save the reader can
     no longer see. */
  useTabs({
    label: 'Settings sections',
    items: Object.entries(TABS).map(([key, label]) => ({ key, label })),
    active: tab,
    onSelect: (key) => { setEdits({}); setTab(key); },
  }, [tab]);

  function savePanel(panel) {
    const patch = {};
    PANELS[panel].forEach((f) => { if (f in edits) patch[f] = edits[f]; });
    store.saveSettings(patch);
    setEdits((e) => {
      const next = { ...e };
      PANELS[panel].forEach((f) => delete next[f]);
      return next;
    });
    const n = Object.keys(patch).length;
    toast('Settings saved', `${n} setting${n === 1 ? '' : 's'} updated.`);
    // The switcher reads the workspace name, so renaming it here renames it
    // in the chrome too rather than leaving the two disagreeing.
    if (panel === 'workspace' && 'workspaceName' in patch) {
      store.set({ workspace: patch.workspaceName });
    }
  }

  function cancelPanel(panel) {
    setEdits((e) => {
      const next = { ...e };
      PANELS[panel].forEach((f) => delete next[f]);
      return next;
    });
  }

  return (
    <div className="ih-page ih-page-settings">
      <header className="ih-page-head">
        <div>
          <h1 className="ih-page-head-title">Settings</h1>
          <p className="ih-page-head-desc">
            Workspace configuration — the values every campaign inherits unless it overrides them.
          </p>
        </div>
        <div className="ih-page-head-actions">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => toast('Docs is not part of this prototype',
              'The three built screens are Campaigns, the builder and Insights.', 'warning')}
          >
            <Icon name="book" size={16} />Docs
          </Button>
        </div>
      </header>

      <div className="ih-page-body">
        {tab === 'general' && (
          <GeneralTab
            store={store} val={val} edit={edit}
            dirty={dirty} onSave={savePanel} onCancel={cancelPanel}
            onReset={() => setConfirmReset(true)}
          />
        )}
        {tab === 'delivery' && (
          <DeliveryTab
            val={val} edit={edit}
            dirty={dirty} onSave={savePanel} onCancel={cancelPanel}
          />
        )}
        {tab === 'alerts' && (
          <AlertsTab
            saved={saved} val={val} edit={edit}
            dirty={dirty} onSave={savePanel} onCancel={cancelPanel}
            onOpenAlert={setOpenAlert}
          />
        )}
      </div>

      <AlertDialog
        alert={openAlert}
        saved={saved}
        onClose={() => setOpenAlert(null)}
        onToggle={(key, next) => {
          store.saveSettings({ [key]: next });
          const alert = ALERTS.find((a) => a.key === key);
          toast(`${alert.label} ${next ? 'turned on' : 'turned off'}`);
          setOpenAlert(null);
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset all prototype state?"
        confirmLabel="Reset state"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { resetState(); location.reload(); }}
      >
        Saved campaigns, the in-progress draft and every setting on this screen go back to
        their seeded values. The page reloads.
      </ConfirmDialog>
    </div>
  );
}

/* ---------- General ---------- */

function GeneralTab({ store, val, edit, dirty, onSave, onCancel, onReset }) {
  return (
    <>
      <SectionHead title="Workspace" docs="Workspace">
        Who this workspace is, and where its responses are stored.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          label="Workspace name"
          desc="Shown in the workspace switcher and on every export."
          control={
            <Input
              size="sm"
              aria-label="Workspace name"
              value={val('workspaceName')}
              onChange={(e) => edit('workspaceName', e.target.value)}
            />
          }
        />
        <SettingsRow
          top
          label="Data region"
          desc="Where responses are written. Changing it applies to new campaigns only — collected responses stay where they were written."
          control={
            <Select
              size="sm"
              aria-label="Data region"
              items={REGIONS}
              value={val('region')}
              onValueChange={(v) => edit('region', v)}
            />
          }
        />
        <PanelFoot
          dirty={dirty('workspace')}
          hint="Applies to every campaign in this workspace."
          onSave={() => onSave('workspace')}
          onCancel={() => onCancel('workspace')}
        />
      </SettingsPanel>

      <SectionHead title="Campaign defaults" docs="Campaign defaults">
        What a new campaign starts with. Every one of these can be overridden in the builder.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          top
          label="Default rating element"
          desc="The scale a Ratings template opens with. The rating ramp normalises to whichever scale a campaign ends up using, so this changes the question, never the colour."
          control={
            <Select
              size="sm"
              aria-label="Default rating element"
              items={RATING_ELEMENTS}
              value={val('defaultRating')}
              onValueChange={(v) => edit('defaultRating', v)}
            />
          }
        />
        <SettingsRowLink
          label="Question library"
          desc="The reusable questions a new campaign can pull from."
          onClick={() => stub('Question library')}
        />
        <SettingsRowLink
          label="Exclusion lists"
          desc="Users held out of every campaign in this workspace, regardless of segment."
          onClick={() => stub('Exclusion lists')}
        />
        <PanelFoot
          dirty={dirty('defaults')}
          hint="Existing campaigns keep the element they were built with."
          onSave={() => onSave('defaults')}
          onCancel={() => onCancel('defaults')}
        />
      </SettingsPanel>

      <SectionHead title="Appearance" docs="Appearance">
        How the console is painted. The choice is this browser’s, not the workspace’s — it is
        stored beside the rest of the prototype state and applies the moment it changes.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          top
          label="Theme"
          desc="Dark is the console’s own scale and the default. Light is the dashboard’s light theme: the same tokens read from the other end, with the rating ramp and the chart series re-weighted so a colour keeps its meaning against a white card."
          control={
            <Select
              size="sm"
              aria-label="Theme"
              items={{ dark: 'Dark', light: 'Light' }}
              value={store.state.theme === 'light' ? 'light' : 'dark'}
              onValueChange={(theme) => {
                // Applied on the spot rather than through a panel Save: it is a
                // preference for the prototype, not a value a campaign inherits.
                // The store write drives `useTheme`, which sets `data-mode` and
                // re-reads the ramp.
                store.set({ theme });
                toast(theme === 'light' ? 'Light theme on' : 'Dark theme on',
                  theme === 'light'
                    ? 'The dashboard’s light scale. Every page in this browser takes it.'
                    : 'Back to the console’s own scale.');
              }}
            />
          }
        />
      </SettingsPanel>

      <SectionHead title="Interaction" docs="Interaction">
        What the console does beyond showing you the numbers. Like the theme, these are this
        browser’s choices and apply the moment they change. They are not equivalent — one of
        them costs a route and the other only costs a shortcut — so each row says what
        turning it off gives up.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          top
          label="Chart keyboard navigation"
          badge={<StatusPill on={store.state.chartKeys !== false} />}
          desc={
            <>
              Lets the delivery chart take focus, so <kbd className="ih-kbd">←</kbd>
              <kbd className="ih-kbd">→</kbd> read each column and{' '}
              <kbd className="ih-kbd">⇧</kbd> with an arrow selects a window to apply with{' '}
              <kbd className="ih-kbd">↵</kbd>. Turning it off takes the chart out of the tab
              order — useful if you tab past it often, at the cost of the per-column figures,
              which are then only readable by hovering. The Date range control still picks every
              preset either way.
            </>
          }
          control={
            <Switch
              aria-label="Chart keyboard navigation"
              checked={store.state.chartKeys !== false}
              onCheckedChange={(checked) => {
                // On the spot rather than through a panel Save, the way the
                // theme is: a preference for driving this browser, not a value
                // a campaign carries.
                store.set({ chartKeys: checked });
                toast(checked ? 'Chart keyboard navigation on' : 'Chart keyboard navigation off',
                  checked
                    ? 'The delivery chart takes focus, and the arrow keys read it.'
                    : 'The chart is no longer a tab stop. Its per-column figures are now on hover only.',
                  checked ? 'success' : 'info');
              }}
            />
          }
        />
        <SettingsRow
          top
          label="Cross-filter clicks"
          badge={<StatusPill on={store.state.crossFilter !== false} />}
          desc={
            <>
              Makes a value printed inside a panel the filter for that value — a rating bar
              filters the open text to that score, a segment on a response filters to that
              segment, a score driver opens the responses behind it. Turning it off leaves
              those as plain figures to read. Every filter they set is still on the controls
              above the tabs, so nothing becomes unreachable.
            </>
          }
          control={
            <Switch
              aria-label="Cross-filter clicks"
              checked={store.state.crossFilter !== false}
              onCheckedChange={(checked) => {
                store.set({ crossFilter: checked });
                toast(checked ? 'Cross-filter clicks on' : 'Cross-filter clicks off',
                  checked
                    ? 'Values inside a panel are the filter for that value again.'
                    : 'Panels are read-only. The filter controls above each screen still set everything.',
                  checked ? 'success' : 'info');
              }}
            />
          }
        />
      </SettingsPanel>

      <SectionHead title="Prototype state">
        This build keeps its state in the browser. Nothing here leaves the machine.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          top
          label="Builder chrome"
          desc="Which chrome the campaign wizard wears. The step strip puts its four steps in the tab strip every other screen uses; the boxed stepper is the wizard’s own band, which says a state word under each step at the cost of the height it takes."
          control={
            <Select
              size="sm"
              aria-label="Builder chrome"
              items={{ strip: 'Step strip', stepper: 'Progress stepper' }}
              value={store.state.builderChrome === 'stepper' ? 'stepper' : 'strip'}
              onValueChange={(v) => {
                store.set({ builderChrome: v });
                toast('Builder chrome switched',
                  v === 'stepper' ? 'The wizard opens with its boxed stepper.'
                    : 'The wizard opens with its steps in the tab strip.');
              }}
            />
          }
        />
        <SettingsRow
          auto
          label="Reset all prototype state"
          desc="Clears saved campaigns, the in-progress draft and every setting on this screen, then reloads."
          control={<Button size="sm" variant="destructive" onClick={onReset}>Reset state</Button>}
        />
      </SettingsPanel>
    </>
  );
}

/* ---------- Delivery ---------- */

function DeliveryTab({ val, edit, dirty, onSave, onCancel }) {
  const windowHours = Number(val('responseWindow')) || 0;
  const cooldownDays = Number(val('cooldown')) || 0;
  const inApp = Number(val('inAppRate'));
  const push = Number(val('pushRate'));

  return (
    <>
      <SectionHead title="Response handling" docs="Response handling">
        How long a prompt stays answerable, and how soon the same user can be asked again.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          auto
          label="One response per user"
          desc="When on, a user who has already answered a campaign is not shown it again, on any device."
          control={
            <Switch
              aria-label="One response per user"
              checked={Boolean(val('onePerUser'))}
              onCheckedChange={(checked) => edit('onePerUser', checked)}
            />
          }
        />
        <SettingsRow
          top
          label="Response window"
          desc="How long a delivered prompt stays answerable before it expires unanswered. Use 0 for never."
          control={
            <UnitInput
              label="Response window"
              value={val('responseWindow')}
              unit={windowHours === 0 ? 'never' : 'hours'}
              note={windowHours === 0
                ? { text: 'Prompts never expire' }
                : { text: `${(windowHours / 24).toFixed(1).replace(/\.0$/, '')} days` }}
              onChange={(n) => edit('responseWindow', n)}
            />
          }
        />
        <SettingsRow
          top
          label="Re-survey cooldown"
          desc="The minimum gap before a user who answered any campaign can be surveyed again. Use 0 for no cooldown."
          control={
            <UnitInput
              label="Re-survey cooldown"
              value={val('cooldown')}
              unit={cooldownDays === 0 ? 'no cooldown' : 'days'}
              note={cooldownDays === 0
                ? { text: 'Users can be surveyed back-to-back', warn: true }
                : { text: `Roughly ${Math.max(1, Math.round(365 / cooldownDays))} surveys per user per year` }}
              onChange={(n) => edit('cooldown', n)}
            />
          }
        />
        {/* A condition that qualifies the rows around it, stated between them.
            §11.2 named Banner as the one place §8's "never tint" gives way. */}
        <div className="ih-srow ih-srow-notice">
          <Banner
            variant="secondary"
            icon={<Icon name="info" size={16} />}
            title="Per-app response windows are on the Scale plan"
            description="Set a different window for Android, iOS and web instead of one across all three."
            action={
              <Banner.Action onClick={() => stub('Scale plan')}>Upgrade to Scale</Banner.Action>
            }
          />
        </div>
        <PanelFoot
          dirty={dirty('responses')}
          hint="Applies to prompts delivered from now on."
          onSave={() => onSave('responses')}
          onCancel={() => onCancel('responses')}
        />
      </SettingsPanel>

      <SectionHead title="Send rate limits" docs="Send rate limits">
        Ceilings on how often a user can be interrupted. They cap every campaign at once — a
        campaign cannot raise its own.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          top
          label="In-app prompt rate"
          desc="Prompts a single user can be shown inside the app per hour, across every running campaign."
          control={
            <UnitInput
              label="In-app prompt rate" value={val('inAppRate')} unit="prompts/h"
              note={{ text: `${count(inApp * 24)} per user per day` }}
              onChange={(n) => edit('inAppRate', n)}
            />
          }
        />
        <SettingsRow
          top
          label="Push prompt rate"
          desc="Push notifications a single user can receive per hour. Push is the more expensive interruption, so it is normally set below the in-app rate."
          control={
            <UnitInput
              label="Push prompt rate" value={val('pushRate')} unit="prompts/h"
              note={push > inApp
                ? { text: 'Above the in-app rate — push will interrupt more often than in-app', warn: true }
                : { text: `${count(push * 24)} per user per day` }}
              onChange={(n) => edit('pushRate', n)}
            />
          }
        />
        <SettingsRow
          top
          label="Response submission rate"
          desc="Submissions accepted from one device in a 5 minute window. Guards the collector against a client retry loop."
          control={
            <UnitInput
              label="Response submission rate" value={val('perUserRate')} unit="requests/5 min"
              note={{ text: `${count(Number(val('perUserRate')) * 12)} requests per hour` }}
              onChange={(n) => edit('perUserRate', n)}
            />
          }
        />
        <PanelFoot
          dirty={dirty('limits')}
          hint="Enforced by the collector, not the client."
          onSave={() => onSave('limits')}
          onCancel={() => onCancel('limits')}
        />
      </SettingsPanel>
    </>
  );
}

/* ---------- Alerts ---------- */

function AlertsTab({ saved, val, edit, dirty, onSave, onCancel, onOpenAlert }) {
  const connected = saved.channelConnected;

  return (
    <>
      {/* The standing condition, with the action that resolves it. */}
      {!connected && (
        <Banner
          className="ih-callout"
          icon={<Icon name="mail" size={16} />}
          title="Connect a channel to change where alerts go"
          description="Alerts are delivered to the workspace owner’s email using the default template. Connect a channel to route them elsewhere and to edit their subject and body."
          action={<ConnectSplit />}
        />
      )}

      <SectionHead title="Campaign alerts" docs="Campaign alerts">
        Sent as they happen. Open one to see what it watches and what it would have fired on.
      </SectionHead>
      <SettingsPanel>
        {ALERTS.map((alert) => (
          <SettingsRowLink
            key={alert.key}
            label={alert.label}
            desc={alert.desc}
            badge={alert.beta && <span className="ih-badge-ai">BETA</span>}
            status={<StatusPill on={Boolean(saved[alert.key])} />}
            onClick={() => onOpenAlert(alert)}
          />
        ))}
      </SettingsPanel>

      <SectionHead title="Digests" docs="Digests">
        A scheduled summary across every campaign, whether or not anything alerted.
      </SectionHead>
      <SettingsPanel>
        <SettingsRow
          auto
          label="Weekly digest"
          desc="Monday 09:00 in the workspace time zone: response volume, rating movement and the week’s largest drop-off."
          control={
            <Switch
              aria-label="Weekly digest"
              checked={Boolean(val('digestWeekly'))}
              onCheckedChange={(checked) => edit('digestWeekly', checked)}
            />
          }
        />
        <SettingsRow
          auto
          label="Daily digest"
          desc="Yesterday’s responses and any campaign that changed state. Noisy on a workspace with few live campaigns."
          control={
            <Switch
              aria-label="Daily digest"
              checked={Boolean(val('digestDaily'))}
              onCheckedChange={(checked) => edit('digestDaily', checked)}
            />
          }
        />
        <PanelFoot
          dirty={dirty('digests')}
          hint="Delivered to the workspace owner."
          onSave={() => onSave('digests')}
          onCancel={() => onCancel('digests')}
        />
      </SettingsPanel>
    </>
  );
}

/** §11.4's "no single Kumo split button; compose it" — Button + DropdownMenu. */
function ConnectSplit() {
  const channels = ['Slack', 'Webhook', 'PagerDuty', 'Custom SMTP'];
  const connect = (channel) => toast(
    channel ? `${channel} is not wired in this prototype` : 'Channel connection is not wired in this prototype',
    'Alerts keep going to the workspace owner’s email.',
    'warning',
  );
  return (
    <span className="ih-split">
      <Button size="sm" variant="secondary" onClick={() => connect(null)}>Connect channel</Button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={<Button size="sm" variant="secondary" aria-label="Choose a channel"><Icon name="down" size={12} /></Button>}
        />
        <DropdownMenu.Content align="end">
          {channels.map((c) => (
            <DropdownMenu.Item key={c} onClick={() => connect(c)}>{c}</DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
    </span>
  );
}

const stub = (what) => toast(`${what} is not part of this prototype`,
  'The three built screens are Campaigns, the builder and Insights.', 'warning');
