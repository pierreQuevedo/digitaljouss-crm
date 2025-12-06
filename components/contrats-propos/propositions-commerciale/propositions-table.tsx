"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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
  ChevronDown,
  Check,
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

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type StatutProposition =
  | "a_faire"
  | "envoyee"
  | "en_attente_retour"
  | "acceptee"
  | "refusee";

export type BillingModel = "one_shot" | "recurring";

export type EtatProposition = "active" | "archive";
export type EtatFilter = "all" | EtatProposition;
export type StatutFilter = "all" | StatutProposition;

type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
};

type ServiceOption = {
  id: string;
  label: string;
  category_id: string | null;
  default_unit_price: number | null;
};

type DbServiceRow = {
  id: string;
  label: string;
  category_id: string | null;
  default_unit_price: number | string | null;
  is_active: boolean;
};

/* -------------------------------------------------------------------------- */
/*                              HELPERS / UI CONST                            */
/* -------------------------------------------------------------------------- */

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

const pageSizeOptions = [5, 10, 25, 50];

const STATUT_LABEL: Record<StatutProposition, string> = {
  a_faire: "À faire",
  envoyee: "Envoyée",
  en_attente_retour: "En attente retour",
  acceptee: "Acceptée",
  refusee: "Refusée",
};

const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  one_shot: "One shot",
  recurring: "Récurrent",
};

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/*                                   ROW TYPE                                 */
/* -------------------------------------------------------------------------- */

// Row front
type PropositionRow = {
  id: string;
  client_id: string | null;
  client_nom_affichage: string | null;
  client_nom_legal: string | null;
  titre: string | null;
  statut: StatutProposition;
  etat: EtatProposition;

  // Montants & facturation
  billing_model: BillingModel;
  montant_ht: number | null;
  montant_ht_one_shot: number | null;
  montant_ht_mensuel: number | null;
  devise: string | null;

  date_prevue_facturation_recurrente: string | null;

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

  billing_model: BillingModel | null;
  montant_ht: number | string | null;
  montant_ht_one_shot: number | string | null;
  montant_ht_mensuel: number | string | null;
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
  date_prevue_facturation_recurrente: string | null;
};

/* -------------------------------------------------------------------------- */
/*                              BUSINESS HELPERS                              */
/* -------------------------------------------------------------------------- */

// petit helper pour l’état depuis le statut
function computeEtatFromStatut(statut: StatutProposition): EtatProposition {
  const actifs: StatutProposition[] = [
    "a_faire",
    "envoyee",
    "en_attente_retour",
  ];
  return actifs.includes(statut) ? "active" : "archive";
}

// filtre global (titre + client + catégorie)
const multiColumnFilterFn: FilterFn<PropositionRow> = (
  row,
  _columnId,
  filterValue
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

/* -------------------------------------------------------------------------- */
/*                               PROPS TABLE                                  */
/* -------------------------------------------------------------------------- */

type PropositionsTableProps = {
  className?: string;
  onAnyChange?: () => void;

  /** Filtre d'état contrôlé par le parent (optionnel) */
  etatFilter?: EtatFilter;
  onEtatFilterChange?: (v: EtatFilter) => void;

  /** Filtre de statut contrôlé par le parent (optionnel) */
  statutFilter?: StatutFilter;
  onStatutFilterChange?: (v: StatutFilter) => void;

  /** Facultatif : ne charger que les propositions de ce client */
  clientId?: string;
};

/* -------------------------------------------------------------------------- */
/*                               MAIN TABLE                                   */
/* -------------------------------------------------------------------------- */

export function PropositionsTable({
  className,
  onAnyChange,
  etatFilter: etatFilterProp,
  onEtatFilterChange,
  statutFilter: statutFilterProp,
  onStatutFilterChange,
  clientId,
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
        effectiveStatutFilter === "envoyee" ||
        effectiveStatutFilter === "en_attente_retour")
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

  // chargement des catégories
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

  // chargement des propositions
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
        billing_model,
        montant_ht,
        montant_ht_one_shot,
        montant_ht_mensuel,
        devise,
        notes_internes,
        date_prevue_envoi,
  date_envoi,
  date_acceptation,
  date_refus,
  url_envoi,
  service_category_id,
  created_at,
  date_prevue_facturation_recurrente,
        clients:client_id (
          nom_affichage,
          nom_legal
        ),
        service_category:service_category_id (
          id,
          slug,
          label
        )
      `
      )
      .order("created_at", { ascending: false });

    // 💡 filtre par client si fourni
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

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
        row.service_category
      )
        ? row.service_category[0] ?? null
        : row.service_category;

      const toNumber = (v: number | string | null): number | null => {
        if (v == null) return null;
        if (typeof v === "number") return v;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const montantHt = toNumber(row.montant_ht);
      const montantHtOneShot = toNumber(row.montant_ht_one_shot);
      const montantHtMensuel = toNumber(row.montant_ht_mensuel);

      // fallback si montant_ht est null mais qu'on a les deux autres
      const globalMontant =
        montantHt ??
        (montantHtOneShot != null || montantHtMensuel != null
          ? (montantHtOneShot ?? 0) + (montantHtMensuel ?? 0)
          : null);

      return {
        id: row.id,
        client_id: row.client_id,
        titre: row.titre,
        statut: row.statut,
        etat: row.etat,

        billing_model: row.billing_model ?? "one_shot",
        montant_ht: globalMontant,
        montant_ht_one_shot: montantHtOneShot,
        montant_ht_mensuel: montantHtMensuel,
        devise: row.devise,

        date_prevue_facturation_recurrente:
          row.date_prevue_facturation_recurrente,

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
  }, [supabase, effectiveEtatFilter, effectiveStatutFilter, clientId]);

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
  
    // ✅ plus de "any" ici
    const updatePayload: {
      statut: StatutProposition;
      date_acceptation?: string;
    } = { statut: newStatut };
  
    // si on passe à "acceptee" et qu'on n'a pas encore de date_acceptation
    if (newStatut === "acceptee" && !old.date_acceptation) {
      updatePayload.date_acceptation = new Date().toISOString();
    }
  
    const { error } = await supabase
      .from("propositions")
      .update(updatePayload)
      .eq("id", id);
  
    if (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du statut", {
        description: error.message,
      });
      await fetchPropositions();
      return;
    }
  
    if (newStatut === "acceptee") {
      await createContratFromProposition(old);
    }
  
    await fetchPropositions();
  
    toast.success("Statut mis à jour", {
      description: `${old.titre || "Proposition"} → ${
        STATUT_LABEL[newStatut]
      }`,
    });
  
    onAnyChange?.();
  }

  async function createContratFromProposition(p: PropositionRow) {
    const supabase = createClient();
  
    // 1) éviter les doublons : si un contrat existe déjà pour cette prop, on ne fait rien
    const { data: existing, error: existingError } = await supabase
      .from("contrats")
      .select("id")
      .eq("proposition_id", p.id)
      .maybeSingle();
  
    if (existingError) {
      console.error(existingError);
    }
  
    if (existing) {
      // il y a déjà un contrat, on ne recrée pas
      return;
    }
  
    const nowIso = new Date().toISOString();
  
    // 2) Construction du contrat à partir de la proposition
    const { error } = await supabase.from("contrats").insert({
      proposition_id: p.id,
      client_id: p.client_id,
      titre: p.titre,
      description: p.notes_internes,
      statut: "en_cours", // ou "signe" selon ta logique métier
      montant_ht: p.montant_ht,
      montant_ht_one_shot: p.montant_ht_one_shot,
      montant_ht_mensuel: p.montant_ht_mensuel,
      tva_rate: null,
      montant_ttc: null,
      devise: p.devise ?? "EUR",
      billing_model: p.billing_model,
      // On suppose le récurrent mensuel pour l’instant
      billing_period: "monthly",
      date_debut: p.date_acceptation ?? nowIso,
      date_fin_prevue: null, // à définir plus tard si engagement
      nb_mois_engagement: null,
      reference_externe: null,
      created_at: nowIso,
      date_signature: p.date_acceptation ?? nowIso,
    });
  
    if (error) {
      console.error(error);
      toast.error("Erreur lors de la création automatique du contrat", {
        description: error.message,
      });
      return;
    }
  
    toast.success("Contrat créé à partir de la proposition acceptée");
  }

  /* -------------------------------------------------------------------------- */
  /*                                 COLUMNS                                   */
  /* -------------------------------------------------------------------------- */

  const columns: ColumnDef<PropositionRow>[] = [
    {
      header: "Proposition",
      accessorKey: "titre",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {p.titre || "Sans titre"}
            </span>
            <span className="text-xs text-muted-foreground">
              {p.client_nom_affichage || p.client_nom_legal || "Client inconnu"}
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
              getCategoryBadgeClasses(slug)
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                getCategoryDotClasses(slug)
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
            <SelectTrigger className="h-8 w-[190px] text-xs">
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
      size: 210,
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
      header: "Modèle",
      accessorKey: "billing_model",
      cell: ({ row }) => {
        const model = row.original.billing_model;
        return (
          <span className="text-xs text-muted-foreground">
            {BILLING_MODEL_LABEL[model]}
          </span>
        );
      },
      size: 170,
    },
    {
      header: "Montant",
      accessorKey: "montant_ht",
      cell: ({ row }) => {
        const {
          montant_ht,
          montant_ht_one_shot,
          montant_ht_mensuel,
          billing_model,
          devise,
        } = row.original;

        const d = devise ?? "EUR";

        const fmt = (v: number | null) =>
          v == null
            ? "—"
            : v.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

        if (billing_model === "one_shot") {
          return (
            <span className="text-xs">
              {fmt(montant_ht_one_shot ?? montant_ht)} {d}
            </span>
          );
        }

        if (billing_model === "recurring") {
          return (
            <span className="text-xs">
              {fmt(montant_ht_mensuel)} {d} / mois
            </span>
          );
        }


        if (montant_ht == null) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <span className="text-xs">
            {fmt(montant_ht)} {d}
          </span>
        );
      },
      size: 190,
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

  /* -------------------------------------------------------------------------- */
  /*                             REACT-TABLE SETUP                             */
  /* -------------------------------------------------------------------------- */

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

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                  */
  /* -------------------------------------------------------------------------- */

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
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            {effectiveEtatFilter === "active" && (
              <>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="a_faire">{STATUT_LABEL.a_faire}</SelectItem>
                <SelectItem value="envoyee">{STATUT_LABEL.envoyee}</SelectItem>
                <SelectItem value="en_attente_retour">
                  {STATUT_LABEL.en_attente_retour}
                </SelectItem>
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
                <SelectItem value="en_attente_retour">
                  {STATUT_LABEL.en_attente_retour}
                </SelectItem>
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

/* -------------------------------------------------------------------------- */
/*                               ROW ACTIONS                                  */
/* -------------------------------------------------------------------------- */

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

  // catégorie
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(proposition.service_category_id ?? undefined);

  // statut
  const [statutValue, setStatutValue] = useState<StatutProposition>(
    proposition.statut
  );

  // modèle de facturation + montants
  const [billingModel, setBillingModel] = useState<BillingModel>(
    proposition.billing_model ?? "one_shot"
  );
  const [montantOneShot, setMontantOneShot] = useState<string>(
    proposition.montant_ht_one_shot != null
      ? String(proposition.montant_ht_one_shot)
      : ""
  );
  const [montantMensuel, setMontantMensuel] = useState<string>(
    proposition.montant_ht_mensuel != null
      ? String(proposition.montant_ht_mensuel)
      : ""
  );

  // services
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // reset quand on ouvre le dialog
  useEffect(() => {
    if (!openEdit) return;

    setSelectedCategoryId(proposition.service_category_id ?? undefined);
    setStatutValue(proposition.statut);
    setBillingModel(proposition.billing_model ?? "one_shot");
    setMontantOneShot(
      proposition.montant_ht_one_shot != null
        ? String(proposition.montant_ht_one_shot)
        : ""
    );
    setMontantMensuel(
      proposition.montant_ht_mensuel != null
        ? String(proposition.montant_ht_mensuel)
        : ""
    );

    // fetch services + services déjà liés à cette proposition
    const fetchServicesAndLinks = async () => {
      setLoadingServices(true);

      const [servicesRes, linksRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, label, category_id, default_unit_price, is_active")
          .eq("is_active", true)
          .order("label", { ascending: true }),
        supabase
          .from("proposition_services")
          .select("service_id")
          .eq("proposition_id", proposition.id),
      ]);

      if (servicesRes.error) {
        console.error(servicesRes.error);
        toast.error("Erreur lors du chargement des services", {
          description: servicesRes.error.message,
        });
      } else if (servicesRes.data) {
        const typed = servicesRes.data as DbServiceRow[];
        setServices(
          typed.map((s) => ({
            id: s.id,
            label: s.label,
            category_id: s.category_id,
            default_unit_price:
              s.default_unit_price == null
                ? null
                : typeof s.default_unit_price === "number"
                ? s.default_unit_price
                : Number(s.default_unit_price),
          }))
        );
      }

      if (linksRes.error) {
        console.error(linksRes.error);
        toast.error(
          "Erreur lors du chargement des services associés à la proposition",
          { description: linksRes.error.message }
        );
      } else if (linksRes.data) {
        const linkedIds = (linksRes.data as { service_id: string }[]).map(
          (r) => r.service_id
        );
        setSelectedServiceIds(linkedIds);
      }

      setLoadingServices(false);
    };

    void fetchServicesAndLinks();
  }, [
    openEdit,
    supabase,
    proposition.id,
    proposition.service_category_id,
    proposition.statut,
    proposition.billing_model,
    proposition.montant_ht_one_shot,
    proposition.montant_ht_mensuel,
  ]);

  const selectedCategory = useMemo(
    () =>
      selectedCategoryId
        ? categories.find((c) => c.id === selectedCategoryId) ?? null
        : null,
    [selectedCategoryId, categories]
  );

  // modèles autorisés en fonction de la catégorie
  const allowedBillingModels: BillingModel[] = useMemo(() => {
    if (!selectedCategory) return ["one_shot", "recurring"];

    const slug = selectedCategory.slug;

    if (slug === "social-media-management" || slug === "strategie-digitale") {
      return ["recurring"];
    }

    if (slug === "direction-artistique" || slug === "conception-web") {
      return ["one_shot"];
    }

    return ["one_shot", "recurring"];
  }, [selectedCategory]);

  // modèle par défaut quand on change de catégorie
  useEffect(() => {
    if (!selectedCategory) return;

    const slug = selectedCategory.slug;

    if (slug === "social-media-management" || slug === "strategie-digitale") {
      setBillingModel("recurring");
      return;
    }

    if (slug === "direction-artistique" || slug === "conception-web") {
      setBillingModel("one_shot");
      return;
    }
  }, [selectedCategory]);

  // services disponibles selon la catégorie
  const availableServices = useMemo(() => {
    if (!selectedCategoryId) return [] as ServiceOption[];
    return services.filter((s) => s.category_id === selectedCategoryId);
  }, [services, selectedCategoryId]);

  const selectedServicesLabels = useMemo(() => {
    if (!selectedServiceIds.length) return "";
    const labels = availableServices
      .filter((s) => selectedServiceIds.includes(s.id))
      .map((s) => s.label);
    if (!labels.length) return "";
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} + ${labels.length - 2} autres`;
  }, [availableServices, selectedServiceIds]);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const titre = ((formData.get("titre") as string) || "").trim() || null;
    const devise = ((formData.get("devise") as string) || "").trim() || null;
    const notes_internes =
      ((formData.get("notes_internes") as string) || "").trim() || null;
    const date_prevue_envoi =
      ((formData.get("date_prevue_envoi") as string) || "").trim() || null;
    const url_envoi =
      ((formData.get("url_envoi") as string) || "").trim() || null;

    const service_category_id = selectedCategoryId ?? null;
    const statut = statutValue;

    const montant_ht_one_shot = parseNumber(montantOneShot);
    const montant_ht_mensuel = parseNumber(montantMensuel);


    const date_prevue_facturation_recurrente =
      (
        (formData.get("date_prevue_facturation_recurrente") as string) || ""
      ).trim() || null;

    const montant_ht: number | null = (() => {
      if (billingModel === "one_shot") return montant_ht_one_shot;
      if (billingModel === "recurring") return montant_ht_mensuel;
      return null;
    })();

    if (!titre) {
      toast.error("Titre requis", {
        description: "La proposition doit avoir un titre.",
      });
      return;
    }

    if (!service_category_id) {
      toast.error("Catégorie requise", {
        description: "Choisis une catégorie pour cette proposition.",
      });
      return;
    }

    // validations montants (comme dans le form de création)
    if (billingModel === "one_shot" && montant_ht_one_shot == null) {
      toast.error("Montant requis", {
        description: "Pour un modèle one shot, renseigne le montant HT.",
      });
      return;
    }

    if (billingModel === "recurring" && montant_ht_mensuel == null) {
      toast.error("Montant mensuel requis", {
        description:
          "Pour un modèle récurrent, renseigne le montant HT mensuel.",
      });
      return;
    }

    try {
      setLoading(true);

      // 1) update de la proposition
      const { error } = await supabase
        .from("propositions")
        .update({
          titre,
          devise,
          notes_internes,
          statut,
          date_prevue_envoi,
          url_envoi,
          service_category_id,
          billing_model: billingModel,
          montant_ht,
          montant_ht_one_shot,
          montant_ht_mensuel,
          date_prevue_facturation_recurrente,
        })
        .eq("id", proposition.id);

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la mise à jour de la proposition", {
          description: error.message,
        });
        return;
      }

      // 2) update des services liés
      // on simplifie : delete puis insert
      const { error: deleteError } = await supabase
        .from("proposition_services")
        .delete()
        .eq("proposition_id", proposition.id);

      if (deleteError) {
        console.error(deleteError);
        toast.error(
          "Proposition mise à jour, mais erreur lors de la mise à jour des services",
          { description: deleteError.message }
        );
      } else if (selectedServiceIds.length > 0) {
        const rows = selectedServiceIds.map((serviceId) => ({
          proposition_id: proposition.id,
          service_id: serviceId,
        }));

        const { error: linkError } = await supabase
          .from("proposition_services")
          .insert(rows);

        if (linkError) {
          console.error(linkError);
          toast.error(
            "Proposition mise à jour, mais erreur lors de l'association des services",
            { description: linkError.message }
          );
        }
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
              Mets à jour le titre, la catégorie, les services, le modèle de
              facturation et les informations principales.
            </DialogDescription>
          </DialogHeader>

          {/* même pattern que le form de création : max-h + ScrollArea */}
          <div className="mt-2 flex max-h-[70vh] flex-col">
            <ScrollArea className="min-h-0 flex-1 pr-2">
              <form
                onSubmit={handleUpdate}
                className="space-y-4 pb-4"
                id={`edit-proposition-${proposition.id}`}
              >
                {/* Titre + client (client non éditable) */}
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
                    onValueChange={(value) => {
                      setSelectedCategoryId(value);
                      setSelectedServiceIds([]); // reset services si catégorie change
                    }}
                  >
                    <SelectTrigger id={`service_category_${proposition.id}`}>
                      <SelectValue placeholder="Choisir une catégorie">
                        {selectedCategory && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                              getCategoryBadgeClasses(selectedCategory.slug)
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                getCategoryDotClasses(selectedCategory.slug)
                              )}
                            />
                            <span>{selectedCategory.label}</span>
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                              getCategoryBadgeClasses(cat.slug)
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                getCategoryDotClasses(cat.slug)
                              )}
                            />
                            <span>{cat.label}</span>
                          </span>
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

                {/* Services associés (multi-select) */}
                <div className="grid gap-1.5">
                  <Label>Services associés</Label>

                  <Popover
                    open={servicePopoverOpen}
                    onOpenChange={setServicePopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        disabled={!selectedCategoryId || loadingServices}
                      >
                        {selectedCategoryId
                          ? loadingServices
                            ? "Chargement des services..."
                            : selectedServiceIds.length === 0
                            ? "Sélectionner un ou plusieurs services"
                            : selectedServicesLabels
                          : "Choisis d'abord une catégorie"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0">
                      <Command>
                        <CommandInput
                          className="px-3"
                          placeholder="Rechercher un service..."
                        />
                        <CommandList>
                          <CommandEmpty>
                            {selectedCategoryId
                              ? "Aucun service pour cette catégorie."
                              : "Choisis d'abord une catégorie."}
                          </CommandEmpty>
                          <CommandGroup heading="Services">
                            {availableServices.map((s) => {
                              const isSelected = selectedServiceIds.includes(
                                s.id
                              );
                              return (
                                <CommandItem
                                  key={s.id}
                                  value={s.label}
                                  onSelect={() => {
                                    setSelectedServiceIds((prev) =>
                                      isSelected
                                        ? prev.filter((id) => id !== s.id)
                                        : [...prev, s.id]
                                    );
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      isSelected ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <span>{s.label}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <input
                    type="hidden"
                    name="service_ids"
                    value={selectedServiceIds.join(",")}
                  />

                  {selectedCategoryId &&
                    availableServices.length === 0 &&
                    !loadingServices && (
                      <p className="text-[11px] text-muted-foreground">
                        Aucun service actif rattaché à cette catégorie pour le
                        moment.
                      </p>
                    )}
                </div>

                {/* Modèle de facturation */}
                <div className="grid gap-1.5">
                  <Label htmlFor={`billing_model_${proposition.id}`}>
                    Modèle de facturation
                  </Label>
                  <Select
                    value={billingModel}
                    onValueChange={(value) =>
                      setBillingModel(value as BillingModel)
                    }
                  >
                    <SelectTrigger id={`billing_model_${proposition.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedBillingModels.map((bm) => (
                        <SelectItem key={bm} value={bm}>
                          {BILLING_MODEL_LABEL[bm]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Montants selon le modèle */}
                {billingModel === "one_shot" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 grid gap-1.5">
                      <Label htmlFor={`montant_one_shot_${proposition.id}`}>
                        Montant HT (one shot)
                      </Label>
                      <Input
                        id={`montant_one_shot_${proposition.id}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={montantOneShot}
                        onChange={(e) => setMontantOneShot(e.target.value)}
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
                )}

                {billingModel === "recurring" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 grid gap-1.5">
                      <Label htmlFor={`montant_mensuel_${proposition.id}`}>
                        Montant HT mensuel
                      </Label>
                      <Input
                        id={`montant_mensuel_${proposition.id}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={montantMensuel}
                        onChange={(e) => setMontantMensuel(e.target.value)}
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
                )}

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
                      Ajoute ici le lien WeTransfer / Drive des documents
                      envoyés au client.
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
                      <SelectItem value="en_attente_retour">
                        En attente retour
                      </SelectItem>
                      <SelectItem value="acceptee">Acceptée</SelectItem>
                      <SelectItem value="refusee">Refusée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes internes */}
                <div className="grid gap-1.5">
                  <Label htmlFor={`notes_${proposition.id}`}>
                    Notes internes
                  </Label>
                  <Textarea
                    id={`notes_${proposition.id}`}
                    name="notes_internes"
                    defaultValue={proposition.notes_internes ?? ""}
                    placeholder="Contexte, objections, next steps..."
                    rows={4}
                  />
                </div>
              </form>
            </ScrollArea>

            {/* Footer fixe (comme pour la création) */}
            <DialogFooter className="mt-2 flex shrink-0 justify-end gap-2 bg-background pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenEdit(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form={`edit-proposition-${proposition.id}`}
                disabled={loading}
              >
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
