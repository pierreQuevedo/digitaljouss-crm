// components/clients/prospects/prospects-table.tsx
import { ClientsTable } from "@/components/clients/clients-table";

export function ProspectsTable({
  className,
  refreshToken,
}: {
  className?: string;
  refreshToken?: number;
}) {
  return (
    <ClientsTable
      className={className}
      initialStatut="prospect"
      refreshToken={refreshToken}
    />
  );
}