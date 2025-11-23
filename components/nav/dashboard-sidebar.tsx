// components/layout/dashboard-sidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Bot, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { sitemap } from "@/lib/sitemap"

export function DashboardSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 border-r bg-muted/40 transition-[width] duration-300 ease-in-out lg:flex lg:flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Bouton de toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow hover:bg-accent hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* En-tête */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Acme Inc</span>
            <span className="text-xs text-muted-foreground">Enterprise</span>
          </div>
        )}
      </div>

      {/* Nav principale */}
      <nav className="mt-2 space-y-1 px-2 pb-4">
        {sitemap.main.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href ||
            item.children?.some((child) => pathname.startsWith(child.href))

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-background text-foreground shadow-sm",
                  collapsed && "justify-center px-2"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {!collapsed && <span>{item.label}</span>}
              </Link>

              {/* Sous-liens (si non collapsed) */}
              {!collapsed && item.children && (
                <div className="mt-1 ml-8 space-y-1">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block text-sm text-muted-foreground hover:text-foreground",
                          childActive && "font-medium text-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Nav secondaire en bas */}
      {!collapsed && sitemap.secondary.length > 0 && (
        <nav className="mt-auto space-y-1 border-t px-2 py-3">
          {sitemap.secondary.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-background text-foreground shadow-sm"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </aside>
  )
}