// components/dashboard/kpi-proposition-acceptance-card.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type KpiPropositionRow = {
  nb_propositions: number;
  nb_propositions_acceptees: number;
  taux_acceptation: number; // déjà calculé côté SQL en %
};

export function KpiPropositionAcceptanceCard({
  className,
}: {
  className?: string;
}) {
  const supabase = createClient();
  const [data, setData] = useState<KpiPropositionRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchKpi = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("kpi_propositions_globales")
        .select("*")
        .maybeSingle();

      console.log("KPI propositions globales :", { data, error });

      if (error) {
        console.error(error);
      } else {
        setData(data as KpiPropositionRow);
      }
      setLoading(false);
    };

    fetchKpi();
  }, [supabase]);

  const total = data?.nb_propositions ?? 0;
  const accepted = data?.nb_propositions_acceptees ?? 0;

  // si aucune proposition, on force 0 pour éviter les NaN / affichages bizarres
  const taux = total > 0 ? data?.taux_acceptation ?? 0 : 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2",
        className,
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">
        Taux de propositions acceptées
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {loading
            ? "…"
            : total === 0
              ? "0 %"
              : `${taux.toFixed(1)} %`}
        </span>

        {!loading && (
          <span className="text-xs text-muted-foreground">
            {accepted} / {total} propositions
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Basé uniquement sur les clients dont le{" "}
        <code>statut_proposition</code> est <code>propo_acceptee</code> ou{" "}
        <code>propo_refusee</code>.
      </p>
    </div>
  );
}