/* ==========================================================================
   CampaignTable.tsx — the campaign list (FR-63, FR-74 … FR-85).

   Kumo's `Table` inside a `LayerCard`, with the prototype's own row
   behaviour on top of it: the chevron leans two pixels toward its
   destination on hover, a deleted row leaves and the toast carries the way
   back for eight seconds, and a row that was just cloned, renamed or
   restored flashes once and stops.

   The row menu is status-adaptive rather than uniform. A Draft has never sent
   anything, so Pause and Stop are not "disabled" for it — they are
   meaningless, and a menu of greyed rows the reader has to read past is worse
   than a short one. Delete is the exception that stays visible while
   disabled: a reader who cannot find it assumes the product cannot do it, so
   it is shown with the reason it cannot be pressed attached.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import {
  Badge, Button, Dialog, DropdownMenu, Input, InputGroup, LayerCard, Select, Table, Tooltip,
  useKumoToastManager,
} from '@cloudflare/kumo';
import {
  ArrowRightIcon, ArrowsDownUpIcon, ClipboardIcon, ColumnsPlusRightIcon, CopyIcon,
  DotsThreeIcon, DownloadSimpleIcon, MagnifyingGlassIcon, PauseIcon, PencilSimpleIcon,
  PlayIcon, StackIcon, StopIcon, TrashIcon,
} from '@phosphor-icons/react';
import { StatusPill } from './StatusPill';
import {
  type Campaign, KIND_LABEL, absoluteTime, campaignKind, count, isFeedback,
  ratingColor, ratingText, relativeTime, store,
} from '../legacy';

const SORTS = {
  updated: 'Most recently updated',
  responses: 'Most responses',
  name: 'Name A–Z',
  rating: 'Lowest average rating',
} as const;
type SortKey = keyof typeof SORTS;

const COLUMN_LABELS = {
  trigger: 'Trigger',
  responses: 'Responses',
  rating: 'Avg rating',
  updated: 'Updated',
} as const;
type ColumnKey = keyof typeof COLUMN_LABELS;

const FIELDS = { name: 'campaign name', id: 'campaign ID', trigger: 'trigger' } as const;
type FieldKey = keyof typeof FIELDS;

/** Deleting is for campaigns that are not currently sending to anyone. */
const canDelete = (c: Campaign) => c.status !== 'Live' && c.status !== 'Paused';
/** Only a campaign that has run has anything to export. */
const hasData = (c: Campaign) => c.status !== 'Draft' && c.status !== 'Scheduled';

interface Props {
  campaigns: Campaign[];
  total: number;
  entering: boolean;
  viewLabel: string;
  onChanged: () => void;
}

export function CampaignTable({ campaigns, total, entering, viewLabel, onChanged }: Props) {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<FieldKey>('name');
  const [sort, setSort] = useState<SortKey>('updated');
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>({
    trigger: true, responses: true, rating: true, updated: true,
  });
  const [renaming, setRenaming] = useState<Campaign | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const toasts = useKumoToastManager();
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  /** Say once that a row changed, then stop. */
  function flashRow(id: string) {
    setFlash(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 400);
  }

  const q = query.trim().toLowerCase();
  const filtered = campaigns.filter((c) => {
    if (!q) return true;
    const hay = field === 'name' ? c.name : field === 'id' ? c.campaignId : c.triggerLabel;
    return hay.toLowerCase().includes(q);
  });
  const list = [...filtered].sort((a, b) => {
    if (sort === 'responses') return b.responses - a.responses;
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'rating') return (a.avgRating || 99) - (b.avgRating || 99);
    return +new Date(b.updatedAt) - +new Date(a.updatedAt);
  });

  function open(c: Campaign) {
    if (c.status === 'Draft' || c.status === 'Scheduled') {
      store.resumeCampaign(c.id);
      location.href = 'builder.html';
    } else {
      store.set({ insightsCampaignId: c.id });
      location.href = 'insights.html';
    }
  }

  function remove(c: Campaign) {
    const record = store.deleteCampaign(c.id);
    onChanged();
    if (!record) return;
    // The row leaves, and the toast carries the way back for eight seconds.
    toasts.add({
      title: `“${c.name}” deleted`,
      description: 'It will stop enrolling users immediately.',
      timeout: 8000,
      actions: [{
        children: 'Undo',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          const restored = store.restoreCampaign(record);
          onChanged();
          flashRow(restored.id);
        },
      }],
    });
  }

  function setStatus(c: Campaign, status: Campaign['status'], note: string) {
    store.setCampaignStatus(c.id, status);
    onChanged();
    flashRow(c.id);
    toasts.add({ title: note, variant: 'success' });
  }

  const shown = (Object.keys(COLUMN_LABELS) as ColumnKey[]).filter((k) => columns[k]);

  return (
    <>
      <LayerCard className={`overflow-visible p-0 ${entering ? 'ih-lazy-in' : ''}`}>
        {/* FR-63 / FR-84 — one toolbar pattern across every list screen. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line p-3">
          <Select
            size="sm"
            className="w-[150px]"
            aria-label="Search field"
            value={field}
            onValueChange={(v) => setField((v as FieldKey) ?? 'name')}
            items={{ name: 'Campaign name', id: 'Campaign ID', trigger: 'Trigger' }}
          />
          <InputGroup className="min-w-[220px] flex-1">
            <InputGroup.Addon>
              <MagnifyingGlassIcon />
            </InputGroup.Addon>
            <InputGroup.Input
              type="search"
              aria-label="Search campaigns"
              placeholder={`Search by ${FIELDS[field]}`}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </InputGroup>

          <DropdownMenu>
            <DropdownMenu.Trigger
              render={<Button size="sm" variant="secondary" icon={<ColumnsPlusRightIcon />}>Columns</Button>}
            />
            <DropdownMenu.Content align="end">
              {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                <DropdownMenu.CheckboxItem
                  key={key}
                  checked={columns[key]}
                  onCheckedChange={(on: boolean) => setColumns((c) => ({ ...c, [key]: on }))}
                >
                  {COLUMN_LABELS[key]}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenu.Trigger
              render={<Button size="sm" variant="secondary" icon={<ArrowsDownUpIcon />}>{SORTS[sort]}</Button>}
            />
            <DropdownMenu.Content align="end">
              {(Object.keys(SORTS) as SortKey[]).map((key) => (
                <DropdownMenu.Item key={key} selected={sort === key} onClick={() => setSort(key)}>
                  {SORTS[key]}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        {list.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-kumo-default">
              No campaigns match {q ? `“${query}”` : `the ${viewLabel.toLowerCase()} view`}.
            </p>
            {q && (
              <Button variant="ghost" className="mt-2" onClick={() => setQuery('')}>
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Campaign</Table.Head>
                  <Table.Head>Status</Table.Head>
                  {columns.trigger && <Table.Head>Trigger</Table.Head>}
                  {columns.responses && <Table.Head className="text-right">Responses</Table.Head>}
                  {columns.rating && <Table.Head className="text-right">Avg rating</Table.Head>}
                  {columns.updated && <Table.Head>Updated</Table.Head>}
                  <Table.Head className="text-right">Open</Table.Head>
                  <Table.Head className="w-px"><span className="sr-only">Actions</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {list.map((c) => (
                  <Table.Row key={c.id} className={`ih-row ${flash === c.id ? 'ih-row-flash' : ''}`}>
                    <Table.Cell>
                      {/* The min-height is the three-line cell: name, ID,
                          objective. A campaign without an objective keeps the
                          row the same height as the ones that have one, so the
                          list does not comb up and down. */}
                      <div className="flex min-h-[54px] flex-col justify-center gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-kumo-strong">{c.name}</span>
                          {!isFeedback(c) && (
                            <Tooltip content="Collects no responses — opens on reach, engagement and conversion"
                                     render={<Badge variant="neutral">{KIND_LABEL[campaignKind(c)]}</Badge>} />
                          )}
                          {/* FR-83 — the reader knows the aggregate spans a
                              change before opening. */}
                          {c.versions > 1 && (
                            <Tooltip
                              content={`Edited after publish — responses span ${c.versions} versions`}
                              render={
                                <Badge variant="outline">
                                  <StackIcon className="size-3" />v{c.versions}
                                </Badge>
                              }
                            />
                          )}
                        </span>
                        {/* FR-75 — the ID is selectable for support and debugging. */}
                        <span className="font-mono text-[11px] text-kumo-inactive select-all">{c.campaignId}</span>
                        {/* The one column that says what the campaign was for. */}
                        {c.objective?.trim() && (
                          <span className="max-w-[44ch] truncate text-[11px] text-kumo-inactive"
                                title={c.objective.trim()}>
                            {c.objective.trim()}
                          </span>
                        )}
                      </div>
                    </Table.Cell>

                    <Table.Cell><StatusPill status={c.status} /></Table.Cell>

                    {columns.trigger && (
                      <Table.Cell>
                        <span className="font-mono text-[11px] text-kumo-subtle">{c.triggerLabel}</span>
                        {c.divergentTriggers && (
                          <Tooltip
                            content="Variants run different triggers — results are not like-for-like"
                            render={<Badge variant="warning" className="ml-1.5">multiple</Badge>}
                          />
                        )}
                      </Table.Cell>
                    )}

                    {columns.responses && (
                      <Table.Cell className="text-right tabular-nums">
                        {isFeedback(c) ? count(c.responses) : (
                          <Tooltip
                            content={`An announcement collects no responses — ${count(c.reach || 0)} people reached`}
                            render={<span className="font-mono text-kumo-inactive">—</span>}
                          />
                        )}
                      </Table.Cell>
                    )}

                    {columns.rating && (
                      <Table.Cell className="text-right tabular-nums">
                        {c.avgRating
                          ? <span style={{ color: ratingColor(c.avgRating, c.ratingScaleMax || 5) }}>
                              {ratingText(c.avgRating)}
                            </span>
                          : <span className="text-kumo-inactive">—</span>}
                      </Table.Cell>
                    )}

                    {columns.updated && (
                      <Table.Cell>
                        <Tooltip
                          content={absoluteTime(c.updatedAt)}
                          render={<span className="text-[11px] text-kumo-subtle">{relativeTime(c.updatedAt)}</span>}
                        />
                      </Table.Cell>
                    )}

                    <Table.Cell className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => open(c)}>
                        {c.status === 'Draft' || c.status === 'Scheduled' ? 'Resume' : 'Open'}
                        <ArrowRightIcon className="ih-lean size-3" />
                      </Button>
                    </Table.Cell>

                    <Table.Cell className="w-px text-right">
                      <RowMenu
                        campaign={c}
                        onRename={() => setRenaming(c)}
                        onClone={() => { const made = store.cloneCampaign(c.id); onChanged(); flashRow(made.id); }}
                        onCopyId={() => {
                          navigator.clipboard?.writeText(c.campaignId);
                          toasts.add({ title: 'Campaign ID copied', description: c.campaignId });
                        }}
                        onExport={() => toasts.add({ title: 'Export queued', description: `${c.name} · CSV`, variant: 'info' })}
                        onPause={() => setStatus(c, 'Paused', `“${c.name}” paused`)}
                        onResume={() => setStatus(c, 'Live', `“${c.name}” resumed`)}
                        onStop={() => setStatus(c, 'Stopped', `“${c.name}” stopped`)}
                        onDelete={() => remove(c)}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}

        {/* FR-63 — the footer count reflects filter and search state. */}
        <div className="flex items-center justify-between border-t border-kumo-line px-3 py-2">
          <span className="font-mono text-[11px] text-kumo-inactive">
            {count(list.length)} of {count(total)} campaigns{q ? ' · filtered' : ''}
          </span>
          <span className="text-[11px] text-kumo-inactive">Default sort: most recently updated</span>
        </div>
      </LayerCard>

      {renaming && (
        <RenameDialog
          campaign={renaming}
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            store.renameCampaign(renaming.id, name);
            onChanged();
            flashRow(renaming.id);
            setRenaming(null);
          }}
        />
      )}
    </>
  );
}

function RowMenu({
  campaign: c, onRename, onClone, onCopyId, onExport, onPause, onResume, onStop, onDelete,
}: {
  campaign: Campaign;
  onRename: () => void; onClone: () => void; onCopyId: () => void; onExport: () => void;
  onPause: () => void; onResume: () => void; onStop: () => void; onDelete: () => void;
}) {
  const running = c.status === 'Live' || c.status === 'Paused';
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" shape="square" size="sm" aria-label={`Actions for ${c.name}`}
                  icon={<DotsThreeIcon weight="bold" />} />
        }
      />
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item icon={<PencilSimpleIcon />} onClick={onRename}>Rename…</DropdownMenu.Item>
        <DropdownMenu.Item icon={<CopyIcon />} onClick={onClone}>Clone…</DropdownMenu.Item>
        <DropdownMenu.Item icon={<ClipboardIcon />} onClick={onCopyId}>Copy campaign ID</DropdownMenu.Item>
        {hasData(c) && (
          <DropdownMenu.Item icon={<DownloadSimpleIcon />} onClick={onExport}>Export…</DropdownMenu.Item>
        )}
        {/* FR-79 — the run controls, on the row rather than one screen inside it. */}
        {running && <DropdownMenu.Separator />}
        {c.status === 'Live' && (
          <DropdownMenu.Item icon={<PauseIcon />} onClick={onPause}>Pause</DropdownMenu.Item>
        )}
        {c.status === 'Paused' && (
          <DropdownMenu.Item icon={<PlayIcon />} onClick={onResume}>Resume</DropdownMenu.Item>
        )}
        {running && (
          <DropdownMenu.Item icon={<StopIcon />} onClick={onStop}>Stop…</DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          variant="danger"
          disabled={!canDelete(c)}
          title={canDelete(c) ? undefined
            : `A ${c.status.toLowerCase()} campaign is still enrolling users. Stop it first.`}
          icon={<TrashIcon />}
          onClick={() => canDelete(c) && onDelete()}
        >
          Delete…
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function RenameDialog({
  campaign, onClose, onSave,
}: { campaign: Campaign; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(campaign.name);
  return (
    <Dialog.Root open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <Dialog className="p-6">
        <Dialog.Title className="text-lg font-semibold">Rename campaign</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-kumo-subtle">
          The campaign ID {campaign.campaignId} does not change.
        </Dialog.Description>
        <div className="mt-4">
          <Input
            autoFocus
            label="Campaign name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.currentTarget.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' && name.trim()) onSave(name.trim());
            }}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            Rename
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
