// components/dashboard/kpi-proposition-accept-vs-refuse-card.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown } from "lucide-react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type KpiPropositionRow = {
  nb_propositions: number | null;
  nb_propositions_acceptees: number | null;
  taux_acceptation: number | null;
};

type PeriodKey = "30" | "90" | "365";

// ✅ helper pour envoyer un DATE (YYYY-MM-DD) à la fonction SQL
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function KpiPropositionAcceptVsRefuseCard({
  className,
  refreshKey = 0, // 👈 pour forcer le refresh depuis l’extérieur
}: {
  className?: string;
  refreshKey?: number;
}) {
  const supabase = createClient();
  const [data, setData] = useState<KpiPropositionRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("30");

  useEffect(() => {
    const fetchKpi = async () => {
      setLoading(true);

      const end = new Date();
      const start = new Date();

      if (period === "30") {
        start.setDate(end.getDate() - 30);
      } else if (period === "90") {
        start.setDate(end.getDate() - 90);
      } else if (period === "365") {
        start.setDate(end.getDate() - 365);
      }

      const p_start = formatDate(start);
      const p_end = formatDate(end);

      console.log("[KPI] Appel RPC kpi_propositions_globales_period avec :", {
        period,
        p_start,
        p_end,
      });

      const { data, error } = await supabase.rpc(
        "kpi_propositions_globales_period",
        {
          p_start,
          p_end,
        },
      );

      console.log("[KPI] Résultat RPC :", { data, error });

      if (error) {
        console.error(error);
        setData({
          nb_propositions: 0,
          nb_propositions_acceptees: 0,
          taux_acceptation: 0,
        });
      } else if (Array.isArray(data) && data.length > 0) {
        setData(data[0] as KpiPropositionRow);
      } else if (data && !Array.isArray(data)) {
        setData(data as KpiPropositionRow);
      } else {
        setData({
          nb_propositions: 0,
          nb_propositions_acceptees: 0,
          taux_acceptation: 0,
        });
      }

      setLoading(false);
    };

    fetchKpi();
    // ✅ refresh quand période change ou quand refreshKey change
  }, [supabase, period, refreshKey]);

  const total = data?.nb_propositions ?? 0;
  const accepted = data?.nb_propositions_acceptees ?? 0;
  const refused = Math.max(total - accepted, 0);
  const taux = data?.taux_acceptation ?? 0;

  const iconIsUp = taux >= 50;

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">
            Taux de propositions acceptées
          </CardTitle>
          <CardDescription className="text-xs">
            Acceptées vs refusées sur la période
          </CardDescription>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as PeriodKey)}
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
              <SelectItem value="365">12 derniers mois</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {iconIsUp ? (
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{loading ? "…" : `${taux.toFixed(1)} %`}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold">
            {loading ? "…" : `${taux.toFixed(1)} %`}
          </span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {accepted} acceptées / {refused} refusées
            </span>
          )}
        </div>

        <Progress value={loading ? 0 : taux} className="h-2" />

        <p className="text-xs text-muted-foreground">
          Calculé comme{" "}
          <code>acceptées / (acceptées + refusées)</code>, uniquement sur les
          propositions dont le statut est <code>acceptee</code> ou{" "}
          <code>refusee</code>, et dont la <code>created_at</code> est comprise
          entre <code>p_start</code> et <code>p_end + 1 jour</code>.
        </p>
      </CardContent>
    </Card>
  );
}