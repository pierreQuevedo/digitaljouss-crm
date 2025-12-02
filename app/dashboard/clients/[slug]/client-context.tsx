// app/dashboard/clients/[slug]/client-context.tsx
"use client";

import { createContext, useContext } from "react";
import type { ClientRow } from "./client-types";

const ClientContext = createContext<ClientRow | null>(null);

type ProviderProps = {
  client: ClientRow;
  children: React.ReactNode;
};

export function ClientProvider({ client, children }: ProviderProps) {
  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) {
    throw new Error("useClient doit être utilisé dans un <ClientProvider>");
  }
  return ctx;
}