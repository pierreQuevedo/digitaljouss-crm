"use client"

import * as React from "react";
import { ClientAddSheet } from "@/components/clients/client-add-sheet";
import { ClientsTable } from "@/components/clients/clients-table";

export default function ClientsPage() {
  const [refreshToken, setRefreshToken] = React.useState(0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        </div>
        <ClientAddSheet
          onCreated={() => setRefreshToken((t) => t + 1)}
        />
      </div>

      <ClientsTable refreshToken={refreshToken} />
    </div>
  );
}