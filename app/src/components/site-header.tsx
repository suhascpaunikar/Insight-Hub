import { BuildingIcon, ChevronDownIcon, LayersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

/* ==========================================================================
   The context bar (FR-59).

   Which workspace, which app, which environment — the three questions a
   console has to answer before any number on the page means anything. The
   environment is a badge rather than a menu item: reading it wrong is the
   expensive mistake, so it is the one thing here that carries colour.
   ========================================================================== */

const WORKSPACES = ["QuickEats India", "QuickEats UAE", "QuickEats Sandbox"]
const APPS = ["InsightHub", "Engage", "CPaaS", "CDP"]

function Switcher({
  icon: Icon,
  label,
  value,
  options,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  options: string[]
  onSelect: (value: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 min-w-0 gap-1.5 px-2 font-normal"
        >
          <Icon className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground hidden lg:inline">{label}</span>
          <span className="text-foreground truncate">{value}</span>
          <ChevronDownIcon className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => onSelect(option)}>
            {option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader({
  workspace,
  environment,
  onWorkspaceChange,
  onEnvironmentChange,
}: {
  workspace: string
  environment: string
  onWorkspaceChange: (value: string) => void
  onEnvironmentChange: (value: string) => void
}) {
  return (
    <header className="bg-card sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b px-3">
      <SidebarTrigger className="size-7 shrink-0" />
      <Separator orientation="vertical" className="mx-1 !h-4" />

      {/* The three questions a console answers before any number means
          anything. On a narrow viewport the app switcher goes first: this
          prototype only ships one app, so it is the least load-bearing of them. */}
      <div className="flex min-w-0 items-center gap-1">
        <Switcher
          icon={BuildingIcon}
          label="Workspace"
          value={workspace}
          options={WORKSPACES}
          onSelect={onWorkspaceChange}
        />
        <Separator orientation="vertical" className="mx-1 !h-4 hidden sm:block" />
        <div className="hidden sm:block">
          <Switcher
            icon={LayersIcon}
            label="App"
            value="InsightHub"
            options={APPS}
            onSelect={() => {}}
          />
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
              aria-label={`Environment: ${environment}`}
            >
              <Badge
                variant="outline"
                className={
                  environment === "Production"
                    ? "border-primary/35 bg-primary/10 text-primary h-6 gap-1.5 rounded-full px-2.5 font-mono text-[10px] tracking-wide uppercase"
                    : "border-warning/35 bg-warning/10 text-warning h-6 gap-1.5 rounded-full px-2.5 font-mono text-[10px] tracking-wide uppercase"
                }
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-current"
                />
                {environment}
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Environment</DropdownMenuLabel>
            {["Production", "Staging"].map((env) => (
              <DropdownMenuItem key={env} onSelect={() => onEnvironmentChange(env)}>
                {env}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span
          aria-hidden
          className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-full text-[11px] font-medium"
        >
          SP
        </span>
      </div>
    </header>
  )
}
