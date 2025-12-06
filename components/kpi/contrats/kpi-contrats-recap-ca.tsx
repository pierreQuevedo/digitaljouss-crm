// components/kpi/contrats/kpi-contrats-recap-ca.tsx
"use client";

import { useEffect, useState } from "react";
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
  montant_ttc: number | string | null;
};

type RecapCa = {
  totalHt: number;
  totalTtc: number;
  count: number;
  avgHt: number;
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

  // Strings YYYY-MM-DD pour les filtres Supabase
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

// Cast sécurisé pour les numeric Supabase
function toNumber(v: number | string | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* -------------------------------------------------------------------------- */
/*                                Composant                                   */
/* -------------------------------------------------------------------------- */

export function KpiContratsRecapCa({ className }: { className?: string }) {
  const [{ startStr, endStr, label }] = useState(() => getCurrentFiscalYear());
  const [recap, setRecap] = useState<RecapCa | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchRecap = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("contrats_with_paiements")
          .select(
            `
            id,
            statut,
            date_signature,
            montant_ht,
            montant_ttc
          `
          )
          .not("date_signature", "is", null)
          .gte("date_signature", startStr)
          .lte("date_signature", endStr)
          .in("statut", ["signe", "en_cours", "termine"] as StatutContrat[]);

        if (error) {
          console.error(error);
          toast.error("Erreur lors du chargement du CA contrats", {
            description: error.message,
          });
          setRecap(null);
          return;
        }

        const rows = (data ?? []) as ContratKpiRow[];

        if (!rows.length) {
          setRecap({
            totalHt: 0,
            totalTtc: 0,
            count: 0,
            avgHt: 0,
          });
          return;
        }

        const totalHt = rows.reduce(
          (sum, c) => sum + toNumber(c.montant_ht),
          0
        );
        const totalTtc = rows.reduce(
          (sum, c) => sum + toNumber(c.montant_ttc),
          0
        );
        const count = rows.length;
        const avgHt = count > 0 ? totalHt / count : 0;

        setRecap({
          totalHt,
          totalTtc,
          count,
          avgHt,
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchRecap();
  }, [startStr, endStr]);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Récap CA – année comptable
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Exercice du 1er juillet au 30 juin – {label}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        {loading || !recap ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="grid gap-3 text-sm md:grid-cols-3">
            {/* CA total HT */}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                CA signé HT
              </span>
              <span className="text-lg font-semibold">
                {formatEuro(recap.totalHt)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Contrats signés entre le {startStr} et le {endStr}
              </span>
            </div>

            {/* CA total TTC */}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                CA signé TTC
              </span>
              <span className="text-lg font-semibold">
                {formatEuro(recap.totalTtc)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Basé sur le montant TTC du contrat
              </span>
            </div>

            {/* Nombre & ticket moyen */}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                Contrats signés
              </span>
              <span className="text-lg font-semibold">
                {recap.count}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Ticket moyen :{" "}
                {recap.count > 0 ? formatEuro(recap.avgHt) : "—"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}