"use client";

import { ContratsTable } from "@/components/contrats-propos/contrats-table";

export function ContratsPageContent() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contrats</h1>
        {/* Tu pourras mettre un bouton "Créer un contrat" plus tard si tu veux */}
      </div>

      <ContratsTable />
    </div>
  );
}