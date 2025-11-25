// components/propositions/propositions-table.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
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
  Columns3Icon,
  EllipsisVerticalIcon,
  DownloadIcon,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StatutProposition =
  | "a_faire"
  | "envoyee"
  | "en_attente_retour"
  | "acceptee"
  | "refusee";

type EtatProposition = "active" | "archive";
type EtatFilter = "all" | EtatProposition;

// Row front
type PropositionRow = {
  id: string;
  client_id: string | null;
  client_nom_affichage: string | null;
  client_nom_legal: string | null;
  titre: string | null;
  statut: StatutProposition;
  etat: EtatProposition;
  montant_ht: number | null;
  devise: string | null;
  notes_internes: string | null;
  date_prevue_envoi: string | null;
  date_envoi: string | null;
  date_acceptation: string | null;
  date_refus: string | null;
  url_envoi: string | null;
  created_at: string;
};

type DbClientFromJoin = {
  nom_affichage: string | null;
  nom_legal: string | null;
};

type DbPropositionRow = {
  id: string;
  client_id: string | null;
  titre: string | null;
  statut: StatutProposition;
  etat: EtatProposition;
  montant_ht: number | null;
  devise: string | null;
  notes_internes: string | null;
  date_prevue_envoi: string | null;
  date_envoi: string | null;
  date_acceptation: string | null;
  date_refus: string | null;
  url_envoi: string | null;
  created_at: string;
  clients: DbClientFromJoin | DbClientFromJoin[] | null;
};

// petit helper pour l’état depuis le statut
function computeEtatFromStatut(statut: StatutProposition): EtatProposition {
  const actifs: StatutProposition[] = [
    "a_faire",
    "envoyee",
    "en_attente_retour",
  ];
  return actifs.includes(statut) ? "active" : "archive";
}

// filtre global (titre + client)
const multiColumnFilterFn: FilterFn<PropositionRow> = (
  row,
  _columnId,
  filterValue,
) => {
  const search = String(filterValue ?? "")
    .toLowerCase()
    .trim();
  if (!search) return true;

  const content = [
    row.original.titre ?? "",
    row.original.client_nom_affichage ?? "",
    row.original.client_nom_legal ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return content.includes(search);
};

const pageSizeOptions = [5, 10, 25, 50];

const STATUT_LABEL: Record<StatutProposition, string> = {
  a_faire: "À faire",
  envoyee: "Envoyée",
  en_attente_retour: "En attente de retour",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

type PropositionsTableProps = {
  className?: string;
  onAnyChange?: () => void;
};

export function PropositionsTable({
  className,
  onAnyChange,
}: PropositionsTableProps) {
  const supabase = createClient();
  const [data, setData] = useState<PropositionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [etatFilter, setEtatFilter] = useState<EtatFilter>("active");

  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchPropositions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("propositions")
      .select(
        `
        id,
        client_id,
        titre,
        statut,
        etat,
        montant_ht,
        devise,
        notes_internes,
        date_prevue_envoi,
        date_envoi,
        date_acceptation,
        date_refus,
        url_envoi,
        created_at,
        clients:client_id (
          nom_affichage,
          nom_legal
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (etatFilter === "active" || etatFilter === "archive") {
      query = query.eq("etat", etatFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des propositions", {
        description: error.message,
      });
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as unknown as DbPropositionRow[];

    const mapped: PropositionRow[] = raw.map((row) => {
      const clientJoined: DbClientFromJoin | null = Array.isArray(row.clients)
        ? row.clients[0] ?? null
        : row.clients;

      return {
        id: row.id,
        client_id: row.client_id,
        titre: row.titre,
        statut: row.statut,
        etat: row.etat,
        montant_ht: row.montant_ht,
        devise: row.devise,
        notes_internes: row.notes_internes,
        date_prevue_envoi: row.date_prevue_envoi,
        date_envoi: row.date_envoi,
        date_acceptation: row.date_acceptation,
        date_refus: row.date_refus,
        url_envoi: row.url_envoi,
        created_at: row.created_at,
        client_nom_affichage: clientJoined?.nom_affichage ?? null,
        client_nom_legal: clientJoined?.nom_legal ?? null,
      };
    });

    setData(mapped);
    setLoading(false);
  }, [supabase, etatFilter]);

  useEffect(() => {
    fetchPropositions();
  }, [fetchPropositions]);

  // -------------------------------
  // Changement de statut (select)
  // -------------------------------
  async function handleChangeStatut(id: string, newStatut: StatutProposition) {
    const old = data.find((p) => p.id === id);
    if (!old) return;

    const newEtat = computeEtatFromStatut(newStatut);

    // update optimiste côté UI
    setData((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, statut: newStatut, etat: newEtat } : p,
      );

      if (etatFilter === "all") return updated;
      return updated.filter((p) => p.etat === etatFilter);
    });

    const { error } = await supabase
      .from("propositions")
      .update({ statut: newStatut })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du statut", {
        description: error.message,
      });
      // rollback : refetch
      fetchPropositions();
      return;
    }

    // on refetch pour récupérer les colonnes calculées / triggers (dates, etat…)
    await fetchPropositions();

    toast.success("Statut mis à jour", {
      description: `${old.titre || "Proposition"} → ${STATUT_LABEL[newStatut]}`,
    });

    // notifie le parent (rafraîchir KPI par ex.)
    onAnyChange?.();
  }

  const columns: ColumnDef<PropositionRow>[] = [
    {
      header: "Proposition",
      accessorKey: "titre",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {p.titre || "Sans titre"}
            </span>
            <span className="text-xs text-muted-foreground">
              {p.client_nom_affichage || "Client inconnu"}
            </span>
          </div>
        );
      },
      filterFn: multiColumnFilterFn,
      size: 280,
      enableHiding: false,
    },
    {
      header: "Statut",
      accessorKey: "statut",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <Select
            value={p.statut}
            onValueChange={(value) =>
              handleChangeStatut(p.id, value as StatutProposition)
            }
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a_faire">{STATUT_LABEL.a_faire}</SelectItem>
              <SelectItem value="envoyee">{STATUT_LABEL.envoyee}</SelectItem>
              <SelectItem value="en_attente_retour">
                {STATUT_LABEL.en_attente_retour}
              </SelectItem>
              <SelectItem value="acceptee">{STATUT_LABEL.acceptee}</SelectItem>
              <SelectItem value="refusee">{STATUT_LABEL.refusee}</SelectItem>
            </SelectContent>
          </Select>
        );
      },
      size: 200,
    },
    {
      header: "État",
      accessorKey: "etat",
      cell: ({ row }) => {
        const etat = row.original.etat;
        const label = etat === "active" ? "Active" : "Archivée";

        return <span className="text-xs text-muted-foreground">{label}</span>;
      },
      size: 110,
    },
    {
      header: "Montant",
      accessorKey: "montant_ht",
      cell: ({ row }) => {
        const montant = row.original.montant_ht;
        const devise = row.original.devise ?? "EUR";
        if (montant == null) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <span className="text-xs">
            {montant.toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {devise}
          </span>
        );
      },
      size: 130,
    },
    {
      header: "Prévue",
      accessorKey: "date_prevue_envoi",
      cell: ({ row }) => {
        const d = row.original.date_prevue_envoi;
        if (!d) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <span className="text-xs">
            {new Date(d).toLocaleDateString("fr-FR")}
          </span>
        );
      },
      size: 110,
    },
    {
      header: "Envoyée",
      accessorKey: "date_envoi",
      cell: ({ row }) => {
        const d = row.original.date_envoi;
        if (!d) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <span className="text-xs">
            {new Date(d).toLocaleDateString("fr-FR")}
          </span>
        );
      },
      size: 110,
    },
    {
      header: "Docs",
      accessorKey: "url_envoi",
      cell: ({ row }) => {
        const url = row.original.url_envoi;
        if (!url) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <Button asChild variant="outline" size="icon" className="h-8 w-8">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Ouvrir les documents envoyés"
            >
              <DownloadIcon className="h-4 w-4" />
            </a>
          </Button>
        );
      },
      size: 70,
    },
    {
      header: "Créée le",
      accessorKey: "created_at",
      cell: ({ row }) => {
        const d = new Date(row.original.created_at);
        return <span className="text-xs">{d.toLocaleDateString("fr-FR")}</span>;
      },
      size: 110,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RowActions
          row={row}
          onUpdated={fetchPropositions}
          onAnyChange={onAnyChange}
        />
      ),
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
    table.getColumn("titre")?.setFilterValue("");
    setSearchValue("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de recherche & filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Rechercher (titre, client...)"
            aria-label="Rechercher une proposition"
            value={searchValue}
            onChange={(e) => {
              const v = e.target.value;
              setSearchValue(v);
              table.getColumn("titre")?.setFilterValue(v);
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

        {/* Filtre état (active / archive / toutes) */}
        <Select
          value={etatFilter}
          onValueChange={(value) => setEtatFilter(value as EtatFilter)}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="archive">Archivées</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>

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
                    header.getContext(),
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
                  Chargement des propositions...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
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
                  Aucune proposition pour le moment.
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
                  data.length,
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

// ----------------------------------------------------------
// RowActions : bouton "..." + Dialog modification de la propo
// ----------------------------------------------------------

function RowActions({
  row,
  onUpdated,
  onAnyChange,
}: {
  row: Row<PropositionRow>;
  onUpdated: () => void;
  onAnyChange?: () => void;
}) {
  const supabase = createClient();
  const proposition = row.original;

  const [openEdit, setOpenEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const titre = ((formData.get("titre") as string) || "").trim() || null;

    const montantRaw = ((formData.get("montant_ht") as string) || "").trim();
    const montant_ht =
      montantRaw === "" ? null : Number(montantRaw.replace(",", "."));

    const devise = ((formData.get("devise") as string) || "").trim() || null;

    const notes_internes =
      ((formData.get("notes_internes") as string) || "").trim() || null;

    const statut =
      ((formData.get("statut") as StatutProposition) ?? proposition.statut) ||
      proposition.statut;

    const date_prevue_envoi =
      ((formData.get("date_prevue_envoi") as string) || "").trim() || null;

    const url_envoi =
      ((formData.get("url_envoi") as string) || "").trim() || null;

    if (!titre) {
      toast.error("Titre requis", {
        description: "La proposition doit avoir un titre.",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("propositions")
        .update({
          titre,
          montant_ht,
          devise,
          notes_internes,
          statut,
          date_prevue_envoi,
          url_envoi,
        })
        .eq("id", proposition.id);

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la mise à jour de la proposition", {
          description: error.message,
        });
        return;
      }

      toast.success("Proposition mise à jour", {
        description: titre ?? "Proposition",
      });

      setOpenEdit(false);
      onUpdated();
      onAnyChange?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Actions sur la proposition"
            >
              <EllipsisVerticalIcon size={16} aria-hidden="true" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenEdit(true)}>
            Modifier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la proposition</DialogTitle>
            <DialogDescription>
              Mets à jour le titre, le statut et les informations principales.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            {/* Titre + client */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`titre_${proposition.id}`}>Titre *</Label>
                <Input
                  id={`titre_${proposition.id}`}
                  name="titre"
                  defaultValue={proposition.titre ?? ""}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Client</Label>
                <p className="text-xs text-muted-foreground">
                  {proposition.client_nom_affichage ||
                    proposition.client_nom_legal ||
                    "Client inconnu"}
                </p>
              </div>
            </div>

            {/* Montant + devise */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor={`montant_ht_${proposition.id}`}>
                  Montant HT
                </Label>
                <Input
                  id={`montant_ht_${proposition.id}`}
                  name="montant_ht"
                  type="number"
                  step="0.01"
                  defaultValue={
                    proposition.montant_ht != null
                      ? String(proposition.montant_ht)
                      : ""
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`devise_${proposition.id}`}>Devise</Label>
                <Input
                  id={`devise_${proposition.id}`}
                  name="devise"
                  defaultValue={proposition.devise ?? "EUR"}
                />
              </div>
            </div>

            {/* Date prévue d’envoi */}
            <div className="grid gap-1.5">
              <Label htmlFor={`date_prevue_envoi_${proposition.id}`}>
                Date prévue d’envoi
              </Label>
              <Input
                id={`date_prevue_envoi_${proposition.id}`}
                name="date_prevue_envoi"
                type="date"
                defaultValue={
                  proposition.date_prevue_envoi
                    ? proposition.date_prevue_envoi.slice(0, 10)
                    : ""
                }
              />
              {!proposition.date_prevue_envoi && (
                <p className="text-[11px] text-muted-foreground">
                  Aucune date planifiée pour l’instant.
                </p>
              )}
            </div>

            {/* Lien docs envoyés */}
            <div className="grid gap-1.5">
              <Label htmlFor={`url_envoi_${proposition.id}`}>
                Lien des documents envoyés
              </Label>
              <Input
                id={`url_envoi_${proposition.id}`}
                name="url_envoi"
                type="url"
                defaultValue={proposition.url_envoi ?? ""}
                placeholder="https://wetransfer.com/..."
              />
              {!proposition.url_envoi && (
                <p className="text-[11px] text-muted-foreground">
                  Ajoute ici le lien WeTransfer / Drive des documents envoyés
                  au client.
                </p>
              )}
            </div>

            {/* Statut */}
            <div className="grid gap-1.5">
              <Label htmlFor={`statut_${proposition.id}`}>Statut</Label>
              <Select name="statut" defaultValue={proposition.statut}>
                <SelectTrigger id={`statut_${proposition.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_faire">
                    {STATUT_LABEL.a_faire}
                  </SelectItem>
                  <SelectItem value="envoyee">
                    {STATUT_LABEL.envoyee}
                  </SelectItem>
                  <SelectItem value="en_attente_retour">
                    {STATUT_LABEL.en_attente_retour}
                  </SelectItem>
                  <SelectItem value="acceptee">
                    {STATUT_LABEL.acceptee}
                  </SelectItem>
                  <SelectItem value="refusee">
                    {STATUT_LABEL.refusee}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes internes */}
            <div className="grid gap-1.5">
              <Label htmlFor={`notes_${proposition.id}`}>Notes internes</Label>
              <Textarea
                id={`notes_${proposition.id}`}
                name="notes_internes"
                defaultValue={proposition.notes_internes ?? ""}
                placeholder="Contexte, objections, next steps..."
                rows={4}
              />
            </div>

            <DialogFooter className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenEdit(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}