// app/dashboard/clients/[slug]/propositions/page.tsx
"use client";

import { TabsContent } from "@/components/ui/tabs";
import { useClient } from "../client-context";
import { PropositionsTable } from "@/components/contrats-propos/propositions-commerciale/propositions-table";

export default function ClientPropositionsPage() {
  const client = useClient();

  return (
    <TabsContent value="propositions" className="mt-4">
      <PropositionsTable clientId={client.id} />
    </TabsContent>
  );
}