// app/dashboard/layout.tsx
import type { ReactNode } from "react"
import { DashboardSidebar } from "@/components/nav/dashboard-sidebar"
import { DashboardBreadcrumb } from "@/components/nav/dashboard-breadcrumb"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { GlobalCommandPalette } from "@/components/nav/global-command-palette"

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh">
      <DashboardSidebar />

      <main className="flex min-h-svh flex-1 flex-col bg-background">
        <header className="flex h-16 items-center border-b px-4 justify-between">
          <DashboardBreadcrumb />
          <div className="flex items-center gap-4">
            <GlobalCommandPalette />
            <AnimatedThemeToggler />
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}