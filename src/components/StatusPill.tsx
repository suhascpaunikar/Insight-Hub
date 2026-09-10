/* FR-76 — a labelled pill with a state dot, legible without colour. Live is
   the one status still happening, so it is the one that moves: the ring is a
   pseudo-element animating transform and opacity, which composites rather
   than repainting, and it runs for as long as the tab is open. */
import type { CampaignStatus } from '../legacy';

const TONE: Record<CampaignStatus, string> = {
  Draft: 'text-kumo-subtle ring-kumo-line',
  Scheduled: 'text-kumo-info ring-kumo-info/40 bg-kumo-info-tint',
  Live: 'text-kumo-success ring-kumo-success/40 bg-kumo-success-tint',
  Paused: 'text-kumo-warning ring-kumo-warning/40 bg-kumo-warning-tint',
  Completed: 'text-kumo-subtle ring-kumo-line',
  Stopped: 'text-kumo-danger ring-kumo-danger/40 bg-kumo-danger-tint',
};

export function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]
                  font-medium whitespace-nowrap ring ring-inset ${TONE[status]}`}
    >
      <span
        aria-hidden
        className={`size-1.5 shrink-0 rounded-full bg-current ${status === 'Live' ? 'ih-live-dot' : ''}`}
      />
      {status}
    </span>
  );
}
