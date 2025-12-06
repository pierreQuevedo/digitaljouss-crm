// app/dashboard/contrats/page.tsx

"use client";

import {
  ContratsTable,
  type ContratRow,
  ContratRowActions,
} from "@/components/contrats-propos/contrats-table";
import { KpiContratsRecapCa } from "@/components/kpi/contrats/kpi-contrats-recap-ca";
import { KpiContratsEnAttente } from "@/components/kpi/contrats/kpi-contrats-en-attente";
import { KpiContratsCaEvolution } from "@/components/kpi/contrats/kpi-contrats-ca-evolution";


export default function ContratsPage() {
  return (
    <div className="space-y-4 p-4">
      {/* Kpi */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiContratsRecapCa />
        <KpiContratsEnAttente />
        <KpiContratsCaEvolution />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contrats</h1>
      </div>

      {/* Table des contrats */}
      <ContratsTable
        statutIn={[
          "brouillon",
          "en_attente_signature",
          "signe",
          "en_cours",
          "termine",
          "annule",
        ]}
        renderRowActions={(contrat: ContratRow) => (
          <ContratRowActions contrat={contrat} />
        )}
      />
    </div>
  );
}