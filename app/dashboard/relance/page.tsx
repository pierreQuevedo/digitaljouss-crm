// app/dashboard/relance/page.tsx
import RelanceKpiContent from "@/components/kpi/relance/relance-kpi-content";
import { RelanceTable } from "@/components/relance/relance-table";

export default function RelancePage() {
  return (
    <div className="space-y-4 p-4">
      {/* Bloc KPI délai 1er paiement */}
      <RelanceKpiContent />

      {/* Tableau des relances */}
      <h1 className="text-xl font-semibold">Tableau des Relances</h1>
      <RelanceTable />
    </div>
  );
}