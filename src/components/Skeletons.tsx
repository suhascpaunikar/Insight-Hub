/* ==========================================================================
   Skeletons.tsx — what the screen shows while its data is on the way.

   Every block is sized to the real element it stands in for, so content lands
   into space already reserved and nothing below it jumps. Ours rather than
   Kumo's `SkeletonLine`: the shapes here are the shapes of this page's
   sparkline cards and three-line campaign rows, not generic lines.
   ========================================================================== */
import { LayerCard, Surface } from '@cloudflare/kumo';

const Bar = ({ w, h, className = '' }: { w: string; h: number; className?: string }) => (
  <span className={`ih-skel ${className}`} style={{ width: w, height: h }} />
);

export function StripSkeleton() {
  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <Bar w="180px" h={24} /><Bar w="150px" h={24} />
        </div>
        <Bar w="122px" h={28} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} className="flex flex-col gap-2.5 p-3.5">
            <Bar w="74px" h={9} />
            <Bar w="86px" h={24} />
            <Bar w="100%" h={40} />
            <div className="flex justify-between"><Bar w="40px" h={8} /><Bar w="40px" h={8} /></div>
          </Surface>
        ))}
      </div>
    </section>
  );
}

export function TableSkeleton({ rows }: { rows: number }) {
  return (
    <LayerCard className="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-kumo-line p-3">
        <Bar w="150px" h={28} />
        <Bar w="100%" h={28} className="min-w-[220px] flex-1" />
        <Bar w="96px" h={28} /><Bar w="168px" h={28} />
      </div>
      <div className="divide-y divide-kumo-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bar w="188px" h={13} /><Bar w="112px" h={10} />
            </div>
            <Bar w="64px" h={20} />
            <Bar w="94px" h={11} className="hidden sm:block" />
            <Bar w="76px" h={11} className="hidden lg:block" />
            <Bar w="58px" h={24} /><Bar w="24px" h={24} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-kumo-line px-3 py-2">
        <Bar w="142px" h={10} /><Bar w="186px" h={10} />
      </div>
    </LayerCard>
  );
}
