import * as React from "react"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import { ClockIcon } from "lucide-react"

import { RANGES, WORKSPACE_SERIES, type WorkspaceDay } from "@proto/data.js"
import type { Campaign } from "@proto/data.js"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { count, percent, ratingColor } from "@/lib/format"

/* ==========================================================================
   The activity strip (FR-71) — what the workspace did over the selected
   window, above the list of what produced it.

   Every figure is a sum over the same slice its chart draws, so the number and
   the shape can never disagree. The range picker re-slices both.
   ========================================================================== */

const sum = (rows: WorkspaceDay[], key: keyof WorkspaceDay) =>
  rows.reduce((total, row) => total + (row[key] as number), 0)

/** The share of shown prompts that were finished, for one day. */
const dayRate = (row: WorkspaceDay) =>
  (row.completed / (row.completed + row.abandoned)) * 100

/**
 * One card: what it counts, the series that qualifies it, and the shape over
 * the window with the window's own bounds underneath — a sparkline without its
 * time base is a decoration.
 *
 * `band` is the difference between a count and a rate. A count is read against
 * zero. A rate is not: completion moving 44% → 54% is the whole story, and
 * drawing it from zero flattens it into a wall of equal bars. A banded card
 * scales against the window's own low and high, and prints that low and high
 * where the dates would go — so the zoom is stated rather than hidden.
 */
function MetricCard({
  name,
  value,
  valueColor,
  sub,
  rows,
  config,
  bars,
  axis,
  band = false,
  colorBy,
}: {
  name: string
  value: string
  valueColor?: string
  sub?: string
  rows: WorkspaceDay[]
  config: ChartConfig
  bars: { key: string; stackId?: string }[]
  axis: [string, string]
  band?: boolean
  colorBy?: (row: WorkspaceDay) => string
}) {
  const keys = bars.map((b) => b.key)
  const totals = rows.map((row) =>
    keys.reduce((t, k) => t + ((row as unknown as Record<string, number>)[k] ?? 0), 0),
  )
  const floor = band ? Math.min(...totals) * 0.985 : 0

  const legend = Object.entries(config).filter(([, item]) => item.label)

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-0 px-4 pt-3.5 pb-0">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {name}
        </span>
        {legend.length > 1 ? (
          <span className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-[2px]"
              style={{ background: config[keys[1]]?.color }}
              aria-hidden
            />
            <span className="text-muted-foreground text-[10px]">
              {config[keys[1]]?.label}
            </span>
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="px-4 pt-1.5 pb-3.5">
        <div className="flex items-baseline gap-2">
          <span
            className="tnum text-2xl leading-none font-medium"
            style={valueColor ? { color: valueColor } : undefined}
          >
            {value}
          </span>
          {sub ? (
            <span className="text-muted-foreground tnum text-xs">{sub}</span>
          ) : null}
        </div>

        <ChartContainer config={config} className="mt-3 h-[52px] w-full">
          <BarChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis dataKey="label" hide />
            {/* The banded cards zoom to their own window; the counted ones keep
                their baseline at zero, where a count is read from. */}
            <YAxis hide domain={band ? [floor, "dataMax"] : [0, "dataMax"]} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" className="min-w-[9rem]" />}
            />
            {bars.map((bar, i) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                stackId={bar.stackId}
                fill={`var(--color-${bar.key})`}
                radius={i === bars.length - 1 ? [2, 2, 0, 0] : 0}
                isAnimationActive={false}
              >
                {/* Each bar takes its own point's ramp colour, so the trend is
                    readable as colour before the heights are read as a shape. */}
                {colorBy
                  ? rows.map((row) => (
                      <Cell key={row.date} fill={colorBy(row)} />
                    ))
                  : null}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>

        <div className="text-muted-strong mt-1.5 flex items-center justify-between text-[10px]">
          <span>{axis[0]}</span>
          <span>{axis[1]}</span>
        </div>
      </CardContent>
    </Card>
  )
}

/** A banded card's axis states its low and high instead of its dates. */
const bandAxis = (
  values: number[],
  fmt: (v: number) => string,
): [string, string] => [
  `${fmt(Math.min(...values))} low`,
  `${fmt(Math.max(...values))} high`,
]

export function ActivityStrip({
  campaigns,
  range,
  onRangeChange,
}: {
  campaigns: Campaign[]
  range: string
  onRangeChange: (range: string) => void
}) {
  const rows = React.useMemo(
    () => WORKSPACE_SERIES.slice(-RANGES[range].points),
    [range],
  )

  const sent = sum(rows, "sent")
  const failed = sum(rows, "failed")
  const completed = sum(rows, "completed")
  const abandoned = sum(rows, "abandoned")
  const started = completed + abandoned
  // Completion is measured against what was actually shown, not what was sent:
  // a delivery failure never reached a person and cannot be abandoned.
  const completionRate = started ? (completed / started) * 100 : 0
  const rating = rows.reduce((t, r) => t + r.rating, 0) / rows.length
  const live = campaigns.filter((c) => c.status === "Live").length
  const held = campaigns.filter(
    (c) => c.status === "Paused" || c.status === "Stopped",
  ).length
  const axis: [string, string] = [rows[0].label, rows[rows.length - 1].label]

  const withRate = React.useMemo(
    () => rows.map((row) => ({ ...row, rate: dayRate(row) })),
    [rows],
  )
  // Delivered is what actually reached a person, so it is sent minus the
  // failures stacked on top of it rather than a series of its own.
  const withDelivered = React.useMemo(
    () => rows.map((row) => ({ ...row, delivered: row.sent - row.failed })),
    [rows],
  )

  return (
    <section className="mb-5">
      {/* The headline pair: the volume, and the one rate that qualifies it. */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-baseline gap-1.5">
            <span className="tnum text-3xl leading-none font-medium">
              {count(completed)}
            </span>
            <span className="text-muted-foreground text-sm">Responses collected</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="tnum text-3xl leading-none font-medium">
              {percent(completionRate)}
            </span>
            <span className="text-muted-foreground text-sm">Completion rate</span>
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ClockIcon />
              {RANGES[range].label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Range</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={range} onValueChange={onRangeChange}>
              {Object.entries(RANGES).map(([key, r]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {r.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          name="Prompts sent"
          value={count(sent)}
          sub={count(failed)}
          rows={withDelivered}
          axis={axis}
          config={{
            delivered: { label: "Delivered", color: "color-mix(in oklab, var(--primary) 32%, transparent)" },
            failed: { label: "Failed", color: "var(--destructive)" },
          }}
          bars={[
            { key: "delivered", stackId: "a" },
            { key: "failed", stackId: "a" },
          ]}
        />

        <MetricCard
          name="Responses"
          value={count(completed)}
          sub={count(abandoned)}
          rows={rows}
          axis={axis}
          config={{
            completed: { label: "Completed", color: "var(--primary)" },
            abandoned: { label: "Abandoned", color: "var(--warning)" },
          }}
          bars={[
            { key: "completed", stackId: "a" },
            { key: "abandoned", stackId: "a" },
          ]}
        />

        <MetricCard
          name="Completion rate"
          value={percent(completionRate, 0)}
          sub={`${count(live)} live`}
          rows={withRate}
          band
          axis={bandAxis(withRate.map((r) => r.rate), (v) => percent(v, 0))}
          config={{
            rate: {
              label: "Completion",
              color: "color-mix(in oklab, var(--primary) 75%, transparent)",
            },
          }}
          bars={[{ key: "rate" }]}
        />

        <MetricCard
          name="Average rating"
          // On the shared ramp, so this number means what it means everywhere else.
          value={rating.toFixed(1)}
          valueColor={ratingColor(rating, 10)}
          sub={`${count(held)} held`}
          rows={rows}
          band
          axis={bandAxis(rows.map((r) => r.rating), (v) => v.toFixed(1))}
          config={{ rating: { label: "Rating", color: "var(--primary)" } }}
          bars={[{ key: "rating" }]}
          colorBy={(row) => ratingColor(row.rating, 10)}
        />
      </div>
    </section>
  )
}

/* ==========================================================================
   The strip while the data is on its way (FR-71).

   Sized to the elements it stands in for — the same four-card grid, the same
   52px plot — so the real content lands into space already held and nothing
   below it moves.
   ========================================================================== */
export function ActivityStripSkeleton() {
  return (
    <section className="mb-5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5">
          <Skeleton className="h-7 w-[190px]" />
          <Skeleton className="h-7 w-[170px]" />
        </div>
        <Skeleton className="h-8 w-[130px]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="gap-0 py-0">
            <CardHeader className="flex border-0 px-4 pt-3.5 pb-0">
              <Skeleton className="h-3 w-[76px]" />
            </CardHeader>
            <CardContent className="px-4 pt-2 pb-3.5">
              <Skeleton className="h-6 w-[88px]" />
              <Skeleton className="mt-3 h-[52px] w-full" />
              <div className="mt-1.5 flex justify-between">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-2.5 w-10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
