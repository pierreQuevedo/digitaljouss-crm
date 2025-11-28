// components/dashboard/kpi-proposition-volume-card.tsx
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
import { TrendingUp, TrendingDown } from "lucide-react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type KpiVolumeRow = {
  nb_propositions: number | null;
  montant_total_ht: number | null;
  montant_moyen_ht: number | null;
};

type PeriodKey = "30" | "90" | "365";

function formatDate(date: Date): string {
  // YYYY-MM-DD pour la fonction SQL (argument type date)
  return date.toISOString().slice(0, 10);
}

export function KpiPropositionVolumeCard({
  className,
  refreshKey = 0,
}: {
  className?: string;
  // permet de forcer un refresh quand une proposition change
  refreshKey?: number;
}) {
  const supabase = createClient();
  const [data, setData] = useState<KpiVolumeRow | null>(null);
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

      const { data, error } = await supabase.rpc(
        "kpi_propositions_volume_montant_period",
        {
          p_start,
          p_end,
        },
      );

      if (error) {
        console.error(error);
        setData({
          nb_propositions: 0,
          montant_total_ht: 0,
          montant_moyen_ht: 0,
        });
      } else if (Array.isArray(data) && data.length > 0) {
        setData(data[0] as KpiVolumeRow);
      } else if (data && !Array.isArray(data)) {
        setData(data as KpiVolumeRow);
      } else {
        setData({
          nb_propositions: 0,
          montant_total_ht: 0,
          montant_moyen_ht: 0,
        });
      }

      setLoading(false);
    };

    fetchKpi();
  }, [supabase, period, refreshKey]);

  const nb = data?.nb_propositions ?? 0;
  const total = data?.montant_total_ht ?? 0;
  const average = data?.montant_moyen_ht ?? 0;

  const iconIsUp = nb >= 5; // critère totalement arbitraire, tu ajusteras

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">
            Volume de propositions
          </CardTitle>
          <CardDescription className="text-xs">
            Créées sur la période sélectionnée
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
            <span>{loading ? "…" : `${nb} proposition${nb > 1 ? "s" : ""}`}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Nombre de propositions */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold">
            {loading ? "…" : nb}
          </span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              propositions créées
            </span>
          )}
        </div>

        {/* Montants */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Montant total HT</span>
            <span className="text-base font-medium">
              {loading
                ? "…"
                : `${total.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} €`}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-muted-foreground">Montant moyen HT</span>
            <span className="text-base font-medium">
              {loading
                ? "…"
                : `${average.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} €`}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Basé sur les propositions actives dont la <code>created_at</code> est comprise
          entre <code>p_start</code> et <code>p_end + 1 jour</code>. Les montants
          prennent en compte uniquement la colonne <code>montant_ht</code>.
        </p>
      </CardContent>
    </Card>
  );
}