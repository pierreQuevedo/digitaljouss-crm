// lib/sitemap.ts
import type React from "react";
import {
  LayoutDashboard,
  Users,
  FolderTree,
  Receipt,
  Calendar,
  Settings,
  MessageCircle,
  BellRing
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
      label: "Propos & Contrats",
      href: "/dashboard/contrats",
      icon: FolderTree,
      children: [
        {
          label: "Proposition Commerciale",
          href: "/dashboard/contrats/proposition-commerciale",
        },
        {
          label: "Contrats Statégie Digitale",
          href: "/dashboard/contrats/strategie-digitale",
        },
        {
          label: "Contrats Direction Artistique",
          href: "/dashboard/contrats/direction-artistique",
        },
        {
          label: "Contrats Conception Web",
          href: "/dashboard/contrats/conception-web",
        },
        {
          label: "Contrats Social Media Management",
          href: "/dashboard/contrats/social-media-management",
        },
      ],
    },
    {
      label: "Facturation",
      href: "/dashboard/facturation",
      icon: Receipt,
    },
    {
      label: "Relance",
      href: "/dashboard/relance",
      icon: BellRing,
    },

  ],

  // Bloc secondaire (en bas : notifications / settings)
  secondary: [
    {
      label: "Feedback",
      href: "/dashboard/feedback",
      icon: MessageCircle,
    },
    {
      label: "Agenda (soon)",
      href: "#",
      icon: Calendar,
    },
    // {
    //   label: "Agenda",
    //   href: "/dashboard/agenda",
    //   icon: Calendar,
    // },
    {
      label: "Réglages Agence",
      href: "/dashboard/reglages-agence",
      icon: Settings,
    },
  ]
};
