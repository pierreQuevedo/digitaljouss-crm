// app/dashboard/layout.tsx
import type { ReactNode } from "react"
import { DashboardSidebar } from "@/components/nav/dashboard-sidebar"
import { DashboardBreadcrumb } from "@/components/nav/dashboard-breadcrumb"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

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
          <AnimatedThemeToggler />
        </header>
        {children}
      </main>
    </div>
  )
}