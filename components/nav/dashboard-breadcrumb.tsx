"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { sitemap } from "@/lib/sitemap";

type Crumb = {
  label: string;
  href?: string;
};

export function DashboardBreadcrumb() {
  const pathname = usePathname();

  const path = pathname || "/dashboard";

  const crumbs: Crumb[] = [];

  // Toujours la racine Dashboard
  const dashboardItem = sitemap.main.find((item) => item.href === "/dashboard");
  crumbs.push({
    label: dashboardItem?.label ?? "Dashboard",
    href: "/dashboard",
  });

  if (path !== "/dashboard") {
    const section = sitemap.main.find((item) =>
      path.startsWith(item.href) && item.href !== "/dashboard" ? true : false
    );

    if (section) {
      crumbs.push({
        label: section.label,
        href: section.href,
      });

      const child = section.children?.find((child) =>
        path.startsWith(child.href)
      );

      if (child && child.href !== section.href) {
        crumbs.push({
          label: child.label,
          href: child.href,
        });
      } else {
        const parts = path.split("/").filter(Boolean); // ["dashboard", "clients", "123"]
        if (parts.length > 2) {
          const last = decodeURIComponent(parts[parts.length - 1]);
          crumbs.push({
            label: last.charAt(0).toUpperCase() + last.slice(1),
          });
        }
      }
    }
  }

  const lastIndex = crumbs.length - 1;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === lastIndex;

          return (
            <React.Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem
                className={index === 0 ? "hidden md:block" : undefined}
              >
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href ?? "#"}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {/* IMPORTANT : Separator est un <li> SÉPARÉ, pas enfant */}
              {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
