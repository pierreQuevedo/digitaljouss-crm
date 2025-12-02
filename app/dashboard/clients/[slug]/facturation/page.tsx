// app/dashboard/clients/[slug]/facturation/page.tsx
"use client";

import { TabsContent } from "@/components/ui/tabs";
import { useClient } from "../client-context";
import { ClientFacturationTab } from "@/components/facturation/client-facturation-tab";

export default function ClientFacturationPage() {
  const client = useClient();

  return (
    <TabsContent value="facturation" className="mt-4">
      <ClientFacturationTab clientId={client.id} />
    </TabsContent>
  );
}