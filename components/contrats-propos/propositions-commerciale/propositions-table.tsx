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

// ---------- Types ----------

export type StatutProposition = "a_faire" | "envoyee" | "acceptee" | "refusee";

export type EtatProposition = "active" | "archive";
export type EtatFilter = "all" | EtatProposition;
export type StatutFilter = "all" | StatutProposition;

type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
};

// mapping couleurs (même logique que pour les services)
const CATEGORY_COLORS: Record<string, { badge: string; dot: string }> = {
  "strategie-digitale": {
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    dot: "bg-sky-500",
  },
  "direction-artistique": {
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
  "conception-web": {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  "social-media-management": {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
};

function getCategoryBadgeClasses(slug?: string | null) {
  if (!slug) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  return (
    CATEGORY_COLORS[slug]?.badge ??
    "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function getCategoryDotClasses(slug?: string | null) {
  if (!slug) {
    return "bg-slate-500";
  }
  return CATEGORY_COLORS[slug]?.dot ?? "bg-slate-500";
}

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
  service_category_id: string | null;
  service_category_label: string | null;
  service_category_slug: string | null;
  created_at: string;
};

type DbClientFromJoin = {
  nom_affichage: string | null;
  nom_legal: string | null;
};

type DbServiceCategoryFromJoin = {
  id: string;
  slug: string;
  label: string;
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
  service_category_id: string | null;
  created_at: string;
  clients: DbClientFromJoin | DbClientFromJoin[] | null;
  service_category:
    | DbServiceCategoryFromJoin
    | DbServiceCategoryFromJoin[]
    | null;
};

// petit helper pour l’état depuis le statut
function computeEtatFromStatut(statut: StatutProposition): EtatProposition {
  const actifs: StatutProposition[] = ["a_faire", "envoyee"];
  return actifs.includes(statut) ? "active" : "archive";
}

// filtre global (titre + client + catégorie)
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
    row.original.service_category_label ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return content.includes(search);
};

const pageSizeOptions = [5, 10, 25, 50];

const STATUT_LABEL: Record<StatutProposition, string> = {
  a_faire: "À faire",
  envoyee: "Envoyée",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

// ---------- Props table (avec filtres contrôlables) ----------

type PropositionsTableProps = {
  className?: string;
  onAnyChange?: () => void;

  /** Filtre d'état contrôlé par le parent (optionnel) */
  etatFilter?: EtatFilter;
  onEtatFilterChange?: (v: EtatFilter) => void;

  /** Filtre de statut contrôlé par le parent (optionnel) */
  statutFilter?: StatutFilter;
  onStatutFilterChange?: (v: StatutFilter) => void;
};

export function PropositionsTable({
  className,
  onAnyChange,
  etatFilter: etatFilterProp,
  onEtatFilterChange,
  statutFilter: statutFilterProp,
  onStatutFilterChange,
}: PropositionsTableProps) {
  const supabase = createClient();
  const [data, setData] = useState<PropositionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ---- Filtres contrôlables / internes ----
  const [internalEtatFilter, setInternalEtatFilter] =
    useState<EtatFilter>("active");
  const [internalStatutFilter, setInternalStatutFilter] =
    useState<StatutFilter>("all");

  const effectiveEtatFilter = etatFilterProp ?? internalEtatFilter;
  const effectiveStatutFilter = statutFilterProp ?? internalStatutFilter;

  const setEffectiveEtatFilter = (value: EtatFilter) => {
    if (onEtatFilterChange) {
      onEtatFilterChange(value);
    } else {
      setInternalEtatFilter(value);
    }
  };

  const setEffectiveStatutFilter = (value: StatutFilter) => {
    if (onStatutFilterChange) {
      onStatutFilterChange(value);
    } else {
      setInternalStatutFilter(value);
    }
  };

  // quand on change d'état, on corrige le statut si incompatible
  useEffect(() => {
    let next = effectiveStatutFilter;

    if (
      effectiveEtatFilter === "active" &&
      (effectiveStatutFilter === "acceptee" ||
        effectiveStatutFilter === "refusee")
    ) {
      next = "all";
    }

    if (
      effectiveEtatFilter === "archive" &&
      (effectiveStatutFilter === "a_faire" ||
        effectiveStatutFilter === "envoyee")
    ) {
      next = "all";
    }

    if (next !== effectiveStatutFilter) {
      setEffectiveStatutFilter(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEtatFilter]);

  // ---- Table & autres états ----

  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    etat: false,
  });
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, slug, label")
        .order("label", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des catégories", {
          description: error.message,
        });
        return;
      }

      setCategories((data ?? []) as ServiceCategory[]);
    };

    void fetchCategories();
  }, [supabase]);

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
        service_category_id,
        created_at,
        clients:client_id (
          nom_affichage,
          nom_legal
        ),
        service_category:service_category_id (
          id,
          slug,
          label
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (effectiveEtatFilter === "active" || effectiveEtatFilter === "archive") {
      query = query.eq("etat", effectiveEtatFilter);
    }

    if (effectiveStatutFilter !== "all") {
      query = query.eq("statut", effectiveStatutFilter);
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

      const catJoined: DbServiceCategoryFromJoin | null = Array.isArray(
        row.service_category,
      )
        ? row.service_category[0] ?? null
        : row.service_category;

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
        service_category_id: row.service_category_id,
        service_category_label: catJoined?.label ?? null,
        service_category_slug: catJoined?.slug ?? null,
        created_at: row.created_at,
        client_nom_affichage: clientJoined?.nom_affichage ?? null,
        client_nom_legal: clientJoined?.nom_legal ?? null,
      };
    });

    setData(mapped);
    setLoading(false);
  }, [supabase, effectiveEtatFilter, effectiveStatutFilter]);

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

      if (effectiveEtatFilter === "all") return updated;
      return updated.filter((p) => p.etat === effectiveEtatFilter);
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
      description: `${old.titre || "Proposition"} → ${
        STATUT_LABEL[newStatut]
      }`,
    });

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
      header: "Catégorie",
      accessorKey: "service_category_label",
      cell: ({ row }) => {
        const { service_category_label: label, service_category_slug: slug } =
          row.original;

        if (!label) {
          return (
            <span className="text-xs text-muted-foreground">Non définie</span>
          );
        }

        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
              getCategoryBadgeClasses(slug),
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                getCategoryDotClasses(slug),
              )}
            />
            <span>{label}</span>
          </span>
        );
      },
      size: 190,
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
          categories={categories}
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

  const firstRow =
    data.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow =
    data.length === 0
      ? 0
      : Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.length);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de recherche & filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Rechercher (titre, client, catégorie...)"
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

        {/* Filtre état */}
        <Select
          value={effectiveEtatFilter}
          onValueChange={(value) => setEffectiveEtatFilter(value as EtatFilter)}
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

        {/* Filtre statut */}
        <Select
          value={effectiveStatutFilter}
          onValueChange={(value) =>
            setEffectiveStatutFilter(value as StatutFilter)
          }
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            {effectiveEtatFilter === "active" && (
              <>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="a_faire">{STATUT_LABEL.a_faire}</SelectItem>
                <SelectItem value="envoyee">{STATUT_LABEL.envoyee}</SelectItem>
              </>
            )}

            {effectiveEtatFilter === "archive" && (
              <>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="acceptee">
                  {STATUT_LABEL.acceptee}
                </SelectItem>
                <SelectItem value="refusee">{STATUT_LABEL.refusee}</SelectItem>
              </>
            )}

            {effectiveEtatFilter === "all" && (
              <>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="a_faire">{STATUT_LABEL.a_faire}</SelectItem>
                <SelectItem value="envoyee">{STATUT_LABEL.envoyee}</SelectItem>
                <SelectItem value="acceptee">
                  {STATUT_LABEL.acceptee}
                </SelectItem>
                <SelectItem value="refusee">{STATUT_LABEL.refusee}</SelectItem>
              </>
            )}
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
            {data.length === 0 ? "0–0" : `${firstRow}–${lastRow}`} sur{" "}
            {data.length}
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
  categories,
}: {
  row: Row<PropositionRow>;
  onUpdated: () => void;
  onAnyChange?: () => void;
  categories: ServiceCategory[];
}) {
  const supabase = createClient();
  const proposition = row.original;

  const [openEdit, setOpenEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(proposition.service_category_id ?? undefined);
  const [statutValue, setStatutValue] = useState<StatutProposition>(
    proposition.statut,
  );

  useEffect(() => {
    if (openEdit) {
      setSelectedCategoryId(proposition.service_category_id ?? undefined);
      setStatutValue(proposition.statut);
    }
  }, [openEdit, proposition.service_category_id, proposition.statut]);

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null;

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

    const date_prevue_envoi =
      ((formData.get("date_prevue_envoi") as string) || "").trim() || null;

    const url_envoi =
      ((formData.get("url_envoi") as string) || "").trim() || null;

    const service_category_id = selectedCategoryId ?? null;
    const statut = statutValue;

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
          service_category_id,
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
              Mets à jour le titre, la catégorie, le statut et les informations
              principales.
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

            {/* Catégorie */}
            <div className="grid gap-1.5">
              <Label htmlFor={`service_category_${proposition.id}`}>
                Catégorie
              </Label>
              <Select
                value={selectedCategoryId ?? ""}
                onValueChange={(value) => setSelectedCategoryId(value)}
              >
                <SelectTrigger id={`service_category_${proposition.id}`}>
                  <SelectValue placeholder="Choisir une catégorie">
                    {selectedCategory && (
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                          getCategoryBadgeClasses(selectedCategory.slug),
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            getCategoryDotClasses(selectedCategory.slug),
                          )}
                        />
                        <span>{selectedCategory.label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                          getCategoryBadgeClasses(cat.slug),
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            getCategoryDotClasses(cat.slug),
                          )}
                        />
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="service_category_id"
                value={selectedCategoryId ?? ""}
              />
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
                  Ajoute ici le lien WeTransfer / Drive des documents envoyés au
                  client.
                </p>
              )}
            </div>

            {/* Statut */}
            <div className="grid gap-1.5">
              <Label htmlFor={`statut_${proposition.id}`}>Statut</Label>
              <Select
                value={statutValue}
                onValueChange={(value) =>
                  setStatutValue(value as StatutProposition)
                }
              >
                <SelectTrigger id={`statut_${proposition.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_faire">À faire</SelectItem>
                  <SelectItem value="envoyee">Envoyée</SelectItem>
                  <SelectItem value="acceptee">Acceptée</SelectItem>
                  <SelectItem value="refusee">Refusée</SelectItem>
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