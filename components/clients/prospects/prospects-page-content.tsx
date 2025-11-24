"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ProspectsTable } from "@/components/clients/prospects/prospects-table";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { Button } from "@/components/ui/button";

export function ProspectsPageContent() {
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
      query
        ? `/dashboard/clients/prospects?${query}`
        : "/dashboard/clients/prospects",
      { scroll: false },
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Prospects</h1>

        <ClientFormDialog
          open={openAdd}
          onOpenChange={handleOpenChange}
          defaultStatut="prospect"
        >
          <Button type="button" size="sm">
            Ajouter un prospect
          </Button>
        </ClientFormDialog>
      </div>

      <ProspectsTable />
    </div>
  );
}