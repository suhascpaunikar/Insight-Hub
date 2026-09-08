import * as React from "react"
import { MegaphoneIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { mountAssistant, openAssistant } from "@proto/assistant.js"
import { navigate } from "@proto/core.js"
import type { Campaign } from "@proto/data.js"
import { store, type DeletedRecord } from "@proto/store.js"

import { ActivityStrip, ActivityStripSkeleton } from "@/components/activity-strip"
import { AppSidebar } from "@/components/app-sidebar"
import {
  CampaignListSkeleton,
  CampaignRow,
  CampaignTableHead,
  CampaignToolbar,
  canDelete,
  selectRows,
  type ColumnKey,
  type Columns,
  type RowAction,
  type SearchField,
  type SortKey,
} from "@/components/campaign-table"
import { SiteHeader } from "@/components/site-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Table, TableBody } from "@/components/ui/table"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { count } from "@/lib/format"

/* ==========================================================================
   The campaign dashboard (FR-71 … FR-85) — the product's landing screen.

   Rebuilt on shadcn/ui. The behaviour is the one the prototype already
   specified; what changed is that the primitives underneath it — menus,
   dialogs, the table, the charts — are now components with real focus
   management and keyboard support instead of hand-rolled markup.
   ========================================================================== */

/* ---------- The wait before the data arrives ----------
   The same key and the same window the vanilla pages use, in sessionStorage:
   a section already seen this session is one a real client would have cached,
   so walking back from insights does not replay the load. */
const LAZY_STORE = "insighthub.loaded.v1"
const LAZY_MIN = 1000
const LAZY_MAX = 1500

function seenSections() {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(LAZY_STORE) || "[]"))
  } catch {
    return new Set<string>()
  }
}

function useLazySection(key: string, hasData: boolean) {
  const [pending, setPending] = React.useState(
    () => hasData && !seenSections().has(key),
  )

  React.useEffect(() => {
    if (!pending) return
    const timer = setTimeout(
      () => {
        try {
          const seen = seenSections()
          seen.add(key)
          sessionStorage.setItem(LAZY_STORE, JSON.stringify([...seen]))
        } catch {
          /* storage refused (private mode): the section reloads each visit */
        }
        setPending(false)
      },
      LAZY_MIN + Math.random() * (LAZY_MAX - LAZY_MIN),
    )
    return () => clearTimeout(timer)
  }, [key, pending])

  return pending
}

export function CampaignsPage() {
  /* The store is the vanilla prototype's, shared with the builder and the
     insights screen. It mutates in place, so a counter is what tells React a
     campaign changed — cheaper and more honest than mirroring the list into
     component state and having two answers to the same question. */
  const [revision, bump] = React.useReducer((n: number) => n + 1, 0)

  const [query, setQuery] = React.useState("")
  const [field, setField] = React.useState<SearchField>("name")
  const [sort, setSort] = React.useState<SortKey>("updated")
  const [range, setRange] = React.useState("30d")
  const [columns, setColumns] = React.useState<Columns>({
    trigger: true,
    responses: true,
    rating: true,
    updated: true,
  })

  // FR-61 — the rail remembers whether it was collapsed, in the same store the
  // other pages read. SidebarProvider treats onOpenChange as a controlled
  // handle, so the open value has to be held here rather than left to it.
  const [navOpen, setNavOpen] = React.useState(() => !store.state.navCollapsed)

  const [flashId, setFlashId] = React.useState<string | null>(null)
  const [renaming, setRenaming] = React.useState<Campaign | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [cloning, setCloning] = React.useState<Campaign | null>(null)
  const [stopping, setStopping] = React.useState<Campaign | null>(null)
  const [deleting, setDeleting] = React.useState<Campaign | null>(null)

  /* FR-60 — the assistant is shared chrome: the same companion the builder and
     the insights screen mount, reading the same store. It puts itself into
     <body> and is styled from the legacy layer (see src/legacy.css). */
  React.useEffect(() => {
    mountAssistant()
  }, [])

  const source: Campaign[] = store.state.emptyDashboard ? [] : store.state.campaigns
  const pending = useLazySection("campaigns", source.length > 0)
  const list = React.useMemo(
    () => selectRows(source, { query, field, sort }),
    // `revision` is the dependency that matters: the array identity does not
    // change when the store edits a campaign in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, query, field, sort, revision],
  )

  /** Marks a row for the beat after it changed, so the reader finds it again. */
  const flash = React.useCallback((id: string) => {
    setFlashId(id)
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), 1400)
  }, [])

  const startNew = () => {
    store.startNew(null)
    navigate("builder.html")
  }

  const onAction = (action: RowAction, campaign: Campaign) => {
    switch (action) {
      case "open":
        // FR-82 — Draft and Scheduled reopen the builder at the step they left.
        if (campaign.status === "Draft" || campaign.status === "Scheduled") {
          store.resumeCampaign(campaign.id)
          navigate("builder.html")
        } else {
          navigate(`insights.html?id=${encodeURIComponent(campaign.id)}`)
        }
        break

      case "rename":
        setRenameValue(campaign.name)
        setRenaming(campaign)
        break

      case "clone":
        setCloning(campaign)
        break

      case "copy-id":
        // The clipboard is refused outside a secure context and in some
        // embedded browsers. The ID is on the row and selectable (FR-75), so a
        // failure has somewhere to point rather than nowhere.
        navigator.clipboard.writeText(campaign.campaignId).then(
          () =>
            toast.success("Copied", {
              description: `${campaign.campaignId} is on your clipboard.`,
            }),
          () =>
            toast.warning("Could not copy", {
              description: `Select ${campaign.campaignId} on the row to copy it by hand.`,
            }),
        )
        break

      case "export":
        toast("Export queued", {
          description: `A download link for “${campaign.name}” will arrive by email when it is ready.`,
        })
        break

      // FR-79 — holding and resuming enrolment, without opening the campaign.
      case "pause":
      case "resume": {
        const next = action === "pause" ? "Paused" : "Live"
        store.setCampaignStatus(campaign.id, next)
        bump()
        toast(next === "Paused" ? "Campaign paused" : "Campaign resumed", {
          description:
            next === "Paused"
              ? "Enrolment is held. Nothing already sent is affected."
              : "Rolling enrolment has resumed.",
        })
        break
      }

      case "stop":
        setStopping(campaign)
        break

      case "delete":
        if (canDelete(campaign)) setDeleting(campaign)
        break
    }
  }

  const confirmRename = () => {
    const campaign = renaming
    const name = renameValue.trim()
    setRenaming(null)
    if (!campaign || !name || name === campaign.name) return
    store.renameCampaign(campaign.id, name)
    bump()
    flash(campaign.id)
    toast.success("Campaign renamed", { description: `Now “${name}”.` })
  }

  // FR-81 / OD-21 — clone lands the user in the new draft.
  const confirmClone = () => {
    const campaign = cloning
    setCloning(null)
    if (!campaign) return
    store.cloneCampaign(campaign.id)
    // The row the copy came from, marked for the beat before the builder opens
    // — the clone is traceable to its source rather than appearing from nowhere.
    flash(campaign.id)
    toast.success("Campaign cloned", {
      description: "Content, audience and trigger copied. Schedule and responses were not.",
    })
    setTimeout(() => navigate("builder.html"), 350)
  }

  const confirmStop = () => {
    const campaign = stopping
    setStopping(null)
    if (!campaign) return
    store.setCampaignStatus(campaign.id, "Stopped")
    bump()
    toast("Campaign stopped", {
      description: "Enrolment has ended. Collected responses remain here.",
    })
  }

  /* Delete asks, then hands back a way out. The dialog is where the reader
     decides; the toast is where they change their mind, which is a different
     moment and needs its own affordance — an undo they have to go looking for
     after the row has gone is not one. */
  const confirmDelete = () => {
    const campaign = deleting
    setDeleting(null)
    if (!campaign) return
    const record: DeletedRecord | null = store.deleteCampaign(campaign.id)
    bump()
    toast.error("Campaign deleted", {
      description: `“${campaign.name}” was removed.`,
      action: record
        ? {
            label: "Undo",
            onClick: () => {
              store.restoreCampaign(record)
              bump()
              flash(record.row.id)
              toast.success("Campaign restored", {
                description: `“${record.row.name}” is back in the list.`,
              })
            },
          }
        : undefined,
    })
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider
        open={navOpen}
        onOpenChange={(open) => {
          setNavOpen(open)
          store.set({ navCollapsed: !open })
        }}
        style={{ "--sidebar-width": "13.25rem" } as React.CSSProperties}
      >
        <AppSidebar active="campaigns" onOpenAssistant={() => openAssistant()} />

        <SidebarInset className="min-w-0">
          <SiteHeader
            workspace={store.state.workspace || "QuickEats India"}
            environment={store.state.environment || "Production"}
            onWorkspaceChange={(workspace) => {
              store.set({ workspace })
              bump()
            }}
            onEnvironmentChange={(environment) => {
              store.set({ environment })
              bump()
            }}
          />

          <main className="page-in mx-auto w-full max-w-[1400px] p-5 lg:p-6">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
                {/* FR-73 — what the two campaign states are actually for. */}
                <p className="text-muted-foreground mt-1 max-w-[74ch] text-[13px]">
                  Open a live campaign to watch delivery and responses arrive, or a
                  completed one to read its insights. Drafts and scheduled campaigns
                  reopen in the builder at the step you left.
                </p>
              </div>
              {/* FR-72 — the only route into campaign creation. */}
              <Button onClick={startNew}>
                <PlusIcon />
                New Campaign
              </Button>
            </header>

            {source.length === 0 ? null : pending ? (
              <ActivityStripSkeleton />
            ) : (
              <ActivityStrip campaigns={source} range={range} onRangeChange={setRange} />
            )}

            {source.length === 0 ? (
              <EmptyState onNew={startNew} />
            ) : pending ? (
              <CampaignListSkeleton columns={columns} total={source.length} />
            ) : (
              <Card className="gap-0 overflow-hidden py-0">
                <CampaignToolbar
                  field={field}
                  query={query}
                  sort={sort}
                  columns={columns}
                  onFieldChange={setField}
                  onQueryChange={setQuery}
                  onSortChange={setSort}
                  onColumnToggle={(key: ColumnKey) =>
                    setColumns((c) => ({ ...c, [key]: !c[key] }))
                  }
                />

                {list.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                    <p className="text-[13px]">No campaigns match “{query}”.</p>
                    <Button variant="link" size="sm" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-[62vh] overflow-auto">
                    <Table>
                      <CampaignTableHead columns={columns} />
                      <TableBody>
                        {list.map((campaign) => (
                          <CampaignRow
                            key={campaign.id}
                            campaign={campaign}
                            columns={columns}
                            flashed={flashId === campaign.id}
                            onAction={onAction}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* FR-63 — the footer count reflects filter and search state. */}
                <div className="flex items-center justify-between border-t px-4 py-2">
                  <span className="text-muted-strong font-mono text-[11px]">
                    {count(list.length)} of {count(source.length)} campaigns
                    {query ? " · filtered" : ""}
                  </span>
                  <span className="text-muted-strong text-[11px]">
                    Default sort: most recently updated
                  </span>
                </div>
              </Card>
            )}

            <p className="text-muted-strong mt-4 text-[11px]">
              Prototype data.{" "}
              <button
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  store.set({ emptyDashboard: !store.state.emptyDashboard })
                  bump()
                }}
              >
                {store.state.emptyDashboard
                  ? "Show the seeded campaigns"
                  : "Preview the first-run empty state"}
              </button>{" "}
              ·{" "}
              <button
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  // The key core.js actually persists under, so the reset
                  // reaches the state the rest of the prototype reads.
                  localStorage.removeItem("insighthub.prototype.v2")
                  location.reload()
                }}
              >
                Reset all prototype state
              </button>
            </p>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* ---------- Rename (FR-81) ---------- */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename campaign</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-input">Campaign name</Label>
            <Input
              id="rename-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            />
            <p className="text-muted-foreground text-xs">
              The campaign ID stays{" "}
              <span className="font-mono">{renaming?.campaignId}</span>. Nothing else
              about the campaign changes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Clone (FR-81 / OD-21) ---------- */}
      <Dialog open={!!cloning} onOpenChange={(open) => !open && setCloning(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clone “{cloning?.name}”?</DialogTitle>
            <DialogDescription>
              The copy takes this campaign's content, audience and trigger
              configuration. Its schedule and every collected response stay behind —
              the clone starts as a Draft with no data.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-strong text-[13px]">
            You will land in the new draft at step 1.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloning(null)}>
              Cancel
            </Button>
            <Button onClick={confirmClone}>Clone and open</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Stop (FR-48) ----------
          Same wording the insights page uses, because it is the same action and
          a reader should not have to work out whether two screens mean the same
          thing by it. */}
      <AlertDialog open={!!stopping} onOpenChange={(open) => !open && setStopping(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop “{stopping?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Stopping ends enrolment permanently. Everything already collected stays
              on the campaign's insights page. A stopped campaign cannot be resumed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmStop}>
              Stop campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Delete (FR-81) ---------- */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.responses > 0 ? (
                <>
                  This campaign has collected{" "}
                  <span className="font-mono">{count(deleting.responses)}</span>{" "}
                  responses. Deleting it removes them and its insights page along with
                  it.
                </>
              ) : (
                "This campaign has collected nothing, so there is no response data to lose."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-muted-strong text-[13px]">
            You can undo this from the confirmation for a few seconds.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            // Sonner's default action button is a white pill — the one light
            // surface on the page. Undo is an outline button like every other
            // secondary action here.
            actionButton:
              "!bg-secondary !text-foreground !border !border-border !rounded-md !text-xs !font-medium",
          },
        }}
      />
    </TooltipProvider>
  )
}

/** FR-85 — explain what a campaign does rather than showing empty headers. */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <Card className="py-0">
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="bg-secondary text-muted-foreground flex size-11 items-center justify-center rounded-lg">
          <MegaphoneIcon className="size-5" />
        </span>
        <h2 className="text-lg font-semibold">No campaigns yet</h2>
        <p className="text-muted-foreground max-w-[58ch] text-[13px]">
          A campaign asks your users a question at a moment you choose — after a
          delivery, after a cancellation, after they lapse — and collects the answers
          here so you can see what actually happened.
        </p>
        <Button className="mt-3" onClick={onNew}>
          <PlusIcon />
          New Campaign
        </Button>
      </div>
    </Card>
  )
}
