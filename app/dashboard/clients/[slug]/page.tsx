// app/dashboard/clients/[slug]/page.tsx
"use client";

import { TabsContent } from "@/components/ui/tabs";
import { useClient } from "./client-context";
import { ClientDetailsForm } from "@/components/clients/(slug)/client_details_form";
// mets ton form ici (celui avec logo preview, etc.)

export default function ClientDetailsPage() {
  const client = useClient();

  return (
    <TabsContent value="details" className="mt-4">
      <ClientDetailsForm client={client} />
    </TabsContent>
  );
}