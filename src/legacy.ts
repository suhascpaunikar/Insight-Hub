/* ==========================================================================
   legacy.ts — the bridge to the prototype's existing model.

   The homepage is the only screen rebuilt in Kumo; the builder, insights and
   settings screens are still the original no-build prototype and still own
   the campaign model. So this imports that model rather than copying it:
   `store.js`, `data.js` and the formatting half of `core.js` are plain ES
   modules with no framework in them, and one source of truth means a campaign
   published from the builder still lands on this list, and a rename made here
   still reads through on every other screen.
   ========================================================================== */

import { store as legacyStore } from '../assets/js/store.js';
import {
  WORKSPACE_SERIES as LEGACY_SERIES,
  RANGES as LEGACY_RANGES,
  isFeedback as legacyIsFeedback,
  KIND_LABEL as LEGACY_KIND_LABEL,
  campaignKind as legacyCampaignKind,
} from '../assets/js/data.js';
import {
  count as legacyCount,
  percent as legacyPercent,
  relativeTime as legacyRelativeTime,
  absoluteTime as legacyAbsoluteTime,
  ratingColor as legacyRatingColor,
  ratingText as legacyRatingText,
  RAMP as LEGACY_RAMP,
} from '../assets/js/core.js';

export type CampaignStatus =
  | 'Draft' | 'Scheduled' | 'Live' | 'Paused' | 'Completed' | 'Stopped';

export interface Campaign {
  id: string;
  campaignId: string;
  name: string;
  goal: string;
  channel: string;
  status: CampaignStatus;
  triggerLabel: string;
  divergentTriggers: boolean;
  responses: number;
  avgRating: number;
  ratingElement: string;
  ratingScaleMax: number;
  updatedAt: string;
  versions: number;
  type: string;
  reach?: number;
  audienceLabel: string;
  runningDates: string;
  objective: string;
  resumeStep?: number;
}

export interface DayRow {
  label: string;
  sent: number;
  failed: number;
  completed: number;
  abandoned: number;
  rating: number;
}

export interface Store {
  state: {
    campaigns: Campaign[];
    workspace?: string;
    app?: string;
    environment?: string;
    navCollapsed: boolean;
    emptyDashboard: boolean;
    settings: { workspaceName: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  set(patch: Record<string, unknown>): void;
  save(): void;
  startNew(goal: string | null): unknown;
  cloneCampaign(id: string): Campaign;
  resumeCampaign(id: string): unknown;
  editCampaign(id: string): unknown;
  renameCampaign(id: string, name: string): Campaign;
  deleteCampaign(id: string): { row: Campaign; index: number } | null;
  restoreCampaign(record: unknown): Campaign;
  setCampaignStatus(id: string, status: CampaignStatus): Campaign;
}

export const store = legacyStore as unknown as Store;

export const WORKSPACE_SERIES = LEGACY_SERIES as DayRow[];
export const RANGES = LEGACY_RANGES as Record<string, { label: string; points: number }>;
export const KIND_LABEL = LEGACY_KIND_LABEL as Record<string, string>;
export const RAMP = LEGACY_RAMP as string[];

export const isFeedback = legacyIsFeedback as (c: Campaign) => boolean;
export const campaignKind = legacyCampaignKind as (c: Campaign) => string;
export const count = legacyCount as (n: number) => string;
export const percent = legacyPercent as (n: number, digits?: number) => string;
export const relativeTime = legacyRelativeTime as (iso: string) => string;
export const absoluteTime = legacyAbsoluteTime as (iso: string, withTime?: boolean) => string;
export const ratingColor = legacyRatingColor as (value: number, max?: number) => string;
export const ratingText = legacyRatingText as (n: number) => string;
