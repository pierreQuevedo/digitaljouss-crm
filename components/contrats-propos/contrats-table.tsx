"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type StatutContrat =
  | "brouillon"
  | "en_attente_signature"
  | "signe"
  | "en_cours"
  | "termine"
  | "annule";

export type BillingModel = "one_shot" | "recurring" | "mixed";

export type BillingPeriod = "one_time" | "monthly" | "quarterly" | "yearly";

export type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
};

export type ContratRow = {
  id: string;
  proposition_id: string;
  client_id: string;

  titre: string;
  description: string | null;
  statut: StatutContrat;

  montant_ht: number | null;
  montant_ht_one_shot: number | null;
  montant_ht_mensuel: number | null;
  tva_rate: number | null;
  montant_ttc: number | null;
  devise: string | null;

  billing_model: BillingModel;
  billing_period: BillingPeriod;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;
  reference_externe: string | null;

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
  montant_ht_one_shot: string | number | null;
  montant_ht_mensuel: string | number | null;
  tva_rate: string | number | null;
  montant_ttc: string | number | null;
  devise: string | null;

  billing_model: BillingModel | null;
  billing_period: BillingPeriod | null;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;
  reference_externe: string | null;

  created_at: string;
  date_signature: string | null;

  client: DbClientFromJoin | DbClientFromJoin[] | null;
  proposition: DbPropositionFromJoin | DbPropositionFromJoin[] | null;
};

/* -------------------------------------------------------------------------- */
/*                              Const/ helpers UI                             */
/* -------------------------------------------------------------------------- */

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

const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  one_shot: "One shot",
  recurring: "Récurrent",
  mixed: "Mixte",
};

const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  one_time: "Ponctuel",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

export type CategoryOption = {
  value: string;
  label: string;
};

/* -------------------------------------------------------------------------- */
/*                               Props du tableau                             */
/* -------------------------------------------------------------------------- */

export type ContratsTableProps = {
  className?: string;

  /** Scope côté SQL (filtre en base) */
  clientId?: string;
  statutIn?: StatutContrat[];
  billingModelIn?: BillingModel[];
  billingPeriodIn?: BillingPeriod[];
  serviceCategoryIdIn?: string;

  /** Valeurs initiales des filtres UI */
  initialStatutFilter?: StatutContrat | "all";
  initialCategoryFilter?: string | "all";
  initialBillingModelFilter?: BillingModel | "all";

  /** Page size par défaut (50 par défaut) */
  defaultPageSize?: number;

  /** Options personnalisées de catégories (sinon fallback sur les 4 standards) */
  categoryOptions?: CategoryOption[];

  /**
   * Montant déjà payé HT par contrat (pour calculer "Reste à charge HT" dans le tableau).
   * Exemple: { [contratId]: 1200.50 }
   */
  paidByContratHt?: Record<string, number>;

  /** Callback quand on clique toute la ligne */
  onRowClick?: (contrat: ContratRow) => void;

  /** Rendu d'une colonne "Actions" personnalisée à droite */
  renderRowActions?: (contrat: ContratRow) => ReactNode;
};

/* -------------------------------------------------------------------------- */
/*                                Composant                                   */
/* -------------------------------------------------------------------------- */

export function ContratsTable({
  className,
  clientId,
  statutIn,
  billingModelIn,
  billingPeriodIn,
  serviceCategoryIdIn,
  initialStatutFilter = "all",
  initialCategoryFilter = "all",
  initialBillingModelFilter = "all",
  defaultPageSize = 50,
  categoryOptions,
  paidByContratHt,
  onRowClick,
  renderRowActions,
}: ContratsTableProps) {
  const [data, setData] = useState<ContratRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [statutFilter, setStatutFilter] = useState<StatutContrat | "all">(
    initialStatutFilter,
  );
  const [categoryFilter, setCategoryFilter] = useState<string | "all">(
    initialCategoryFilter,
  );
  const [billingModelFilter, setBillingModelFilter] = useState<
    BillingModel | "all"
  >(initialBillingModelFilter);

  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // options de catégories (UI) — configurable via props
  const effectiveCategoryOptions: CategoryOption[] = categoryOptions ?? [
    { value: "conception-web", label: "Conception web" },
    { value: "direction-artistique", label: "Direction artistique" },
    { value: "social-media-management", label: "Social media management" },
    { value: "strategie-digitale", label: "Stratégie digitale" },
  ];

  // clés stables pour les useEffect (évite les JSON.stringify dégueu)
  const statutInKey = useMemo(
    () => (statutIn && statutIn.length > 0 ? statutIn.join("|") : ""),
    [statutIn],
  );
  const billingModelInKey = useMemo(
    () =>
      billingModelIn && billingModelIn.length > 0
        ? billingModelIn.join("|")
        : "",
    [billingModelIn],
  );
  const billingPeriodInKey = useMemo(
    () =>
      billingPeriodIn && billingPeriodIn.length > 0
        ? billingPeriodIn.join("|")
        : "",
    [billingPeriodIn],
  );

  /* ------------------------------ fetch contrats ----------------------------- */

  useEffect(() => {
    const fetchContrats = async () => {
      setLoading(true);

      try {
        let query = supabase
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
            montant_ht_one_shot,
            montant_ht_mensuel,
            tva_rate,
            montant_ttc,
            devise,
            billing_model,
            billing_period,
            date_debut,
            date_fin_prevue,
            nb_mois_engagement,
            reference_externe,
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

        // scope backend : filtres "durs"
        if (statutIn && statutIn.length > 0) {
          query = query.in("statut", statutIn);
        }

        if (billingModelIn && billingModelIn.length > 0) {
          query = query.in("billing_model", billingModelIn);
        }

        if (billingPeriodIn && billingPeriodIn.length > 0) {
          query = query.in("billing_period", billingPeriodIn);
        }

        if (clientId) {
          query = query.eq("client_id", clientId);
        }

        if (serviceCategoryIdIn) {
          query = query.eq("service_category_id", serviceCategoryIdIn);
        }

        const { data, error } = await query;

        if (error) {
          console.error(error);
          toast.error("Erreur lors du chargement des contrats", {
            description: error.message,
          });
          setData([]);
          return;
        }

        const raw = (data ?? []) as DbContratRow[];

        const toNumber = (v: string | number | null): number | null => {
          if (v == null) return null;
          if (typeof v === "number") return v;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };

        const mapped: ContratRow[] = raw.map((row) => {
          const clientJoined: DbClientFromJoin | null = Array.isArray(
            row.client,
          )
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

          const montantHt = toNumber(row.montant_ht);
          const montantHtOneShot = toNumber(row.montant_ht_one_shot);
          const montantHtMensuel = toNumber(row.montant_ht_mensuel);
          const tvaRate = toNumber(row.tva_rate);
          const montantTtc = toNumber(row.montant_ttc);

          return {
            id: row.id,
            proposition_id: row.proposition_id,
            client_id: row.client_id,

            titre: row.titre,
            description: row.description ?? null,
            statut: row.statut,

            montant_ht: montantHt,
            montant_ht_one_shot: montantHtOneShot,
            montant_ht_mensuel: montantHtMensuel,
            tva_rate: tvaRate,
            montant_ttc: montantTtc,
            devise: row.devise ?? "EUR",

            billing_model: row.billing_model ?? "one_shot",
            billing_period: row.billing_period ?? "one_time",
            date_debut: row.date_debut,
            date_fin_prevue: row.date_fin_prevue,
            nb_mois_engagement: row.nb_mois_engagement,
            reference_externe: row.reference_externe,

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
      } finally {
        setLoading(false);
      }
    };

    void fetchContrats();
  }, [
    clientId,
    serviceCategoryIdIn,
    statutInKey,
    billingModelInKey,
    billingPeriodInKey,
    statutIn,
    billingModelIn,
    billingPeriodIn,
  ]);

  // dès qu’on change recherche / filtre / pageSize, on revient à la page 1
  useEffect(() => {
    setPageIndex(0);
  }, [searchValue, statutFilter, categoryFilter, billingModelFilter, pageSize]);

  /* ------------------------------ filtres front ------------------------------ */

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

      if (
        billingModelFilter !== "all" &&
        c.billing_model !== billingModelFilter
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
        c.reference_externe ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(search);
    });
  }, [data, searchValue, statutFilter, categoryFilter, billingModelFilter]);

  const totalFiltered = filteredData.length;

  const pageData = useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, pageIndex, pageSize]);

  const handleClearSearch = () => {
    setSearchValue("");
  };

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de recherche & filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            placeholder="Rechercher (titre, client, catégorie, réf. externe...)"
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

        {/* Filtre catégorie */}
        <Select
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value as string | "all")}
        >
          <SelectTrigger className="h-8 w-[210px] text-xs">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {effectiveCategoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtre modèle de facturation (one shot / RMM / mixte) */}
        <Select
          value={billingModelFilter}
          onValueChange={(value) =>
            setBillingModelFilter(value as BillingModel | "all")
          }
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Tous les modèles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modèles</SelectItem>
            <SelectItem value="one_shot">
              {BILLING_MODEL_LABEL.one_shot}
            </SelectItem>
            <SelectItem value="recurring">
              {BILLING_MODEL_LABEL.recurring}
            </SelectItem>
            <SelectItem value="mixed">{BILLING_MODEL_LABEL.mixed}</SelectItem>
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
                Modèle
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Statut
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Montant HT
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Reste HT
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Signature
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium">Début</th>
              <th className="px-3 py-2 text-left text-xs font-medium">
                Fin prévue
              </th>
              {renderRowActions && (
                <th className="px-3 py-2 text-right text-xs font-medium">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={renderRowActions ? 9 : 8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Chargement des contrats...
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={renderRowActions ? 9 : 8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucun contrat pour le moment.
                </td>
              </tr>
            ) : (
              pageData.map((c) => {
                const devise = c.devise ?? "EUR";

                const totalPaidHt =
                  paidByContratHt && c.id in paidByContratHt
                    ? paidByContratHt[c.id]
                    : null;

                const resteHt =
                  c.montant_ht != null && totalPaidHt != null
                    ? c.montant_ht - totalPaidHt
                    : null;

                const handleRowClick = () => {
                  if (onRowClick) {
                    onRowClick(c);
                  }
                };

                const fmt = (v: number | null) =>
                  v == null
                    ? "—"
                    : v.toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-t",
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/40 transition-colors",
                    )}
                    onClick={handleRowClick}
                  >
                    {/* Contrat + client + proposition */}
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
                        {c.reference_externe && (
                          <span className="text-[11px] text-muted-foreground">
                            Réf. externe : {c.reference_externe}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Catégorie */}
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

                    {/* Modèle + périodicité */}
                    <td className="px-3 py-2 align-middle text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {BILLING_MODEL_LABEL[c.billing_model]}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {BILLING_PERIOD_LABEL[c.billing_period]}
                        </span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
                      {STATUT_LABEL[c.statut]}
                    </td>

                    {/* Montant HT */}
                    <td className="px-3 py-2 align-middle text-xs">
                      {c.billing_model === "one_shot" ? (
                        <>
                          {fmt(
                            c.montant_ht_one_shot ?? c.montant_ht ?? null,
                          )}{" "}
                          {devise}
                        </>
                      ) : c.billing_model === "recurring" ? (
                        <>
                          {fmt(c.montant_ht_mensuel)} {devise} / mois
                        </>
                      ) : c.billing_model === "mixed" ? (
                        <div className="flex flex-col">
                          <span>
                            One shot : {fmt(c.montant_ht_one_shot)} {devise}
                          </span>
                          <span>
                            Mensuel : {fmt(c.montant_ht_mensuel)} {devise}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Total estimé : {fmt(c.montant_ht)} {devise}
                          </span>
                        </div>
                      ) : c.montant_ht == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          {fmt(c.montant_ht)} {devise}
                        </>
                      )}
                    </td>

                    {/* Reste HT */}
                    <td className="px-3 py-2 align-middle text-xs">
                      {resteHt == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-semibold",
                            resteHt > 0
                              ? "text-amber-700"
                              : resteHt < 0
                              ? "text-emerald-700"
                              : "text-slate-700",
                          )}
                        >
                          {resteHt.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {devise}
                        </span>
                      )}
                    </td>

                    {/* Signature */}
                    <td className="px-3 py-2 align-middle text-xs">
                      {c.date_signature ? (
                        new Date(c.date_signature).toLocaleDateString("fr-FR")
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Début */}
                    <td className="px-3 py-2 align-middle text-xs">
                      {c.date_debut ? (
                        new Date(c.date_debut).toLocaleDateString("fr-FR")
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Fin prévue */}
                    <td className="px-3 py-2 align-middle text-xs">
                      {c.date_fin_prevue ? (
                        new Date(c.date_fin_prevue).toLocaleDateString("fr-FR")
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    {renderRowActions && (
                      <td
                        className="px-3 py-2 align-middle text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderRowActions(c)}
                      </td>
                    )}
                  </tr>
                );
              })
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
                  (prev + 1) * pageSize >= totalFiltered ? prev : prev + 1,
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