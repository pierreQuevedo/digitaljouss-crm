// // components/propositions-commerciale/propositions-page-content.tsx
// "use client";

// import { useSearchParams, useRouter } from "next/navigation";
// import { PropositionsTable } from "@/components/propositions-commerciale/propositions-table";
// import { PropositionFormDialog } from "@/components/propositions-commerciale/proposition-form-dialog";
// import { Button } from "@/components/ui/button";
// import { KpiPropositionAcceptVsRefuseCard } from "@/components/kpi/prospection-commerciale/kpi-proposition-accept-vs-refuse-card";

// export function PropositionsPageContent() {
//   const searchParams = useSearchParams();
//   const router = useRouter();

//   const openAdd = searchParams.get("add") === "1";

//   const handleOpenChange = (open: boolean) => {
//     const sp = new URLSearchParams(searchParams.toString());

//     if (open) {
//       sp.set("add", "1");
//     } else {
//       sp.delete("add");
//     }

//     const query = sp.toString();
//     router.replace(
//       query ? `/dashboard/contrats/proposition-commerciale?${query}` : "/dashboard/contrats/proposition-commerciale",
//       { scroll: false },
//     );
//   };

//   return (
//     <div className="space-y-4 p-4">
//         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
//       <KpiPropositionAcceptVsRefuseCard />
//       {/* autres cards… */}
//     </div>
//       <div className="flex items-center justify-between">
//         <h1 className="text-xl font-semibold">Propositions</h1>

//         <PropositionFormDialog open={openAdd} onOpenChange={handleOpenChange}>
//           <Button type="button" size="sm">
//             Ajouter une proposition
//           </Button>
//         </PropositionFormDialog>
//       </div>

//       <PropositionsTable />
//     </div>
//   );
// }

// components/propositions-commerciale/propositions-page-content.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PropositionsTable } from "@/components/propositions-commerciale/propositions-table";
import { PropositionFormDialog } from "@/components/propositions-commerciale/proposition-form-dialog";
import { KpiPropositionAcceptVsRefuseCard } from "@/components/kpi/prospection-commerciale/kpi-proposition-accept-vs-refuse-card";
import { Button } from "@/components/ui/button";

export function PropositionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const openAdd = searchParams.get("add") === "1";

  // 👇 compteur pour forcer le refresh des KPI
  const [refreshKpiKey, setRefreshKpiKey] = useState(0);

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
      { scroll: false }
    );
  };

  // 👉 appelé dès qu'une proposition change (statut, ajout, delete…)
  const handlePropositionChanged = () => {
    setRefreshKpiKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiPropositionAcceptVsRefuseCard refreshKey={refreshKpiKey}/>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Propositions</h1>

        <PropositionFormDialog
          open={openAdd}
          onOpenChange={handleOpenChange}
          // 🔥 optionnel : quand une prop est créée, on rafraîchit aussi
          onCreated={handlePropositionChanged}
        >
          <Button type="button" size="sm">
            Ajouter une proposition
          </Button>
        </PropositionFormDialog>
      </div>

      {/* Table des propositions */}
      <PropositionsTable onAnyChange={handlePropositionChanged} />
    </div>
  );
}
