// components/kpi/contrats/kpi-contrats-ca-evolution.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { StatutContrat } from "@/lib/contrats-domain";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type ContratKpiRow = {
  id: string;
  statut: StatutContrat;
  date_signature: string | null;
  montant_ht: number | string | null;
};

type CaPoint = {
  monthKey: string; // ex: "2025-07"
  monthLabel: string; // ex: "juil. 2025"
  totalHt: number;
};

/* -------------------------------------------------------------------------- */
/*                            Helpers année comptable                         */
/* -------------------------------------------------------------------------- */

/**
 * Année comptable : 1er juillet -> 30 juin (N -> N+1)
 */
function getCurrentFiscalYear(today: Date = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0 = janvier, 6 = juillet

  let startYear: number;
  let endYear: number;

  // Si on est entre janvier et juin => on est dans l'exercice commencé le 1er juillet de l'année précédente
  if (month < 6) {
    startYear = year - 1;
    endYear = year;
  } else {
    // Si on est entre juillet et décembre => exercice commence cette année
    startYear = year;
    endYear = year + 1;
  }

  const start = new Date(startYear, 6, 1, 0, 0, 0); // 1er juillet
  const end = new Date(endYear, 5, 30, 23, 59, 59, 999); // 30 juin

  const label = `${startYear}–${endYear}`;

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  return { start, end, startStr, endStr, label };
}

function formatEuro(value: number): string {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function monthKeyFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 0-based
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return key;

  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
  }).format(d);
}

/* -------------------------------------------------------------------------- */
/*                          Config pour Chart Shadcn                          */
/* -------------------------------------------------------------------------- */

const chartConfig = {
  ca: {
    label: "CA signé HT",
    color: "hsl(var(--chart-1))",
  },
} satisfies Record<string, { label: string; color: string }>;

/* -------------------------------------------------------------------------- */
/*                                Composant                                   */
/* -------------------------------------------------------------------------- */

export function KpiContratsCaEvolution({
  className,
}: {
  className?: string;
}) {
  const [{ startStr, endStr, label }] = useState(() => getCurrentFiscalYear());
  const [data, setData] = useState<CaPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCa = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("contrats_with_paiements")
          .select(
            `
            id,
            statut,
            date_signature,
            montant_ht
          `
          )
          .not("date_signature", "is", null)
          .gte("date_signature", startStr)
          .lte("date_signature", endStr)
          .in("statut", ["signe", "en_cours", "termine"] as StatutContrat[]);

        if (error) {
          console.error(error);
          toast.error("Erreur lors du chargement de l’évolution du CA", {
            description: error.message,
          });
          setData([]);
          return;
        }

        const rows = (data ?? []) as ContratKpiRow[];

        // Agrégation par mois (sur montant_ht)
        const byMonth = new Map<string, number>();

        for (const row of rows) {
          const key = monthKeyFromDate(row.date_signature);
          if (!key) continue;

          const raw =
            row.montant_ht == null
              ? null
              : typeof row.montant_ht === "number"
              ? row.montant_ht
              : Number(row.montant_ht);

          const montantHt = Number.isFinite(raw) ? (raw as number) : 0;

          byMonth.set(key, (byMonth.get(key) ?? 0) + montantHt);
        }

        // On transforme en tableau ordonné par mois
        const points: CaPoint[] = Array.from(byMonth.entries())
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, totalHt]) => ({
            monthKey: key,
            monthLabel: monthLabelFromKey(key),
            totalHt,
          }));

        setData(points);
      } finally {
        setLoading(false);
      }
    };

    void fetchCa();
  }, [startStr, endStr]);

  const hasData = useMemo(() => data.length > 0, [data]);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Évolution du CA signé (HT)
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Par date de signature – exercice comptable {label}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="h-40 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : !hasData ? (
          <p className="text-xs text-muted-foreground">
            Aucun contrat signé sur la période comptable actuelle.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="h-56 w-full"
          >
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  `${(value as number).toLocaleString("fr-FR", {
                    maximumFractionDigits: 0,
                  })} €`
                }
                width={80}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `${label}`}
                    formatter={(value) =>
                      formatEuro(typeof value === "number" ? value : 0)
                    }
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="totalHt"
                name={chartConfig.ca.label}
                stroke={chartConfig.ca.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}