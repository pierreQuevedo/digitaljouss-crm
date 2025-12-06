"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  EllipsisVerticalIcon,
  Columns3Icon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";

type StatutClient = "client" | "prospect";

type ClientRow = {
  id: string;
  statut_client: StatutClient;
  nom_affichage: string;
  nom_legal: string | null;
  logo_url: string | null;
  email_general: string | null;
  site_web_principal: string | null;
  contact_principal_nom: string | null;
  contact_principal_prenom: string | null;
  contact_principal_email: string | null;
  notes_internes: string | null;
  created_at: string;
  slug: string | null;
};

// helper pour les initiales
function getInitials(name: string | null | undefined) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0];
  const second = parts[1]?.[0];
  return `${first ?? ""}${second ?? ""}`.toUpperCase() || "??";
}

// filtre global nom + email
const multiColumnFilterFn = (
  row: Row<ClientRow>,
  _columnId: string,
  filterValue: unknown
) => {
  const search = String(filterValue ?? "")
    .toLowerCase()
    .trim();
  if (!search) return true;

  const content = [
    row.original.nom_affichage,
    row.original.nom_legal ?? "",
    row.original.email_general ?? "",
    row.original.contact_principal_email ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return content.includes(search);
};

const pageSizeOptions = [5, 10, 25, 50];

export function ClientsTable({
  className,
  initialStatut = "client",
  refreshToken,
}: {
  className?: string;
  /** "client" ou "prospect" – permet de réutiliser le composant côté Prospects */
  initialStatut?: StatutClient;
  /** permet de forcer un refetch depuis le parent */
  refreshToken?: number;
}) {
  const supabase = createClient();
  const [data, setData] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "nom_affichage", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .select(
        `
        id,
        statut_client,
        nom_affichage,
        nom_legal,
        logo_url,
        email_general,
        site_web_principal,
        contact_principal_nom,
        contact_principal_prenom,
        contact_principal_email,
        notes_internes,
        created_at,
        slug
      `
      )
      .eq("statut_client", initialStatut)
      .order("nom_affichage", { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des clients", {
        description: error.message,
      });
    } else {
      setData((data ?? []) as ClientRow[]);
    }

    setLoading(false);
  }, [supabase, initialStatut]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients, refreshToken]);

  async function handleChangeStatut(id: string, value: StatutClient) {
    const old = data.find((c) => c.id === id);
    if (!old) return;

    // Optimiste
    setData((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, statut_client: value } : c))
        // on enlève la ligne si elle ne correspond plus au filtre courant
        .filter((c) => c.statut_client === initialStatut)
    );

    const { error } = await supabase
      .from("clients")
      .update({ statut_client: value })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du statut", {
        description: error.message,
      });
      // rollback simple : refetch
      fetchClients();
      return;
    }

    toast.success("Statut mis à jour", {
      description: `${old.nom_affichage} est maintenant ${value}.`,
    });
  }

  const columns: ColumnDef<ClientRow>[] = [
    {
      id: "avatar",
      header: "",
      cell: ({ row }) => {
        const client = row.original;
        const initials = getInitials(client.nom_affichage);
        return (
          <Avatar className="h-8 w-8">
            {client.logo_url && (
              <AvatarImage src={client.logo_url} alt={client.nom_affichage} />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        );
      },
      size: 40,
      enableSorting: false,
      enableHiding: false,
    },
    {
      header: "Client",
      accessorKey: "nom_affichage",
      cell: ({ row }) => {
        const client = row.original;
        const contactName = [
          client.contact_principal_prenom,
          client.contact_principal_nom,
        ]
          .filter(Boolean)
          .join(" ");

        const href = client.slug
          ? `/dashboard/clients/${client.slug}`
          : undefined;

        return (
          <div className="flex flex-col">
            {href ? (
              <Link
                href={href}
                className="font-medium text-sm hover:underline hover:text-blue-600"
              >
                {client.nom_affichage}
              </Link>
            ) : (
              <span className="font-medium text-sm">
                {client.nom_affichage}
              </span>
            )}

            {client.nom_legal && client.nom_legal !== client.nom_affichage && (
              <span className="text-xs text-muted-foreground">
                {client.nom_legal}
              </span>
            )}
            {contactName && (
              <span className="mt-0.5 text-[11px] text-muted-foreground">
                {contactName}
              </span>
            )}
          </div>
        );
      },
      filterFn: multiColumnFilterFn,
      size: 260,
      enableHiding: false,
    },
    {
      header: "Email",
      accessorKey: "email_general",
      cell: ({ row }) => {
        const email = row.original.email_general;
        if (!email) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <a
            href={`mailto:${email}`}
            className="text-xs text-blue-600 hover:underline"
          >
            {email}
          </a>
        );
      },
      size: 220,
    },
    {
      header: "Site",
      accessorKey: "site_web_principal",
      cell: ({ row }) => {
        const url = row.original.site_web_principal;
        if (!url) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const display = url.replace(/^https?:\/\//, "");
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            {display}
          </a>
        );
      },
      size: 220,
    },
    {
      header: "Statut",
      accessorKey: "statut_client",
      cell: ({ row }) => {
        const client = row.original;
        return (
          <Select
            value={client.statut_client}
            onValueChange={(value) =>
              handleChangeStatut(client.id, value as StatutClient)
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
        );
      },
      size: 140,
    },
    {
      header: "Créé le",
      accessorKey: "created_at",
      cell: ({ row }) => {
        const d = new Date(row.original.created_at);
        const formatted = d.toLocaleDateString("fr-FR");
        return <span className="text-xs">{formatted}</span>;
      },
      size: 110,
    },
    {
      header: "Notes",
      accessorKey: "notes_internes",
      cell: ({ row }) => {
        const notes = (row.original.notes_internes ?? "").trim();
        if (!notes) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const short =
          notes.length > 80 ? `${notes.slice(0, 77).trim()}…` : notes;
        return <span className="text-xs text-muted-foreground">{short}</span>;
      },
      size: 220,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <RowActions row={row} onUpdated={fetchClients} />,
      size: 60,
      enableSorting: false,
      enableHiding: false,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    enableSortingRemoval: false,
  });

  const handleClearSearch = () => {
    table.getColumn("nom_affichage")?.setFilterValue("");
    setSearchValue("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de recherche & colonnes */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            ref={inputRef}
            placeholder={`Rechercher (${initialStatut}, email...)`}
            aria-label={`Rechercher un ${initialStatut}`}
            value={searchValue}
            onChange={(e) => {
              const v = e.target.value;
              setSearchValue(v);
              table.getColumn("nom_affichage")?.setFilterValue(v);
            }}
          />
          {Boolean(searchValue) && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleClearSearch}
            >
              ×
            </Button>
          )}
        </div>

        {/* Colonnes visibles */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2"
            >
              <Columns3Icon className="h-4 w-4" />
              Colonnes
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((col) => col.getCanHide())
              .map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  className="flex items-center gap-2"
                  onClick={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={column.getIsVisible()}
                    readOnly
                  />
                  <span className="text-xs">{column.id}</span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40">
                {headerGroup.headers.map((header) => {
                  if (header.isPlaceholder) return null;

                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted() as
                    | "asc"
                    | "desc"
                    | false;

                  const headerContent = flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  );

                  return (
                    <TableHead
                      key={header.id}
                      className={cn("whitespace-nowrap text-xs font-medium")}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {headerContent}
                          {sorted === "asc" && (
                            <ChevronUpIcon className="h-3 w-3" />
                          )}
                          {sorted === "desc" && (
                            <ChevronDownIcon className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        headerContent
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-sm"
                >
                  Chargement des clients...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-sm"
                >
                  Aucun {initialStatut} pour le moment.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Résultats par page</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) =>
              setPagination((prev) => ({
                ...prev,
                pageSize: Number(value),
                pageIndex: 0,
              }))
            }
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={String(size)} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span>
            {data.length === 0
              ? "0–0"
              : `${pagination.pageIndex * pagination.pageSize + 1}–${Math.min(
                  (pagination.pageIndex + 1) * pagination.pageSize,
                  data.length
                )}`}{" "}
            sur {data.length}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronFirstIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                table.setPageIndex(Math.max(table.getPageCount() - 1, 0))
              }
              disabled={!table.getCanNextPage()}
            >
              <ChevronLastIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// RowActions : Modifier (ClientFormDialog) + Supprimer (dialog confirmation)
// ------------------------------------------------------------------

function RowActions({
  row,
  onUpdated,
}: {
  row: Row<ClientRow>;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const client = row.original;

  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    try {
      setDeleting(true);

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la suppression du client", {
          description: error.message,
        });
        return;
      }

      toast.success("Client supprimé", {
        description: `${client.nom_affichage} a été supprimé.`,
      });

      setOpenDelete(false);
      setOpenEdit(false);
      onUpdated();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Menu actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Actions sur le client"
            >
              <EllipsisVerticalIcon size={16} aria-hidden="true" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              if (client.slug) {
                router.push(`/dashboard/clients/${client.slug}`);
              } else {
                setOpenEdit(true);
              }
            }}
          >
            Modifier
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setOpenDelete(true)}
          >
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog édition = réutilise le même form que "Ajouter un client" */}
      <ClientFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        client={client} // 🔥 ici : on passe le client → mode edit
        defaultStatut={client.statut_client}
        onSaved={onUpdated} // pour refetch la table après save
      />

      {/* Dialog suppression */}
      <Dialog
        open={openDelete}
        onOpenChange={(open) => {
          if (!deleting) setOpenDelete(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce client ?</DialogTitle>
            <DialogDescription>
              Cette action est définitive. Le client{" "}
              <span className="font-semibold text-foreground">
                {client.nom_affichage}
              </span>{" "}
              sera supprimé de la base.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenDelete(false)}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
