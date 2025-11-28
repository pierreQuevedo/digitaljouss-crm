// components/kpi/prospection-commerciale/kpi-proposition-pipeline-card.tsx
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

// 👉 ce que le KPI remonte au parent (et que la page mappe vers la table)
export type PipelineSelectStatut =
  | "a_faire"
  | "envoyee"
  | "en_attente_retour"
  | "all";

type KpiPropositionPipelineCardProps = {
  className?: string;
  refreshKey?: number;
  /** statut actuellement sélectionné (pour highlight + réutilisation) */
  selectedStatut?: PipelineSelectStatut;
  /** callback quand on clique sur une carte */
  onSelectStatut?: (statut: PipelineSelectStatut) => void;
};

const STATUT_LABEL: Record<StatutProposition, string> = {
  a_faire: "À faire",
  envoyee: "Envoyée",
  en_attente_retour: "En attente de retour",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

// ordre d’affichage = uniquement le pipeline actif
const PIPELINE_ORDER: StatutProposition[] = [
  "a_faire",
  "envoyee",
  "en_attente_retour",
];

export function KpiPropositionPipelineCard({
  className,
  refreshKey = 0,
  selectedStatut,
  onSelectStatut,
}: KpiPropositionPipelineCardProps) {
  const supabase = createClient();
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(false);

  // fallback interne si le parent ne contrôle pas selectedStatut
  const [internalSelected, setInternalSelected] =
    useState<PipelineSelectStatut>("all");

  const effectiveSelected = selectedStatut ?? internalSelected;

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

  // -----------------------------
  // Gestion du clic sur une card
  // -----------------------------
  const handleClickRow = (rowStatut: StatutProposition) => {
    // on mappe le statut DB vers notre filtre "logique" pour le parent
    const mapped: PipelineSelectStatut =
      rowStatut === "a_faire" ||
      rowStatut === "envoyee" ||
      rowStatut === "en_attente_retour"
        ? rowStatut
        : "all";

    // toggle : si déjà sélectionné -> repasse à "all"
    const next: PipelineSelectStatut =
      effectiveSelected === mapped ? "all" : mapped;

    if (selectedStatut === undefined) {
      // mode non contrôlé : on garde un state interne
      setInternalSelected(next);
    }

    onSelectStatut?.(next);
  };

  const handleReset = () => {
    if (selectedStatut === undefined) {
      setInternalSelected("all");
    }
    onSelectStatut?.("all");
  };

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium">
              Pipeline propositions actives
            </CardTitle>
            <CardDescription className="text-xs">
              Répartition par statut (uniquement les propositions actives)
            </CardDescription>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] transition-colors",
              effectiveSelected === "all"
                ? "border-transparent text-muted-foreground"
                : "border-border hover:bg-muted/60",
            )}
          >
            Réinitialiser
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Résumé global */}
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold">
            {loading ? "…" : totalCount}
          </div>
          <div className="text-xs text-muted-foreground">
            propositions actives,{" "}
            {loading ? "…" : `${formatAmount(totalAmount)} € HT`}
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

              const isSelected = effectiveSelected === row.statut;

              return (
                <button
                  key={row.statut}
                  type="button"
                  onClick={() => handleClickRow(row.statut)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors",
                    "bg-muted/40 hover:bg-muted/70",
                    isSelected &&
                      "border-primary/60 bg-primary/5 ring-1 ring-primary/40",
                  )}
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
                </button>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}