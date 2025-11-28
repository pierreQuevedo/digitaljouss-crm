// components/propositions-commerciale/propositions-page-content.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  PropositionsTable,
  type StatutFilter,
  type EtatFilter,
} from "@/components/contrats-propos/propositions-commerciale/propositions-table";
import { PropositionFormDialog } from "@/components/contrats-propos/propositions-commerciale/proposition-form-dialog";
import { KpiPropositionAcceptVsRefuseCard } from "@/components/kpi/prospection-commerciale/kpi-proposition-accept-vs-refuse-card";
import { KpiPropositionVolumeCard } from "@/components/kpi/prospection-commerciale/kpi-proposition-volume-card";
import {
  KpiPropositionPipelineCard,
} from "@/components/kpi/prospection-commerciale/kpi-proposition-pipeline-card";
import { Button } from "@/components/ui/button";

// ⚠️ type pour ce que renvoie le KPI
type PipelineKpiStatut = "a_faire" | "envoyee" | "en_attente_retour" | "all";

export function PropositionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const openAdd = searchParams.get("add") === "1";

  const [refreshKpiKey, setRefreshKpiKey] = useState(0);

  // 👉 filtres centralisés dans la page
  const [etatFilter, setEtatFilter] = useState<EtatFilter>("active");
  const [statutFilter, setStatutFilter] = useState<StatutFilter>("all");

  const handleOpenChange = (open: boolean) => {
    const sp = new URLSearchParams(searchParams.toString());

    if (open) {
      sp.set("add", "1");
    } else {
      sp.delete("add");
    }

    const query = sp.toString();
    router.replace(
      query
        ? `/dashboard/contrats/proposition-commerciale?${query}`
        : "/dashboard/contrats/proposition-commerciale",
      { scroll: false },
    );
  };

  const handlePropositionChanged = () => {
    setRefreshKpiKey((prev) => prev + 1);
  };

  // 👇 callback appelé par le KPI quand on clique sur une card
  const handleSelectFromKpi = (statutFromKpi: PipelineKpiStatut) => {
    // le KPI représente uniquement les propositions actives
    setEtatFilter("active");

    if (statutFromKpi === "all") {
      setStatutFilter("all");
      return;
    }

    if (statutFromKpi === "en_attente_retour") {
      // il n'y a pas de statut DB "en_attente_retour" dans la table,
      // on mappe sur "envoyee" (à adapter si tu as une vraie colonne)
      setStatutFilter("envoyee");
      return;
    }

    // "a_faire" ou "envoyee"
    setStatutFilter(statutFromKpi);
  };

  // si tu veux que le KPI se "dé-sélectionne" quand on change le filtre manuellement,
  // tu peux dériver un selectedStatut pour lui (optionnel)
  const pipelineSelectedForKpi: PipelineKpiStatut =
    etatFilter !== "active"
      ? "all"
      : statutFilter === "a_faire" ||
        statutFilter === "envoyee"
        ? statutFilter
        : "all";

  return (
    <div className="space-y-4 p-4">
      {/* KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiPropositionVolumeCard refreshKey={refreshKpiKey} />

        <KpiPropositionPipelineCard
          refreshKey={refreshKpiKey}
          // si ton composant KPI accepte ces props :
          selectedStatut={pipelineSelectedForKpi}
          onSelectStatut={handleSelectFromKpi}
        />

        <KpiPropositionAcceptVsRefuseCard refreshKey={refreshKpiKey} />
      </div>

      {/* Header + bouton d'ajout */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Propositions</h1>

        <PropositionFormDialog
          open={openAdd}
          onOpenChange={handleOpenChange}
          onCreated={handlePropositionChanged}
        >
          <Button type="button" size="sm">
            Ajouter une proposition
          </Button>
        </PropositionFormDialog>
      </div>

      {/* Table des propositions */}
      <PropositionsTable
        onAnyChange={handlePropositionChanged}
        etatFilter={etatFilter}
        onEtatFilterChange={setEtatFilter}
        statutFilter={statutFilter}
        onStatutFilterChange={setStatutFilter}
      />
    </div>
  );
}