// components/clients/clients-page-content.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ClientsTable } from "@/components/clients/clients-table";
// adapte ce nom au composant réel de ton formulaire
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { Button } from "@/components/ui/button";

export function ClientsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const openAdd = searchParams.get("add") === "1";

  const handleOpenChange = (open: boolean) => {
    const sp = new URLSearchParams(searchParams.toString());

    if (open) {
      sp.set("add", "1");
    } else {
      sp.delete("add");
    }

    const query = sp.toString();
    router.replace(
      query ? `/dashboard/clients?${query}` : "/dashboard/clients",
      { scroll: false },
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>

        {/* bouton "Ajouter un client" si tu en veux un sur la page */}
        <ClientFormDialog open={openAdd} onOpenChange={handleOpenChange}>
          <Button type="button" size="sm">
            Ajouter un client
          </Button>
        </ClientFormDialog>
      </div>

      <ClientsTable initialStatut="client" />
    </div>
  );
}