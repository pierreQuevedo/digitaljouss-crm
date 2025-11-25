// components/dashboard/kpi-proposition-pipeline-card.tsx
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

type StatutProposition =
  | "a_faire"
  | "envoyee"
  | "en_attente_retour"
  | "acceptee"
  | "refusee";

type PipelineRow = {
  statut: StatutProposition;
  nb: number | null;
  montant_total_ht: number | null;
};

type KpiPropositionPipelineCardProps = {
  className?: string;
  /** Permet de forcer un refetch quand quelque chose change (statut, création…) */
  refreshKey?: number;
};

const STATUT_LABEL: Record<StatutProposition, string> = {
  a_faire: "À faire",
  envoyee: "Envoyée",
  en_attente_retour: "En attente de retour",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

// ordre d’affichage voulu pour le pipeline
const PIPELINE_ORDER: StatutProposition[] = [
  "a_faire",
  "envoyee",
  "en_attente_retour",
];

export function KpiPropositionPipelineCard({
  className,
  refreshKey = 0,
}: KpiPropositionPipelineCardProps) {
  const supabase = createClient();
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchKpi = async () => {
      setLoading(true);

      const { data, error } = await supabase.rpc(
        "kpi_propositions_pipeline_actives",
      );

      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      if (Array.isArray(data)) {
        setRows(data as PipelineRow[]);
      } else if (data) {
        setRows([data as PipelineRow]);
      } else {
        setRows([]);
      }

      setLoading(false);
    };

    fetchKpi();
  }, [supabase, refreshKey]);

  const totalCount =
    rows.reduce((sum, r) => sum + (r.nb ?? 0), 0) || 0;

  const totalAmount =
    rows.reduce(
      (sum, r) => sum + (Number(r.montant_total_ht ?? 0) || 0),
      0,
    ) || 0;

  const formatAmount = (value: number) =>
    value.toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const sortedRows = PIPELINE_ORDER
    .map((statut) => rows.find((r) => r.statut === statut))
    .filter((r): r is PipelineRow => Boolean(r));

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-medium">
          Pipeline propositions actives
        </CardTitle>
        <CardDescription className="text-xs">
          Répartition par statut (uniquement les propositions actives)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Résumé global */}
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold">
            {loading ? "…" : totalCount}
          </div>
          <div className="text-xs text-muted-foreground">
            propositions actives, {loading ? "…" : `${formatAmount(totalAmount)} € HT`}
          </div>
        </div>

        {/* Liste par statut */}
        <div className="space-y-2">
          {loading && (
            <p className="text-xs text-muted-foreground">
              Chargement du pipeline…
            </p>
          )}

          {!loading && sortedRows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aucune proposition active pour le moment.
            </p>
          )}

          {!loading &&
            sortedRows.map((row) => {
              const count = row.nb ?? 0;
              const amount = Number(row.montant_total_ht ?? 0) || 0;
              const pct =
                totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

              return (
                <div
                  key={row.statut}
                  className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">
                      {STATUT_LABEL[row.statut]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {count} prop. • {formatAmount(amount)} € HT
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {pct} %
                  </span>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}