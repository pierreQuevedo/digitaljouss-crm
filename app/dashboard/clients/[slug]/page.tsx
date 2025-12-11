// app/dashboard/clients/[slug]/page.tsx
"use client";

import { useEffect } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { useClient } from "./client-context";
import { ClientDetailsForm } from "@/components/clients/(slug)/client_details_form";

export default function ClientDetailsPage() {
  const client = useClient();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return (
    <TabsContent value="details" className="mt-4">
      <ClientDetailsForm client={client} />
    </TabsContent>
  );
}