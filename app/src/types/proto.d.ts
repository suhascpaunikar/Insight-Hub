/* ==========================================================================
   Type surface for the prototype modules the vanilla pages already share.

   The builder, the insights screen and settings all read and write the same
   campaign store; this page is a rewrite of one screen, not a fork of the
   product, so it imports that store rather than keeping a second copy of the
   truth. These declarations cover only what the dashboard actually touches.
   ========================================================================== */

declare module "@proto/data.js" {
  export type CampaignStatus =
    | "Draft"
    | "Scheduled"
    | "Live"
    | "Paused"
    | "Stopped"
    | "Completed"

  export interface Campaign {
    id: string
    campaignId: string
    name: string
    goal: string
    channel: string
    status: CampaignStatus
    triggerLabel: string
    divergentTriggers: boolean
    responses: number
    reach?: number
    avgRating: number
    ratingElement: string
    ratingScaleMax: number
    updatedAt: string
    versions: number
    type: string
    audienceLabel: string
    runningDates: string
    objective?: string
  }

  /** One day of workspace-wide delivery, summed over every campaign. */
  export interface WorkspaceDay {
    date: string
    label: string
    sent: number
    failed: number
    completed: number
    abandoned: number
    /** Normalised 0–10 so it reads against the shared rating ramp. */
    rating: number
  }

  export type CampaignKind = "feedback" | "announcement"

  export const WORKSPACE_SERIES: WorkspaceDay[]
  export const RANGES: Record<string, { label: string; points: number }>
  export const KIND_LABEL: Record<CampaignKind, string>
  export function campaignKind(c: Partial<Campaign> | null | undefined): CampaignKind
  export function isFeedback(c: Partial<Campaign> | null | undefined): boolean
}

declare module "@proto/store.js" {
  import type { Campaign, CampaignStatus } from "@proto/data.js"

  export interface DeletedRecord {
    row: Campaign
    index: number
  }

  export interface PrototypeState {
    campaigns: Campaign[]
    emptyDashboard: boolean
    navCollapsed: boolean
    workspace?: string
    environment?: string
    draft: unknown
  }

  export const store: {
    state: PrototypeState
    set(patch: Partial<PrototypeState>): void
    startNew(goal?: string | null): unknown
    resumeCampaign(id: string): unknown
    cloneCampaign(id: string): unknown
    renameCampaign(id: string, name: string): Campaign | null
    setCampaignStatus(id: string, status: CampaignStatus): void
    deleteCampaign(id: string): DeletedRecord | null
    restoreCampaign(record: DeletedRecord): Campaign | null
  }
}

declare module "@proto/core.js" {
  export function navigate(href: string): void
  export function resetState(): void
  export function ratingColor(value: number, max?: number): string
}

declare module "@proto/assistant.js" {
  /** Puts the companion card and its launcher into <body>. Idempotent. */
  export function mountAssistant(): HTMLElement | undefined
  /** Opens it, optionally on one of its suggested questions. */
  export function openAssistant(intentId?: string | null): void
}
