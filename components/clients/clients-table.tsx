// components/clients/clients-table.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ListFilterIcon,
  Columns3Icon,
  EllipsisVerticalIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";

// ---------- Types services actifs ----------

type ServiceFamilyKey =
  | "strategie_digitale"
  | "direction_artistique"
  | "conception_web"
  | "social_media_management";

type ServicesActifs = Partial<Record<ServiceFamilyKey, Record<string, boolean>>>;

type ServiceItem = {
  label: string;
  value: string; // ex: "strategie_digitale.audit"
};

// définition des services possibles
const SERVICE_ITEMS: ServiceItem[] = [
  // Stratégie digitale
  { label: "Stratégie • Audit", value: "strategie_digitale.audit" },
  { label: "Stratégie • Process", value: "strategie_digitale.process" },
  { label: "Stratégie • SEO", value: "strategie_digitale.seo" },
  { label: "Stratégie • SEA", value: "strategie_digitale.sea" },
  { label: "Stratégie • SMO", value: "strategie_digitale.smo" },
  { label: "Stratégie • SMA", value: "strategie_digitale.sma" },

  // Direction artistique
  {
    label: "DA • Identité visuelle",
    value: "direction_artistique.identite_visuelle",
  },
  { label: "DA • Print", value: "direction_artistique.print" },
  { label: "DA • UI / UX design", value: "direction_artistique.ui_ux_design" },
  { label: "DA • Motion design", value: "direction_artistique.motion_design" },

  // Conception web
  { label: "Web • Landing page", value: "conception_web.landing_page" },
  { label: "Web • Site vitrine", value: "conception_web.site_vitrine" },
  { label: "Web • E-commerce", value: "conception_web.ecommerce" },
  { label: "Web • Application", value: "conception_web.application" },
  { label: "Web • Plateforme", value: "conception_web.plateforme" },
  { label: "Web • Appel d’offres", value: "conception_web.appel_offres" },

  // Social media management
  {
    label: "Social • Réseaux sociaux",
    value: "social_media_management.reseaux_sociaux",
  },
  { label: "Social • Réels", value: "social_media_management.reels" },
  { label: "Social • Vidéos", value: "social_media_management.videos" },
  { label: "Social • Photos", value: "social_media_management.photos" },
];

const SERVICE_ITEM_MAP = new Map<string, ServiceItem>(
  SERVICE_ITEMS.map((item) => [item.value, item]),
);

// ---------- Type de ligne ----------

type ClientRow = {
  id: string;
  nom_affichage: string;
  nom_legal: string;
  email_general: string | null;
  site_web_principal: string | null;
  statut_client:
    | "prospect"
    | "propo_envoyee"
    | "client_actif"
    | "client_inactif"
    | "perdu"
    | "propo_refusee";
  origine_lead:
    | "inbound"
    | "recommandation"
    | "appel_offres"
    | "linkedin"
    | null;
  ca_total_ht: number | null;
  created_at: string;
  services_actifs: ServicesActifs | null;
};

const statutLabel: Record<ClientRow["statut_client"], string> = {
  prospect: "Prospect",
  propo_envoyee: "Propo envoyée",
  client_actif: "Client actif",
  client_inactif: "Client inactif",
  perdu: "Perdu",
  propo_refusee: "Propo refusée",
};

function statutColor(statut: ClientRow["statut_client"]) {
  switch (statut) {
    case "client_actif":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "propo_envoyee":
    case "propo_refusee":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "perdu":
      return "bg-red-50 text-red-700 border-red-200";
    case "client_inactif":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "prospect":
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

const origineLabel: Record<NonNullable<ClientRow["origine_lead"]>, string> = {
  inbound: "Inbound",
  recommandation: "Recommandation",
  appel_offres: "Appel d’offres",
  linkedin: "LinkedIn",
};

// ---------- Services actifs : familles & helpers ----------

const SERVICE_FAMILIES: {
  key: ServiceFamilyKey;
  label: string;
  className: string;
}[] = [
  {
    key: "strategie_digitale",
    label: "Stratégie",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    key: "direction_artistique",
    label: "DA",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    key: "conception_web",
    label: "Web",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    key: "social_media_management",
    label: "Social",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

function getActiveServiceFamilies(
  services: ServicesActifs | null | undefined,
) {
  if (!services) return [] as ServiceFamilyKey[];

  const active: ServiceFamilyKey[] = [];

  for (const family of SERVICE_FAMILIES) {
    const group = services[family.key];
    if (!group) continue;

    const hasTrue = Object.values(group).some(Boolean);
    if (hasTrue) active.push(family.key);
  }

  return active;
}

// convertir JSON -> items sélectionnés
function servicesActifsToItems(
  services: ServicesActifs | null | undefined,
): ServiceItem[] {
  if (!services) return [];
  const result: ServiceItem[] = [];

  for (const family of Object.keys(services) as ServiceFamilyKey[]) {
    const group = services[family];
    if (!group) continue;

    for (const [key, value] of Object.entries(group)) {
      if (!value) continue;
      const val = `${family}.${key}`;
      const mapped = SERVICE_ITEM_MAP.get(val);
      if (mapped) {
        result.push(mapped);
      }
    }
  }

  return result;
}

function parseServiceValue(
  value: string,
): { family: ServiceFamilyKey; key: string } | null {
  const [family, key] = value.split(".");
  if (!family || !key) return null;
  if (
    family !== "strategie_digitale" &&
    family !== "direction_artistique" &&
    family !== "conception_web" &&
    family !== "social_media_management"
  ) {
    return null;
  }
  return { family: family as ServiceFamilyKey, key };
}

function buildServicesActifsFromItems(items: ServiceItem[]): ServicesActifs {
  const result: ServicesActifs = {};

  for (const item of items) {
    const parsed = parseServiceValue(item.value);
    if (!parsed) continue;
    if (!result[parsed.family]) {
      result[parsed.family] = {};
    }
    result[parsed.family]![parsed.key] = true;
  }

  return result;
}

// ---------- Filtre global nom + email ----------

const multiColumnFilterFn: FilterFn<ClientRow> = (
  row,
  _columnId,
  filterValue,
) => {
  const search = String(filterValue ?? "").toLowerCase();
  if (!search) return true;

  const content = `${row.original.nom_affichage} ${row.original.nom_legal} ${
    row.original.email_general ?? ""
  }`
    .toLowerCase()
    .trim();

  return content.includes(search);
};

// Filtre par statut
const statusFilterFn: FilterFn<ClientRow> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue?.length) return true;
  const status = row.getValue(columnId) as string;
  return filterValue.includes(status);
};

const pageSizeOptions = [5, 10, 25, 50];

export function ClientsTable({
  className,
  refreshToken,
}: {
  className?: string;
  refreshToken?: number;
}) {
  const supabase = createClient();
  const [data, setData] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "nom_affichage", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select(
        `
        id,
        nom_affichage,
        nom_legal,
        email_general,
        site_web_principal,
        statut_client,
        origine_lead,
        ca_total_ht,
        created_at,
        services_actifs
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des clients", {
        description: error.message,
      });
    } else {
      setData((data ?? []) as ClientRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients, refreshToken]);

  const columns: ColumnDef<ClientRow>[] = [
    {
      id: "select",
      header: ({ table }) => {
        const isAllPageSelected = table.getIsAllPageRowsSelected();
        const isSomePageSelected = table.getIsSomePageRowsSelected();
        return (
          <Checkbox
            checked={
              isAllPageSelected || (isSomePageSelected && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Sélectionner toutes les lignes"
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Sélectionner la ligne"
        />
      ),
      size: 32,
      enableSorting: false,
      enableHiding: false,
    },
    {
      header: "Client",
      accessorKey: "nom_affichage",
      cell: ({ row }) => {
        const name = row.original.nom_affichage;
        const legal = row.original.nom_legal;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{name}</span>
            {legal && legal !== name && (
              <span className="text-xs text-muted-foreground">{legal}</span>
            )}
          </div>
        );
      },
      size: 220,
      filterFn: multiColumnFilterFn,
      enableHiding: false,
    },
    {
      header: "Email",
      accessorKey: "email_general",
      cell: ({ row }) => {
        const email = row.original.email_general;
        return (
          <span className="text-xs text-muted-foreground">
            {email || "—"}
          </span>
        );
      },
      size: 220,
    },
    {
      header: "Site",
      accessorKey: "site_web_principal",
      cell: ({ row }) => {
        const url = row.original.site_web_principal;
        if (!url)
          return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            {url.replace(/^https?:\/\//, "")}
          </a>
        );
      },
      size: 220,
    },
    {
      header: "Statut",
      accessorKey: "statut_client",
      cell: ({ row }) => {
        const statut = row.original.statut_client;
        return (
          <Badge
            variant="outline"
            className={cn(
              "border px-2 py-0.5 text-[11px] font-medium",
              statutColor(statut),
            )}
          >
            {statutLabel[statut]}
          </Badge>
        );
      },
      size: 130,
      filterFn: statusFilterFn,
    },
    {
      header: "Origine",
      accessorKey: "origine_lead",
      cell: ({ row }) => {
        const origine = row.original.origine_lead;
        return (
          <span className="text-xs text-muted-foreground">
            {origine ? origineLabel[origine] : "—"}
          </span>
        );
      },
      size: 140,
    },
    {
      header: "Services",
      accessorKey: "services_actifs",
      cell: ({ row }) => {
        const services = row.original.services_actifs;
        const activeFamilies = getActiveServiceFamilies(services);

        if (!activeFamilies.length) {
          return (
            <span className="text-xs text-muted-foreground">
              Aucun
            </span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1">
            {activeFamilies.map((key) => {
              const def = SERVICE_FAMILIES.find((f) => f.key === key);
              if (!def) return null;
              return (
                <Badge
                  key={key}
                  variant="outline"
                  className={cn(
                    "border px-1.5 py-0.5 text-[10px] font-medium",
                    def.className,
                  )}
                >
                  {def.label}
                </Badge>
              );
            })}
          </div>
        );
      },
      size: 200,
    },
    {
      header: "CA total HT",
      accessorKey: "ca_total_ht",
      cell: ({ row }) => {
        const amount = row.original.ca_total_ht ?? 0;
        if (!amount) {
          return (
            <span className="text-xs text-muted-foreground">
              —
            </span>
          );
        }
        const formatted = new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(amount);
        return <span className="text-xs">{formatted}</span>;
      },
      size: 120,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <RowActions row={row} onUpdated={fetchClients} />,
      size: 50,
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

  const uniqueStatusValues = useMemo(() => {
    const values = Array.from(new Set(data.map((d) => d.statut_client)));
    return values.sort();
  }, [data]);

  const statusColumn = table.getColumn("statut_client");
  const selectedStatuses =
    (statusColumn?.getFilterValue() as string[] | undefined) ?? [];

  const handleStatusChange = (checked: boolean, value: string) => {
    if (!statusColumn) return;
    const current = (statusColumn.getFilterValue() as string[]) ?? [];
    const next = checked
      ? [...current, value]
      : current.filter((v) => v !== value);
    statusColumn.setFilterValue(next.length ? next : undefined);
  };

  const handleClearSearch = () => {
    table.getColumn("nom_affichage")?.setFilterValue("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre d’actions & filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Rechercher par nom, email..."
            aria-label="Rechercher un client"
            onChange={(e) =>
              table.getColumn("nom_affichage")?.setFilterValue(e.target.value)
            }
          />
          {Boolean(
            (table.getColumn("nom_affichage")?.getFilterValue() as string) ||
              "",
          ) && (
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

        {/* Filtre statut */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-2"
            >
              <ListFilterIcon className="h-4 w-4" />
              Statuts
              {selectedStatuses.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 text-xs">
                  {selectedStatuses.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Filtrer par statut</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {uniqueStatusValues.map((value) => {
              const label = statutLabel[value as ClientRow["statut_client"]];
              return (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={selectedStatuses.includes(value)}
                  onCheckedChange={(checked) =>
                    handleStatusChange(!!checked, value)
                  }
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

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
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) =>
                    column.toggleVisibility(!!value)
                  }
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
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
                      className={cn(
                        "whitespace-nowrap text-xs font-medium",
                        header.column.id === "select" && "w-[32px]",
                      )}
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
                  className="py-8 text-center"
                >
                  Chargement des clients...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
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
                  className="py-8 text-center"
                >
                  Aucun résultat.
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
                <SelectItem key={size} value={String(size)}>
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

// ————————————————————————————
// RowActions : bouton "..." + sheet Modifier (+ services)
// ————————————————————————————

function RowActions({
  row,
  onUpdated,
}: {
  row: Row<ClientRow>;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const client = row.original;

  const [openEdit, setOpenEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>(() =>
    servicesActifsToItems(client.services_actifs),
  );

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const nom_affichage = (formData.get("nom_affichage") as string)?.trim();
    const nom_legal = (formData.get("nom_legal") as string)?.trim();
    const email_general = (formData.get("email_general") as string) || null;
    const site_web_principal =
      (formData.get("site_web_principal") as string) || null;
    const statut_client =
      (formData.get("statut_client") as ClientRow["statut_client"]) ??
      client.statut_client;
    const origine_lead =
      (formData.get("origine_lead") as ClientRow["origine_lead"]) ??
      client.origine_lead;
    const notes_internes =
      (formData.get("notes_internes") as string) || null;

    if (!nom_affichage || !nom_legal) {
      toast.error("Champs obligatoires manquants", {
        description: "Nom légal et nom d’affichage sont requis.",
      });
      return;
    }

    const services_actifs = buildServicesActifsFromItems(selectedServices);

    try {
      setLoading(true);

      const { error } = await supabase
        .from("clients")
        .update({
          nom_affichage,
          nom_legal,
          email_general,
          site_web_principal,
          statut_client,
          origine_lead,
          notes_internes,
          services_actifs,
        })
        .eq("id", client.id);

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la mise à jour du client", {
          description: error.message,
        });
        return;
      }

      toast.success("Client mis à jour", {
        description: `${nom_affichage} a été modifié.`,
      });

      setOpenEdit(false);
      onUpdated();
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
              aria-label="Actions sur le client"
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

      <Sheet open={openEdit} onOpenChange={setOpenEdit}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-4 sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle>Modifier le client</SheetTitle>
            <SheetDescription>
              Mets à jour les informations principales. Les changements seront
              immédiatement appliqués.
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleUpdate}
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
          >
            {/* Identité */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`nom_affichage-${client.id}`}>
                  Nom d’affichage *
                </Label>
                <Input
                  id={`nom_affichage-${client.id}`}
                  name="nom_affichage"
                  defaultValue={client.nom_affichage}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`nom_legal-${client.id}`}>Nom légal *</Label>
                <Input
                  id={`nom_legal-${client.id}`}
                  name="nom_legal"
                  defaultValue={client.nom_legal}
                  required
                />
              </div>
            </div>

            {/* Coordonnées */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`site_web_${client.id}`}>Site web</Label>
                <Input
                  id={`site_web_${client.id}`}
                  name="site_web_principal"
                  defaultValue={client.site_web_principal ?? ""}
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`email_${client.id}`}>Email général</Label>
                <Input
                  id={`email_${client.id}`}
                  name="email_general"
                  type="email"
                  defaultValue={client.email_general ?? ""}
                  placeholder="contact@exemple.com"
                />
              </div>
            </div>

            {/* CRM + origine */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`statut_${client.id}`}>Statut client</Label>
                <Select
                  name="statut_client"
                  defaultValue={client.statut_client}
                >
                  <SelectTrigger id={`statut_${client.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="propo_envoyee">
                      Proposition envoyée
                    </SelectItem>
                    <SelectItem value="client_actif">Client actif</SelectItem>
                    <SelectItem value="client_inactif">
                      Client inactif
                    </SelectItem>
                    <SelectItem value="perdu">Perdu</SelectItem>
                    <SelectItem value="propo_refusee">
                      Proposition refusée
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`origine_${client.id}`}>Origine du lead</Label>
                <Select
                  name="origine_lead"
                  defaultValue={client.origine_lead ?? undefined}
                >
                  <SelectTrigger id={`origine_${client.id}`}>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="recommandation">
                      Recommandation
                    </SelectItem>
                    <SelectItem value="appel_offres">
                      Appel d’offres
                    </SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Services actifs via Combobox */}
            <Field>
              <FieldLabel>Services actifs</FieldLabel>
              <Combobox
                items={SERVICE_ITEMS}
                multiple
                value={selectedServices}
                onValueChange={(value: ServiceItem[]) =>
                  setSelectedServices(value)
                }
              >
                <ComboboxChips>
                  <ComboboxValue>
                    {(value: ServiceItem[]) => (
                      <>
                        {value?.map((item) => (
                          <ComboboxChip
                            aria-label={item.label}
                            key={item.value}
                          >
                            {item.label}
                          </ComboboxChip>
                        ))}
                        <ComboboxInput
                          aria-label="Sélectionner des services"
                          placeholder={
                            value.length > 0
                              ? undefined
                              : "Sélectionner des services…"
                          }
                        />
                      </>
                    )}
                  </ComboboxValue>
                </ComboboxChips>
                <ComboboxPopup>
                  <ComboboxEmpty>Aucun service trouvé.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: ServiceItem) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
              <FieldDescription>
                Choisis les services que l’agence opère pour ce client.
              </FieldDescription>
            </Field>

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor={`notes_${client.id}`}>Notes internes</Label>
              <Textarea
                id={`notes_${client.id}`}
                name="notes_internes"
                placeholder="Contexte, attentes, points d’attention..."
                defaultValue={""}
                rows={4}
              />
            </div>

            <SheetFooter className="mt-2 flex justify-end gap-2 p-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenEdit(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}