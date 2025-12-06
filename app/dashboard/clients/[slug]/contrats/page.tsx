// app/dashboard/clients/[slug]/contrats/page.tsx
"use client";

import { TabsContent } from "@/components/ui/tabs";
import { useClient } from "../client-context";
import {
  ContratsTable,
  type ContratRow,
  ContratRowActions,
} from "@/components/contrats-propos/contrats-table";

export default function ClientContratsPage() {
  const client = useClient();

  return (
    <TabsContent value="contrats" className="mt-4">
      <ContratsTable
        clientId={client.id}
        renderRowActions={(contrat: ContratRow) => (
          <ContratRowActions contrat={contrat} />
        )}
      />
    </TabsContent>
  );
}
