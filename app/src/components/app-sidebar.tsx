import {
  BotIcon,
  ChartNoAxesColumnIcon,
  DatabaseIcon,
  LayoutTemplateIcon,
  MegaphoneIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

/* ==========================================================================
   The console's primary navigation (FR-58 … FR-62).

   The same three groups the other pages render, on shadcn's sidebar: what you
   are looking at, what you build it from, and what sits outside the campaign
   lifecycle. Collapsing is the component's own — it keeps the icon rail and
   puts each label in a tooltip, which is what the hand-rolled rail did.
   ========================================================================== */

type NavItem = {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  disabled?: boolean
  /** The one badged entry that does something: it opens the companion card. */
  action?: "assistant"
}

const NAV_GROUPS: NavItem[][] = [
  [
    { title: "Campaigns", href: "index.html", icon: MegaphoneIcon },
    { title: "Insights", href: "insights.html", icon: ChartNoAxesColumnIcon },
  ],
  [
    { title: "Segments", href: "#", icon: UsersIcon, disabled: true },
    { title: "Templates", href: "#", icon: LayoutTemplateIcon, disabled: true },
    { title: "User data table", href: "#", icon: DatabaseIcon, disabled: true },
  ],
  [
    // FR-60 — a limited-release badge in the AI accent, never mistakable for a metric.
    { title: "AI themes", href: "#", icon: SparklesIcon, badge: "BETA", disabled: true },
    { title: "Assistant", href: "#", icon: BotIcon, badge: "BETA", action: "assistant" },
    { title: "Settings", href: "settings.html", icon: SettingsIcon },
  ],
]

export function AppSidebar({
  active,
  onOpenAssistant,
}: {
  active: string
  onOpenAssistant: () => void
}) {
  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-12 justify-center border-b px-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-tight"
          >
            IH
          </span>
          <span className="text-foreground truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            InsightHub
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, i) => (
          <SidebarGroup key={i} className="py-1">
            <SidebarGroupContent>
              <SidebarMenu>
                {group.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.title.toLowerCase() === active}
                      tooltip={item.title}
                      // A dead nav entry is dimmed and inert rather than hidden:
                      // the shape of the product is part of what the prototype shows.
                      className={item.disabled ? "opacity-55" : undefined}
                    >
                      <a
                        href={item.href}
                        onClick={
                          item.action === "assistant"
                            ? (event) => {
                                event.preventDefault()
                                onOpenAssistant()
                              }
                            : undefined
                        }
                        aria-disabled={item.disabled || undefined}
                        aria-current={
                          item.title.toLowerCase() === active ? "page" : undefined
                        }
                      >
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                        {item.badge ? (
                          <Badge
                            variant="outline"
                            className="text-ai border-ai/35 bg-ai/10 ml-auto h-4 rounded px-1 font-mono text-[9px] tracking-wide"
                          >
                            {item.badge}
                          </Badge>
                        ) : null}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
