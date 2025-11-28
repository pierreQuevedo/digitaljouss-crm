// // components/contrats-conception-web/contrats-conception-web-table.tsx
// "use client";

// import { useCallback, useEffect, useState } from "react";

// import {
//   type ColumnDef,
//   type ColumnFiltersState,
//   type FilterFn,
//   flexRender,
//   getCoreRowModel,
//   getFilteredRowModel,
//   getPaginationRowModel,
//   getSortedRowModel,
//   type SortingState,
//   useReactTable,
//   type VisibilityState,
// } from "@tanstack/react-table";

// import {
//   ChevronDownIcon,
//   ChevronLeftIcon,
//   ChevronRightIcon,
//   ChevronUpIcon,
//   ChevronFirstIcon,
//   ChevronLastIcon,
//   Columns3Icon,
// } from "lucide-react";

// import { createClient } from "@/lib/supabase/client";
// import { cn } from "@/lib/utils";
// import { toast } from "sonner";

// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
//   DropdownMenuItem,
// } from "@/components/ui/dropdown-menu";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";

// import { ContratConceptionWebActions } from "@/components/contrats-propos/contrats-conception-web/contrat-conception-web-actions";

// // ---------- Types ----------

// type StatutContrat =
//   | "brouillon"
//   | "en_attente_signature"
//   | "signe"
//   | "en_cours"
//   | "termine"
//   | "annule";

// /**
//  * Shape EXACTEMENT conforme à ton JSON brut (ce qui sort du SQL 3/)
//  */
// type DbContratRow = {
//   id: string;
//   proposition_id: string;
//   client_id: string;
//   titre: string;
//   description: string | null;
//   montant_ht: string; // numeric renvoyé en string par Postgres
//   tva_rate: string;
//   montant_ttc: string | null;
//   devise: string | null;
//   date_signature: string | null;
//   devis_pdf_path: string | null;
//   devis_signe_pdf_path: string | null;
//   facture_pdf_path: string | null;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;
//   contrat_statut: StatutContrat;

//   client_nom_affichage: string | null;
//   client_nom_legal: string | null;

//   proposition_titre: string | null;
//   proposition_statut: string | null;
//   proposition_service_category_id: string | null;
//   proposition_service_category_slug: string | null;
//   proposition_service_category_label: string | null;
// };

// /**
//  * Row utilisée par le front (valeurs numériques déjà parsées, noms simplifiés).
//  */
// export type ContratRow = {
//   id: string;
//   proposition_id: string;
//   client_id: string;

//   titre: string;
//   description: string | null;

//   statut: StatutContrat;

//   montant_ht: number | null;
//   tva_rate: number | null;
//   montant_ttc: number | null;
//   devise: string | null;
//   date_signature: string | null;
//   created_at: string;
//   updated_at: string;
//   deleted_at: string | null;

//   client_nom_affichage: string | null;
//   client_nom_legal: string | null;

//   proposition_titre: string | null;
//   proposition_statut: string | null;

//   service_category_id: string | null;
//   service_category_slug: string | null;
//   service_category_label: string | null;
// };

// // ---------- Styles catégorie (mêmes que propositions) ----------

// const CATEGORY_COLORS: Record<string, { badge: string; dot: string }> = {
//   "strategie-digitale": {
//     badge: "bg-sky-100 text-sky-800 border-sky-200",
//     dot: "bg-sky-500",
//   },
//   "direction-artistique": {
//     badge: "bg-rose-100 text-rose-800 border-rose-200",
//     dot: "bg-rose-500",
//   },
//   "conception-web": {
//     badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
//     dot: "bg-emerald-500",
//   },
//   "social-media-management": {
//     badge: "bg-amber-100 text-amber-800 border-amber-200",
//     dot: "bg-amber-500",
//   },
// };

// function getCategoryBadgeClasses(slug?: string | null) {
//   if (!slug) {
//     return "bg-slate-100 text-slate-700 border-slate-200";
//   }
//   return (
//     CATEGORY_COLORS[slug]?.badge ??
//     "bg-slate-100 text-slate-700 border-slate-200"
//   );
// }

// function getCategoryDotClasses(slug?: string | null) {
//   if (!slug) {
//     return "bg-slate-500";
//   }
//   return CATEGORY_COLORS[slug]?.dot ?? "bg-slate-500";
// }

// // filtre global (titre + client + catégorie)
// const multiColumnFilterFn: FilterFn<ContratRow> = (
//   row,
//   _columnId,
//   filterValue,
// ) => {
//   const search = String(filterValue ?? "")
//     .toLowerCase()
//     .trim();
//   if (!search) return true;

//   const c = row.original;

//   const content = [
//     c.titre ?? "",
//     c.client_nom_affichage ?? "",
//     c.client_nom_legal ?? "",
//     c.service_category_label ?? "",
//   ]
//     .join(" ")
//     .toLowerCase();

//   return content.includes(search);
// };

// const pageSizeOptions = [5, 10, 25, 50];

// const STATUT_LABEL: Record<StatutContrat, string> = {
//   brouillon: "Brouillon",
//   en_attente_signature: "En attente signature",
//   signe: "Signé",
//   en_cours: "En cours",
//   termine: "Terminé",
//   annule: "Annulé",
// };

// type ContratsConceptionWebTableProps = {
//   className?: string;
// };

// export function ContratsConceptionWebTable({
//   className,
// }: ContratsConceptionWebTableProps) {
//   const supabase = createClient();
//   const [data, setData] = useState<ContratRow[]>([]);
//   const [loading, setLoading] = useState(false);

//   const [sorting, setSorting] = useState<SortingState>([
//     { id: "created_at", desc: true },
//   ]);
//   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
//   const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
//   const [pagination, setPagination] = useState({
//     pageIndex: 0,
//     pageSize: 10,
//   });

//   const [searchValue, setSearchValue] = useState("");

//   // filtre statut
//   const [statutFilter, setStatutFilter] = useState<StatutContrat | "all">(
//     "all",
//   );

//   const fetchContrats = useCallback(async () => {
//     setLoading(true);

//     // ⚠️ Remplace "contrats_conception_web_view" par le nom réel de ta vue / table enrichie
//     const { data, error } = await supabase
//       .from("contrats_conception_web_view")
//       .select("*")
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error(error);
//       toast.error("Erreur lors du chargement des contrats", {
//         description: error.message,
//       });
//       setLoading(false);
//       return;
//     }

//     const raw = (data ?? []) as DbContratRow[];

//     const mapped: ContratRow[] = raw.map((row) => {
//       const montant_ht =
//         row.montant_ht != null ? Number(row.montant_ht) : null;
//       const tva_rate =
//         row.tva_rate != null ? Number(row.tva_rate) : null;
//       const montant_ttc =
//         row.montant_ttc != null ? Number(row.montant_ttc) : null;

//       return {
//         id: row.id,
//         proposition_id: row.proposition_id,
//         client_id: row.client_id,
//         titre: row.titre,
//         description: row.description,
//         statut: row.contrat_statut,
//         montant_ht,
//         tva_rate,
//         montant_ttc,
//         devise: row.devise,
//         date_signature: row.date_signature,
//         created_at: row.created_at,
//         updated_at: row.updated_at,
//         deleted_at: row.deleted_at,
//         client_nom_affichage: row.client_nom_affichage,
//         client_nom_legal: row.client_nom_legal,
//         proposition_titre: row.proposition_titre,
//         proposition_statut: row.proposition_statut,
//         service_category_id: row.proposition_service_category_id,
//         service_category_slug: row.proposition_service_category_slug,
//         service_category_label: row.proposition_service_category_label,
//       };
//     });

//     setData(mapped);
//     setLoading(false);
//   }, [supabase]);

//   useEffect(() => {
//     void fetchContrats();
//   }, [fetchContrats]);

//   // filtrage local par statut
//   const filteredData =
//     statutFilter === "all"
//       ? data
//       : data.filter((c) => c.statut === statutFilter);

//   const columns: ColumnDef<ContratRow>[] = [
//     {
//       header: "Contrat",
//       accessorKey: "titre",
//       cell: ({ row }) => {
//         const c = row.original;
//         return (
//           <div className="flex flex-col">
//             <span className="text-sm font-medium">
//               {c.titre || "Sans titre"}
//             </span>
//             <span className="text-xs text-muted-foreground">
//               {c.client_nom_affichage ||
//                 c.client_nom_legal ||
//                 "Client inconnu"}
//             </span>
//           </div>
//         );
//       },
//       filterFn: multiColumnFilterFn,
//       size: 260,
//       enableHiding: false,
//     },
//     {
//       header: "Catégorie",
//       accessorKey: "service_category_label",
//       cell: ({ row }) => {
//         const { service_category_label: label, service_category_slug: slug } =
//           row.original;

//         if (!label) {
//           return (
//             <span className="text-xs text-muted-foreground">Non définie</span>
//           );
//         }

//         return (
//           <span
//             className={cn(
//               "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
//               getCategoryBadgeClasses(slug),
//             )}
//           >
//             <span
//               className={cn(
//                 "inline-block h-1.5 w-1.5 rounded-full",
//                 getCategoryDotClasses(slug),
//               )}
//             />
//             <span>{label}</span>
//           </span>
//         );
//       },
//       size: 190,
//     },
//     {
//       header: "Statut",
//       accessorKey: "statut",
//       cell: ({ row }) => {
//         const s = row.original.statut;
//         return (
//           <span className="text-xs text-muted-foreground">
//             {STATUT_LABEL[s]}
//           </span>
//         );
//       },
//       size: 160,
//     },
//     {
//       header: "Montant HT",
//       accessorKey: "montant_ht",
//       cell: ({ row }) => {
//         const montant = row.original.montant_ht;
//         const devise = row.original.devise ?? "EUR";
//         if (montant == null) {
//           return <span className="text-xs text-muted-foreground">—</span>;
//         }
//         return (
//           <span className="text-xs">
//             {montant.toLocaleString("fr-FR", {
//               minimumFractionDigits: 2,
//               maximumFractionDigits: 2,
//             })}{" "}
//             {devise}
//           </span>
//         );
//       },
//       size: 130,
//     },
//     {
//       header: "Créé le",
//       accessorKey: "created_at",
//       cell: ({ row }) => {
//         const d = new Date(row.original.created_at);
//         return <span className="text-xs">{d.toLocaleDateString("fr-FR")}</span>;
//       },
//       size: 110,
//     },
//     {
//       id: "actions",
//       header: "",
//       cell: ({ row }) => (
//         <ContratConceptionWebActions
//           contrat={row.original}
//           onUpdated={fetchContrats}
//         />
//       ),
//       size: 60,
//       enableHiding: false,
//       enableSorting: false,
//     },
//   ];

//   const table = useReactTable({
//     data: filteredData,
//     columns,
//     getCoreRowModel: getCoreRowModel(),
//     getSortedRowModel: getSortedRowModel(),
//     getFilteredRowModel: getFilteredRowModel(),
//     getPaginationRowModel: getPaginationRowModel(),
//     state: {
//       sorting,
//       columnFilters,
//       columnVisibility,
//       pagination,
//     },
//     onSortingChange: setSorting,
//     onColumnFiltersChange: setColumnFilters,
//     onColumnVisibilityChange: setColumnVisibility,
//     onPaginationChange: setPagination,
//     enableSortingRemoval: false,
//   });

//   const handleClearSearch = () => {
//     table.getColumn("titre")?.setFilterValue("");
//     setSearchValue("");
//   };

//   const totalFiltered = filteredData.length;

//   return (
//     <div className={cn("flex flex-col gap-3", className)}>
//       {/* Barre de recherche & filtres */}
//       <div className="flex flex-wrap items-center gap-3">
//         <div className="flex w-full max-w-xs items-center gap-2">
//           <Input
//             placeholder="Rechercher (titre, client, catégorie...)"
//             aria-label="Rechercher un contrat"
//             value={searchValue}
//             onChange={(e) => {
//               const v = e.target.value;
//               setSearchValue(v);
//               table.getColumn("titre")?.setFilterValue(v);
//             }}
//           />
//           {Boolean(searchValue) && (
//             <Button
//               variant="ghost"
//               size="icon"
//               type="button"
//               onClick={handleClearSearch}
//             >
//               ×
//             </Button>
//           )}
//         </div>

//         {/* Filtre statut (simple) */}
//         <Select
//           value={statutFilter}
//           onValueChange={(value) =>
//             setStatutFilter(value as StatutContrat | "all")
//           }
//         >
//           <SelectTrigger className="h-8 w-[190px] text-xs">
//             <SelectValue placeholder="Tous les statuts" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="all">Tous les statuts</SelectItem>
//             <SelectItem value="brouillon">{STATUT_LABEL.brouillon}</SelectItem>
//             <SelectItem value="en_attente_signature">
//               {STATUT_LABEL.en_attente_signature}
//             </SelectItem>
//             <SelectItem value="signe">{STATUT_LABEL.signe}</SelectItem>
//             <SelectItem value="en_cours">{STATUT_LABEL.en_cours}</SelectItem>
//             <SelectItem value="termine">{STATUT_LABEL.termine}</SelectItem>
//             <SelectItem value="annule">{STATUT_LABEL.annule}</SelectItem>
//           </SelectContent>
//         </Select>

//         {/* Colonnes visibles */}
//         <DropdownMenu>
//           <DropdownMenuTrigger asChild>
//             <Button
//               variant="outline"
//               size="sm"
//               className="inline-flex items-center gap-2"
//             >
//               <Columns3Icon className="h-4 w-4" />
//               Colonnes
//             </Button>
//           </DropdownMenuTrigger>
//           <DropdownMenuContent align="start" className="w-52">
//             <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
//             <DropdownMenuSeparator />
//             {table
//               .getAllLeafColumns()
//               .filter((col) => col.getCanHide())
//               .map((column) => (
//                 <DropdownMenuItem
//                   key={column.id}
//                   className="flex items-center gap-2"
//                   onClick={() =>
//                     column.toggleVisibility(!column.getIsVisible())
//                   }
//                 >
//                   <input
//                     type="checkbox"
//                     className="h-3 w-3"
//                     checked={column.getIsVisible()}
//                     readOnly
//                   />
//                   <span className="text-xs">{column.id}</span>
//                 </DropdownMenuItem>
//               ))}
//           </DropdownMenuContent>
//         </DropdownMenu>
//       </div>

//       {/* Table */}
//       <div className="overflow-hidden rounded-md border bg-card">
//         <Table>
//           <TableHeader>
//             {table.getHeaderGroups().map((headerGroup) => (
//               <TableRow key={headerGroup.id} className="bg-muted/40">
//                 {headerGroup.headers.map((header) => {
//                   if (header.isPlaceholder) return null;

//                   const canSort = header.column.getCanSort();
//                   const sorted = header.column.getIsSorted() as
//                     | "asc"
//                     | "desc"
//                     | false;

//                   const headerContent = flexRender(
//                     header.column.columnDef.header,
//                     header.getContext(),
//                   );

//                   return (
//                     <TableHead
//                       key={header.id}
//                       className={cn("whitespace-nowrap text-xs font-medium")}
//                     >
//                       {canSort ? (
//                         <button
//                           type="button"
//                           className="inline-flex items-center gap-1"
//                           onClick={header.column.getToggleSortingHandler()}
//                         >
//                           {headerContent}
//                           {sorted === "asc" && (
//                             <ChevronUpIcon className="h-3 w-3" />
//                           )}
//                           {sorted === "desc" && (
//                             <ChevronDownIcon className="h-3 w-3" />
//                           )}
//                         </button>
//                       ) : (
//                         headerContent
//                       )}
//                     </TableHead>
//                   );
//                 })}
//               </TableRow>
//             ))}
//           </TableHeader>

//           <TableBody>
//             {loading ? (
//               <TableRow>
//                 <TableCell
//                   colSpan={columns.length}
//                   className="py-8 text-center text-sm"
//                 >
//                   Chargement des contrats...
//                 </TableCell>
//               </TableRow>
//             ) : table.getRowModel().rows.length ? (
//               table.getRowModel().rows.map((row) => (
//                 <TableRow key={row.id}>
//                   {row.getVisibleCells().map((cell) => (
//                     <TableCell key={cell.id} className="align-middle">
//                       {flexRender(
//                         cell.column.columnDef.cell,
//                         cell.getContext(),
//                       )}
//                     </TableCell>
//                   ))}
//                 </TableRow>
//               ))
//             ) : (
//               <TableRow>
//                 <TableCell
//                   colSpan={columns.length}
//                   className="py-8 text-center text-sm"
//                 >
//                   Aucun contrat de conception web pour le moment.
//                 </TableCell>
//               </TableRow>
//             )}
//           </TableBody>
//         </Table>
//       </div>

//       {/* Pagination */}
//       <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
//         <div className="flex items-center gap-2">
//           <span>Résultats par page</span>
//           <Select
//             value={String(pagination.pageSize)}
//             onValueChange={(value) =>
//               setPagination((prev) => ({
//                 ...prev,
//                 pageSize: Number(value),
//                 pageIndex: 0,
//               }))
//             }
//           >
//             <SelectTrigger className="h-8 w-[80px]">
//               <SelectValue />
//             </SelectTrigger>
//             <SelectContent>
//               {pageSizeOptions.map((size) => (
//                 <SelectItem key={String(size)} value={String(size)}>
//                   {size}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>

//         <div className="flex items-center gap-2">
//           <span>
//             {totalFiltered === 0
//               ? "0–0"
//               : `${pagination.pageIndex * pagination.pageSize + 1}–${Math.min(
//                   (pagination.pageIndex + 1) * pagination.pageSize,
//                   totalFiltered,
//                 )}`}{" "}
//             sur {totalFiltered}
//           </span>

//           <div className="flex items-center gap-1">
//             <Button
//               variant="outline"
//               size="icon"
//               className="h-8 w-8"
//               onClick={() => table.setPageIndex(0)}
//               disabled={!table.getCanPreviousPage()}
//             >
//               <ChevronFirstIcon className="h-3 w-3" />
//             </Button>
//             <Button
//               variant="outline"
//               size="icon"
//               className="h-8 w-8"
//               onClick={() => table.previousPage()}
//               disabled={!table.getCanPreviousPage()}
//             >
//               <ChevronLeftIcon className="h-3 w-3" />
//             </Button>
//             <Button
//               variant="outline"
//               size="icon"
//               className="h-8 w-8"
//               onClick={() => table.nextPage()}
//               disabled={!table.getCanNextPage()}
//             >
//               <ChevronRightIcon className="h-3 w-3" />
//             </Button>
//             <Button
//               variant="outline"
//               size="icon"
//               className="h-8 w-8"
//               onClick={() =>
//                 table.setPageIndex(Math.max(table.getPageCount() - 1, 0))
//               }
//               disabled={!table.getCanNextPage()}
//             >
//               <ChevronLastIcon className="h-3 w-3" />
//             </Button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }