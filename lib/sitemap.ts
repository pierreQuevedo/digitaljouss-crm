// lib/sitemap.ts
import type React from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  Settings,
  FolderTree,
  Receipt,
  Bell,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children?: NavItem[];
};

export const sitemap: { main: NavItem[]; secondary: NavItem[] } = {
  // Menu principal de la sidebar
  main: [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Clients",
      href: "/dashboard/clients",
      icon: Users,
      children: [
        { label: "Tous les clients", href: "/dashboard/clients" },
        { label: "Prospects", href: "/dashboard/clients/prospects" },
        { label: "Ajouter un client", href: "/dashboard/clients?add=1" },
      ],
    },
    {
      label: "Contrats & Projets",
      href: "/dashboard/contrats",
      icon: FolderTree,
      children: [
        {
          label: "Contrats Réseaux sociaux",
          href: "/dashboard/contrats/rs",
        },
        {
          label: "SEO / SEA / Maintenance",
          href: "/dashboard/contrats/ref",
        },
        {
          label: "Sites internet",
          href: "/dashboard/projets/sites",
        },
      ],
    },
    {
      label: "Facturation",
      href: "/dashboard/facturation",
      icon: Receipt,
    },
    {
      label: "KPI & Reporting",
      href: "/dashboard/kpi",
      icon: BarChart2,
    },
    {
      label: "Exports",
      href: "/dashboard/exports",
      icon: FileText,
    },
  ],

  // Bloc secondaire (en bas : notifications / settings)
  secondary: [
    {
      label: "Notifications",
      href: "/dashboard/notifications",
      icon: Bell,
    },
    {
      label: "Paramètres",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ],
};
