import {
  ArrowUpDownIcon,
  ChevronRightIcon,
  Columns3Icon,
  CopyIcon,
  DownloadIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SearchIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"

import {
  KIND_LABEL,
  campaignKind,
  isFeedback,
  type Campaign,
} from "@proto/data.js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { absoluteTime, count, ratingText, relativeTime, ratingColor } from "@/lib/format"

export const SORTS = {
  updated: "Most recently updated",
  responses: "Most responses",
  name: "Name A–Z",
  rating: "Lowest average rating",
} as const

export const COLUMN_LABELS = {
  trigger: "Trigger",
  responses: "Responses",
  rating: "Avg rating",
  updated: "Updated",
} as const

export type SortKey = keyof typeof SORTS
export type ColumnKey = keyof typeof COLUMN_LABELS
export type Columns = Record<ColumnKey, boolean>
export type SearchField = "name" | "id" | "trigger"

export const FIELD_LABEL: Record<SearchField, string> = {
  name: "campaign name",
  id: "campaign ID",
  trigger: "trigger",
}

/** Deleting is for campaigns that are not currently sending to anyone. */
export const canDelete = (c: Campaign) =>
  c.status !== "Live" && c.status !== "Paused"

/** Only a campaign that has run has anything to export. */
const hasData = (c: Campaign) =>
  c.status !== "Draft" && c.status !== "Scheduled"

export type RowAction =
  | "open"
  | "rename"
  | "clone"
  | "copy-id"
  | "export"
  | "pause"
  | "resume"
  | "stop"
  | "delete"

/* ==========================================================================
   FR-76 — a labelled pill with a state dot, legible without colour.
   ========================================================================== */

const STATUS_STYLES: Record<string, string> = {
  Live: "border-primary/35 bg-primary/10 text-primary",
  Paused: "border-warning/35 bg-warning/10 text-warning-foreground",
  Draft: "border-border bg-secondary text-muted-foreground",
  Scheduled: "border-info/35 bg-info/10 text-info-foreground",
  Completed: "border-border bg-secondary text-foreground-light",
  Stopped: "border-destructive/35 bg-destructive/10 text-destructive-foreground",
}

function StatusPill({ status }: { status: Campaign["status"] }) {
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-1.5 rounded-full px-2 text-[11px] font-medium ${STATUS_STYLES[status] ?? ""}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  )
}

/* ==========================================================================
   The campaign cell

   Three lines: what it is called, its ID, and what it was for. The row keeps
   the height of the three-line cell even when a campaign has no objective, so
   the list does not comb up and down as rows gain the third line.
   ========================================================================== */
function CampaignCell({ campaign }: { campaign: Campaign }) {
  const objective = campaign.objective?.trim()
  return (
    <div className="flex min-h-[54px] flex-col justify-center gap-0.5">
      <span className="flex items-center gap-1.5">
        <span className="truncate text-[13px] font-medium">{campaign.name}</span>

        {!isFeedback(campaign) ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="h-4 rounded px-1.5 text-[10px]">
                {KIND_LABEL[campaignKind(campaign)]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Collects no responses — opens on reach, engagement and conversion
            </TooltipContent>
          </Tooltip>
        ) : null}

        {campaign.versions > 1 ? (
          // FR-83 — the reader knows the aggregate spans a change before opening.
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="h-4 gap-0.5 rounded px-1.5 font-mono text-[10px]"
              >
                <LayersIcon className="size-2.5" />v{campaign.versions}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Edited after publish — responses span {campaign.versions} versions
            </TooltipContent>
          </Tooltip>
        ) : null}
      </span>

      {/* FR-75 — the ID is selectable for support and debugging. */}
      <span className="text-muted-strong font-mono text-[11px] select-all">
        {campaign.campaignId}
      </span>

      {/* The objective, one line of it. The name says what a campaign is called
          and the trigger says when it fires; this is the only column that says
          what it was for. */}
      {objective ? (
        <span
          className="text-muted-foreground max-w-[44ch] truncate text-[11px]"
          title={objective}
        >
          {objective}
        </span>
      ) : null}
    </div>
  )
}

function RatingValue({ campaign }: { campaign: Campaign }) {
  if (!campaign.avgRating) {
    return <span className="text-muted-strong font-mono text-xs">—</span>
  }
  const max = campaign.ratingScaleMax || 5
  return (
    <span className="tnum text-[13px]">
      <span style={{ color: ratingColor(campaign.avgRating, max) }}>
        {ratingText(campaign.avgRating)}
      </span>
      <span className="text-muted-strong font-mono text-[11px]"> /{max}</span>
    </span>
  )
}

/* ==========================================================================
   Row menu (FR-74, FR-79, FR-81)

   Everything you can do to a campaign without opening it, including the run
   controls that used to be reachable only from inside the campaign — holding a
   campaign that had started misbehaving should not mean opening it first.

   Status-adaptive rather than uniform. A Draft has never sent anything, so
   Pause and Stop are not "disabled" for it, they are meaningless, and a menu
   of greyed rows the reader has to read past is worse than a short one. Delete
   is the exception that stays visible while disabled: a reader who cannot find
   it assumes the product cannot do it.
   ========================================================================== */
function RowMenu({
  campaign,
  onAction,
}: {
  campaign: Campaign
  onAction: (action: RowAction, campaign: Campaign) => void
}) {
  const isLive = campaign.status === "Live"
  const isPaused = campaign.status === "Paused"
  const running = isLive || isPaused
  const deletable = canDelete(campaign)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${campaign.name}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">{campaign.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction("rename", campaign)}>
          <PencilIcon />
          Rename…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("clone", campaign)}>
          <CopyIcon />
          Clone…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("copy-id", campaign)}>
          <CopyIcon />
          Copy campaign ID
        </DropdownMenuItem>
        {hasData(campaign) ? (
          <DropdownMenuItem onSelect={() => onAction("export", campaign)}>
            <DownloadIcon />
            Export…
          </DropdownMenuItem>
        ) : null}

        {running ? <DropdownMenuSeparator /> : null}
        {isLive ? (
          <DropdownMenuItem onSelect={() => onAction("pause", campaign)}>
            <PauseIcon />
            Pause
          </DropdownMenuItem>
        ) : null}
        {isPaused ? (
          <DropdownMenuItem onSelect={() => onAction("resume", campaign)}>
            <PlayIcon />
            Resume
          </DropdownMenuItem>
        ) : null}
        {running ? (
          <DropdownMenuItem onSelect={() => onAction("stop", campaign)}>
            <SquareIcon />
            Stop…
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!deletable}
          title={
            deletable
              ? undefined
              : `A ${campaign.status.toLowerCase()} campaign is still enrolling users. Stop it first.`
          }
          onSelect={() => onAction("delete", campaign)}
        >
          <Trash2Icon />
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------- The list ---------- */

export function CampaignRow({
  campaign,
  columns,
  flashed,
  onAction,
}: {
  campaign: Campaign
  columns: Columns
  flashed: boolean
  onAction: (action: RowAction, campaign: Campaign) => void
}) {
  // FR-82 — Draft and Scheduled reopen the builder; everything else opens insights.
  const resumes = campaign.status === "Draft" || campaign.status === "Scheduled"

  return (
    <TableRow data-flash={flashed ? "" : undefined} className="group">
      <TableCell className="min-w-[240px]">
        <CampaignCell campaign={campaign} />
      </TableCell>
      <TableCell>
        <StatusPill status={campaign.status} />
      </TableCell>

      {columns.trigger ? (
        <TableCell>
          <span className="text-foreground-light font-mono text-[11px]">
            {campaign.triggerLabel}
          </span>
          {campaign.divergentTriggers ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="border-warning/35 bg-warning/10 text-warning-foreground ml-1.5 h-4 rounded px-1.5 text-[10px]"
                >
                  multiple
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Variants run different triggers — results are not like-for-like
              </TooltipContent>
            </Tooltip>
          ) : null}
        </TableCell>
      ) : null}

      {columns.responses ? (
        <TableCell className="text-right">
          {isFeedback(campaign) ? (
            <span className="tnum text-[13px]">{count(campaign.responses)}</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-strong font-mono text-[13px]">—</span>
              </TooltipTrigger>
              <TooltipContent>
                An announcement collects no responses — {count(campaign.reach || 0)}{" "}
                people reached
              </TooltipContent>
            </Tooltip>
          )}
        </TableCell>
      ) : null}

      {columns.rating ? (
        <TableCell className="text-right">
          <RatingValue campaign={campaign} />
        </TableCell>
      ) : null}

      {columns.updated ? (
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground text-[11px]">
                {relativeTime(campaign.updatedAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{absoluteTime(campaign.updatedAt)}</TooltipContent>
          </Tooltip>
        </TableCell>
      ) : null}

      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction("open", campaign)}
        >
          {resumes ? "Resume" : "Open"}
          {/* The chevron leans toward its destination on hover — the same two
              pixels every other list in the product uses. */}
          <ChevronRightIcon className="transition-transform group-hover:translate-x-0.5" />
        </Button>
      </TableCell>

      <TableCell className="w-px text-right">
        <RowMenu campaign={campaign} onAction={onAction} />
      </TableCell>
    </TableRow>
  )
}

export function CampaignToolbar({
  field,
  query,
  sort,
  columns,
  onFieldChange,
  onQueryChange,
  onSortChange,
  onColumnToggle,
}: {
  field: SearchField
  query: string
  sort: SortKey
  columns: Columns
  onFieldChange: (field: SearchField) => void
  onQueryChange: (query: string) => void
  onSortChange: (sort: SortKey) => void
  onColumnToggle: (column: ColumnKey) => void
}) {
  return (
    /* FR-63 / FR-84 — one toolbar pattern across every list screen. */
    <div className="flex flex-wrap items-center gap-2 border-b p-3">
      <Select value={field} onValueChange={(v) => onFieldChange(v as SearchField)}>
        <SelectTrigger size="sm" className="w-[172px]" aria-label="Search field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Campaign name</SelectItem>
          <SelectItem value="id">Campaign ID</SelectItem>
          <SelectItem value="trigger">Trigger</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative min-w-[220px] flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={`Search by ${FIELD_LABEL[field]}`}
          aria-label="Search campaigns"
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns3Icon />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
          {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
            <DropdownMenuCheckboxItem
              key={key}
              checked={columns[key]}
              onCheckedChange={() => onColumnToggle(key)}
              onSelect={(e) => e.preventDefault()}
            >
              {COLUMN_LABELS[key]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowUpDownIcon />
            {SORTS[sort]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(v) => onSortChange(v as SortKey)}
          >
            {(Object.keys(SORTS) as SortKey[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {SORTS[key]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function CampaignTableHead({ columns }: { columns: Columns }) {
  return (
    <TableHeader className="bg-secondary sticky top-0 z-10">
      <TableRow className="hover:bg-transparent">
        <TableHead className="text-[11px] tracking-wide uppercase">Campaign</TableHead>
        <TableHead className="text-[11px] tracking-wide uppercase">Status</TableHead>
        {columns.trigger ? (
          <TableHead className="text-[11px] tracking-wide uppercase">Trigger</TableHead>
        ) : null}
        {columns.responses ? (
          <TableHead className="text-right text-[11px] tracking-wide uppercase">
            Responses
          </TableHead>
        ) : null}
        {columns.rating ? (
          <TableHead className="text-right text-[11px] tracking-wide uppercase">
            Avg rating
          </TableHead>
        ) : null}
        {columns.updated ? (
          <TableHead className="text-[11px] tracking-wide uppercase">Updated</TableHead>
        ) : null}
        <TableHead className="text-right text-[11px] tracking-wide uppercase">
          Open
        </TableHead>
        <TableHead className="w-px">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

/** Mirrors the visible columns, so the header it loads under stays honest. */
export function CampaignListSkeleton({
  columns,
  total,
}: {
  columns: Columns
  total: number
}) {
  const right = (w: string) => (
    <TableCell className="text-right">
      <Skeleton className={`ml-auto h-3 ${w}`} />
    </TableCell>
  )

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Skeleton className="h-8 w-[172px]" />
        <Skeleton className="h-8 min-w-[220px] flex-1" />
        <Skeleton className="h-8 w-[104px]" />
        <Skeleton className="h-8 w-[184px]" />
      </div>
      <Table>
        <CampaignTableHead columns={columns} />
        <TableBody>
          {Array.from({ length: Math.min(total, 8) }, (_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className="min-w-[240px]">
                <div className="flex min-h-[54px] flex-col justify-center gap-1.5">
                  <Skeleton className="h-3.5 w-[188px]" />
                  <Skeleton className="h-2.5 w-[112px]" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              {columns.trigger ? (
                <TableCell>
                  <Skeleton className="h-3 w-[94px]" />
                </TableCell>
              ) : null}
              {columns.responses ? right("w-[42px]") : null}
              {columns.rating ? right("w-8") : null}
              {columns.updated ? (
                <TableCell>
                  <Skeleton className="h-3 w-[76px]" />
                </TableCell>
              ) : null}
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-[68px]" />
              </TableCell>
              <TableCell className="w-px">
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t px-4 py-2">
        <Skeleton className="h-2.5 w-[142px]" />
        <Skeleton className="h-2.5 w-[186px]" />
      </div>
    </Card>
  )
}

/* ---------- Filtering and sorting ---------- */
export function selectRows(
  source: Campaign[],
  { query, field, sort }: { query: string; field: SearchField; sort: SortKey },
) {
  const q = query.trim().toLowerCase()
  const filtered = source.filter((c) => {
    if (!q) return true
    const hay =
      field === "name" ? c.name : field === "id" ? c.campaignId : c.triggerLabel
    return hay.toLowerCase().includes(q)
  })
  return [...filtered].sort((a, b) => {
    if (sort === "responses") return b.responses - a.responses
    if (sort === "name") return a.name.localeCompare(b.name)
    if (sort === "rating") return (a.avgRating || 99) - (b.avgRating || 99)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}
