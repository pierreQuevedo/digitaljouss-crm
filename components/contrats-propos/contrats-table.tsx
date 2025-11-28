"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatutContrat =
  | "brouillon"
  | "en_attente_signature"
  | "signe"
  | "en_cours"
  | "termine"
  | "annule";

type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
};

type ContratRow = {
  id: string;
  proposition_id: string;
  client_id: string;

  titre: string;
  description: string | null;
  statut: StatutContrat;

  montant_ht: number | null;
  tva_rate: number | null;
  devise: string | null;

  created_at: string;
  date_signature: string | null;

  client_nom_affichage: string | null;
  client_nom_legal: string | null;

  proposition_titre: string | null;

  service_category: ServiceCategory | null;
  service_category_slug: string | null;
  service_category_label: string | null;
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

type DbPropositionFromJoin = {
  titre: string | null;
  service_category:
    | DbServiceCategoryFromJoin
    | DbServiceCategoryFromJoin[]
    | null;
};

type DbContratRow = {
  id: string;
  proposition_id: string;
  client_id: string;

  titre: string;
  description: string | null;
  statut: StatutContrat;

  montant_ht: string | number | null;
  tva_rate: string | number | null;
  devise: string | null;

  created_at: string;
  date_signature: string | null;

  client: DbClientFromJoin | DbClientFromJoin[] | null;
  proposition: DbPropositionFromJoin | DbPropositionFromJoin[] | null;
};

const supabase = createClient();

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

const STATUT_LABEL: Record<StatutContrat, string> = {
  brouillon: "Brouillon",
  en_attente_signature: "En attente signature",
  signe: "Signé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

type ContratsTableProps = {
  className?: string;
};

export function ContratsTable({ className }: ContratsTableProps) {
  const [data, setData] = useState<ContratRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [statutFilter, setStatutFilter] = useState<StatutContrat | "all">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");

  // 👉 pageSize 50 par défaut pour éviter de cacher des contrats
  const [pageSize, setPageSize] = useState<number>(50);
  const [pageIndex, setPageIndex] = useState<number>(0);

  useEffect(() => {
    const fetchContrats = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("contrats")
        .select(
          `
          id,
          proposition_id,
          client_id,
          titre,
          description,
          statut,
          montant_ht,
          tva_rate,
          devise,
          created_at,
          date_signature,

          client:client_id (
            nom_affichage,
            nom_legal
          ),

          proposition:proposition_id (
            titre,
            service_category:service_category_id (
              id,
              slug,
              label
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des contrats", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      const raw = (data ?? []) as unknown as DbContratRow[];

      const mapped: ContratRow[] = raw.map((row) => {
        const clientJoined: DbClientFromJoin | null = Array.isArray(row.client)
          ? row.client[0] ?? null
          : row.client;

        const propositionJoined: DbPropositionFromJoin | null = Array.isArray(
          row.proposition,
        )
          ? row.proposition[0] ?? null
          : row.proposition;

        const catJoined: DbServiceCategoryFromJoin | null =
          propositionJoined && propositionJoined.service_category
            ? Array.isArray(propositionJoined.service_category)
              ? propositionJoined.service_category[0] ?? null
              : propositionJoined.service_category
            : null;

        return {
          id: row.id,
          proposition_id: row.proposition_id,
          client_id: row.client_id,

          titre: row.titre,
          description: row.description ?? null,
          statut: row.statut,

          montant_ht:
            row.montant_ht == null
              ? null
              : typeof row.montant_ht === "number"
                ? row.montant_ht
                : Number(row.montant_ht),
          tva_rate:
            row.tva_rate == null
              ? null
              : typeof row.tva_rate === "number"
                ? row.tva_rate
                : Number(row.tva_rate),
          devise: row.devise ?? "EUR",

          created_at: row.created_at,
          date_signature: row.date_signature,

          client_nom_affichage: clientJoined?.nom_affichage ?? null,
          client_nom_legal: clientJoined?.nom_legal ?? null,

          proposition_titre: propositionJoined?.titre ?? null,

          service_category: catJoined
            ? {
                id: catJoined.id,
                slug: catJoined.slug,
                label: catJoined.label,
              }
            : null,
          service_category_slug: catJoined?.slug ?? null,
          service_category_label: catJoined?.label ?? null,
        };
      });

      setData(mapped);
      setLoading(false);
    };

    void fetchContrats();
  }, []);

  // 👉 dès qu’on change recherche / filtre, on revient à la page 1
  useEffect(() => {
    setPageIndex(0);
  }, [searchValue, statutFilter, categoryFilter, pageSize]);

  const filteredData = useMemo(() => {
    const search = searchValue.toLowerCase().trim();

    return data.filter((c) => {
      if (statutFilter !== "all" && c.statut !== statutFilter) {
        return false;
      }
      if (
        categoryFilter !== "all" &&
        c.service_category_slug !== categoryFilter
      ) {
        return false;
      }

      if (!search) return true;

      const content = [
        c.titre ?? "",
        c.description ?? "",
        c.client_nom_affichage ?? "",
        c.client_nom_legal ?? "",
        c.service_category_label ?? "",
        c.proposition_titre ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(search);
    });
  }, [data, searchValue, statutFilter, categoryFilter]);

  const totalFiltered = filteredData.length;

  const pageData = useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, pageIndex, pageSize]);

  const handleClearSearch = () => {
    setSearchValue("");
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de recherche & filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            placeholder="Rechercher (titre, client, catégorie...)"
            aria-label="Rechercher un contrat"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
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

        {/* Filtre statut */}
        <Select
          value={statutFilter}
          onValueChange={(value) =>
            setStatutFilter(value as StatutContrat | "all")
          }
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="brouillon">{STATUT_LABEL.brouillon}</SelectItem>
            <SelectItem value="en_attente_signature">
              {STATUT_LABEL.en_attente_signature}
            </SelectItem>
            <SelectItem value="signe">{STATUT_LABEL.signe}</SelectItem>
            <SelectItem value="en_cours">{STATUT_LABEL.en_cours}</SelectItem>
            <SelectItem value="termine">{STATUT_LABEL.termine}</SelectItem>
            <SelectItem value="annule">{STATUT_LABEL.annule}</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtre catégorie simple */}
        <Select
          value={categoryFilter}
          onValueChange={(value) =>
            setCategoryFilter(value as string | "all")
          }
        >
          <SelectTrigger className="h-8 w-[210px] text-xs">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            <SelectItem value="conception-web">Conception web</SelectItem>
            <SelectItem value="direction-artistique">
              Direction artistique
            </SelectItem>
            <SelectItem value="social-media-management">
              Social media management
            </SelectItem>
            <SelectItem value="strategie-digitale">
              Stratégie digitale
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Contrat
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Catégorie
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Statut
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Montant HT
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Signature
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Créé le
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Chargement des contrats...
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucun contrat pour le moment.
                </td>
              </tr>
            ) : (
              pageData.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {c.titre || "Sans titre"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.client_nom_affichage ||
                          c.client_nom_legal ||
                          "Client inconnu"}
                      </span>
                      {c.proposition_titre && (
                        <span className="text-[11px] text-muted-foreground">
                          Propal : {c.proposition_titre}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {c.service_category_label ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                          getCategoryBadgeClasses(c.service_category_slug),
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            getCategoryDotClasses(c.service_category_slug),
                          )}
                        />
                        <span>{c.service_category_label}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Non définie
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
                    {STATUT_LABEL[c.statut]}
                  </td>
                  <td className="px-3 py-2 align-middle text-xs">
                    {c.montant_ht == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        {c.montant_ht.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {c.devise ?? "EUR"}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle text-xs">
                    {c.date_signature ? (
                      new Date(c.date_signature).toLocaleDateString("fr-FR")
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle text-xs">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Résultats par page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
            }}
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
            {totalFiltered === 0
              ? "0–0"
              : `${pageIndex * pageSize + 1}–${Math.min(
                  (pageIndex + 1) * pageSize,
                  totalFiltered,
                )}`}{" "}
            sur {totalFiltered}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
            >
              {"<<"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
            >
              {"<"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setPageIndex((prev) =>
                  (prev + 1) * pageSize >= totalFiltered
                    ? prev
                    : prev + 1,
                )
              }
              disabled={(pageIndex + 1) * pageSize >= totalFiltered}
            >
              {">"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setPageIndex(
                  Math.max(Math.ceil(totalFiltered / pageSize) - 1, 0),
                )
              }
              disabled={(pageIndex + 1) * pageSize >= totalFiltered}
            >
              {">>"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}