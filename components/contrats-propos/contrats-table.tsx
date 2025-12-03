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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  canStartRecurringBilling,
  type BillingModel,
  type StatutContrat,
} from "@/lib/contrats-domain";
import { DownloadIcon } from "lucide-react";
import { ContratDocumentUploader } from "@/components/contrats-propos/contrat-document-uploader";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

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

  // temporalité facturation
  date_facturation_one_shot: string | null;
  date_debut_facturation_recurrente: string | null;

  client_nom_affichage: string | null;
  client_nom_legal: string | null;

  proposition_titre: string | null;

  // lien docs de la proposition
  proposition_url_envoi: string | null;

  service_category: ServiceCategory | null;
  service_category_slug: string | null;
  service_category_label: string | null;

  // docs contrat
  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;
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
  url_envoi: string | null;
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

  date_facturation_one_shot: string | null;
  date_debut_facturation_recurrente: string | null;

  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;

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
    initialStatutFilter
  );
  const [categoryFilter, setCategoryFilter] = useState<string | "all">(
    initialCategoryFilter
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

  // clés stables pour les useEffect (évite JSON.stringify dans le tableau de deps)
  const statutInKey = useMemo(
    () => (statutIn && statutIn.length > 0 ? statutIn.join("|") : ""),
    [statutIn]
  );
  const billingModelInKey = useMemo(
    () =>
      billingModelIn && billingModelIn.length > 0
        ? billingModelIn.join("|")
        : "",
    [billingModelIn]
  );
  const billingPeriodInKey = useMemo(
    () =>
      billingPeriodIn && billingPeriodIn.length > 0
        ? billingPeriodIn.join("|")
        : "",
    [billingPeriodIn]
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
            date_facturation_one_shot,
            date_debut_facturation_recurrente,

            devis_pdf_path,
            devis_signe_pdf_path,
            facture_pdf_path,

            client:client_id (
              nom_affichage,
              nom_legal
            ),

            proposition:proposition_id (
              titre,
              url_envoi,
              service_category:service_category_id (
                id,
                slug,
                label
              )
            )
          `
          )
          .order("created_at", { ascending: false });

        // On reconstruit les tableaux à partir des keys
        const statutValues: StatutContrat[] = statutInKey
          ? (statutInKey.split("|") as StatutContrat[])
          : [];
        const billingModelValues: BillingModel[] = billingModelInKey
          ? (billingModelInKey.split("|") as BillingModel[])
          : [];
        const billingPeriodValues: BillingPeriod[] = billingPeriodInKey
          ? (billingPeriodInKey.split("|") as BillingPeriod[])
          : [];

        if (statutValues.length > 0) {
          query = query.in("statut", statutValues);
        }

        if (billingModelValues.length > 0) {
          query = query.in("billing_model", billingModelValues);
        }

        if (billingPeriodValues.length > 0) {
          query = query.in("billing_period", billingPeriodValues);
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
            row.client
          )
            ? row.client[0] ?? null
            : row.client;

          const propositionJoined: DbPropositionFromJoin | null = Array.isArray(
            row.proposition
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

            // temporalité facturation
            date_facturation_one_shot: row.date_facturation_one_shot,
            date_debut_facturation_recurrente:
              row.date_debut_facturation_recurrente,

            client_nom_affichage: clientJoined?.nom_affichage ?? null,
            client_nom_legal: clientJoined?.nom_legal ?? null,

            proposition_titre: propositionJoined?.titre ?? null,
            proposition_url_envoi: propositionJoined?.url_envoi ?? null,

            service_category: catJoined
              ? {
                  id: catJoined.id,
                  slug: catJoined.slug,
                  label: catJoined.label,
                }
              : null,
            service_category_slug: catJoined?.slug ?? null,
            service_category_label: catJoined?.label ?? null,

            devis_pdf_path: row.devis_pdf_path,
            devis_signe_pdf_path: row.devis_signe_pdf_path,
            facture_pdf_path: row.facture_pdf_path,
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

      {/* Table Shadcn */}
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Contrat
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Catégorie
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Modèle
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Facturation
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Statut
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Montant
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Reste
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Propos
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Devis
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Devis signé
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Factures
              </TableHead>
              {renderRowActions && (
                <TableHead className="px-3 py-2 text-right text-xs font-medium">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={renderRowActions ? 12 : 11}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Chargement des contrats...
                </TableCell>
              </TableRow>
            ) : pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={renderRowActions ? 12 : 11}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucun contrat pour le moment.
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((c) => {
                const devise = c.devise ?? "EUR";

                const totalPaidHt =
                  paidByContratHt && c.id in paidByContratHt
                    ? paidByContratHt[c.id] ?? 0
                    : 0;

                const resteHt =
                  c.montant_ht != null ? c.montant_ht - totalPaidHt : null;

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

                const recurringReady = canStartRecurringBilling(c);

                return (
                  <TableRow
                    key={c.id}
                    className={cn(
                      "border-t",
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/40 transition-colors"
                    )}
                    onClick={handleRowClick}
                  >
                    {/* Contrat + client + proposition */}
                    <TableCell className="px-3 py-2 align-middle">
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
                    </TableCell>

                    {/* Catégorie */}
                    <TableCell className="px-3 py-2 align-middle">
                      {c.service_category_label ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                            getCategoryBadgeClasses(c.service_category_slug)
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              getCategoryDotClasses(c.service_category_slug)
                            )}
                          />
                          <span>{c.service_category_label}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Non définie
                        </span>
                      )}
                    </TableCell>

                    {/* Modèle + périodicité */}
                    <TableCell className="px-3 py-2 align-middle text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {BILLING_MODEL_LABEL[c.billing_model]}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {BILLING_PERIOD_LABEL[c.billing_period]}
                        </span>
                      </div>
                    </TableCell>

                    {/* Facturation (dates & état) */}
                    <TableCell className="px-3 py-2 align-middle text-xs">
                      {c.billing_model === "one_shot" && (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            One shot le{" "}
                            {c.date_facturation_one_shot
                              ? new Date(
                                  c.date_facturation_one_shot
                                ).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                        </div>
                      )}

                      {c.billing_model === "recurring" && (
                        <div className="flex flex-col">
                          <span>
                            Début récurrent :{" "}
                            {c.date_debut_facturation_recurrente
                              ? new Date(
                                  c.date_debut_facturation_recurrente
                                ).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {recurringReady
                              ? "OK pour lancer la facturation"
                              : "Pas encore active"}
                          </span>
                        </div>
                      )}

                      {c.billing_model === "mixed" && (
                        <div className="flex flex-col">
                          <span>
                            One shot :{" "}
                            {c.date_facturation_one_shot
                              ? new Date(
                                  c.date_facturation_one_shot
                                ).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                          <span>
                            Récurrent :{" "}
                            {c.date_debut_facturation_recurrente
                              ? new Date(
                                  c.date_debut_facturation_recurrente
                                ).toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {recurringReady
                              ? "Récurrent prêt à lancer"
                              : "Récurrent en attente"}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    {/* Statut */}
                    <TableCell className="px-3 py-2 align-middle text-xs text-muted-foreground">
                      {STATUT_LABEL[c.statut]}
                    </TableCell>

                    {/* Montant : HT + TTC */}
                    <TableCell className="px-3 py-2 align-middle text-xs">
                      {c.billing_model === "one_shot" ? (
                        (() => {
                          const ht = c.montant_ht_one_shot ?? c.montant_ht;
                          const rate = c.tva_rate ?? null;
                          const ttc =
                            ht != null && rate != null
                              ? ht * (1 + rate / 100)
                              : null;

                          if (ht == null) {
                            return (
                              <span className="text-muted-foreground">—</span>
                            );
                          }

                          return (
                            <div className="flex flex-col">
                              <span>
                                {fmt(ht)} {devise} HT
                              </span>
                              {ttc != null && (
                                <span className="text-[11px] text-muted-foreground">
                                  {fmt(ttc)} {devise} TTC
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : c.billing_model === "recurring" ? (
                        (() => {
                          const ht = c.montant_ht_mensuel;
                          const rate = c.tva_rate ?? null;
                          const ttc =
                            ht != null && rate != null
                              ? ht * (1 + rate / 100)
                              : null;

                          if (ht == null) {
                            return (
                              <span className="text-muted-foreground">—</span>
                            );
                          }

                          return (
                            <div className="flex flex-col">
                              <span>
                                {fmt(ht)} {devise} HT / mois
                              </span>
                              {ttc != null && (
                                <span className="text-[11px] text-muted-foreground">
                                  {fmt(ttc)} {devise} TTC / mois
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : c.billing_model === "mixed" ? (
                        (() => {
                          const oneShotHt = c.montant_ht_one_shot;
                          const mensuelHt = c.montant_ht_mensuel;
                          const totalHt = c.montant_ht;
                          const rate = c.tva_rate ?? null;

                          const oneShotTtc =
                            oneShotHt != null && rate != null
                              ? oneShotHt * (1 + rate / 100)
                              : null;
                          const mensuelTtc =
                            mensuelHt != null && rate != null
                              ? mensuelHt * (1 + rate / 100)
                              : null;

                          if (
                            oneShotHt == null &&
                            mensuelHt == null &&
                            totalHt == null
                          ) {
                            return (
                              <span className="text-muted-foreground">—</span>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-0.5">
                              {oneShotHt != null && (
                                <span className="flex items-center gap-2">
                                  One shot :
                                  <span className="flex flex-col">
                                    {fmt(oneShotHt)} {devise} HT
                                    {oneShotTtc != null && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {fmt(oneShotTtc)} {devise} TTC
                                      </span>
                                    )}
                                  </span>
                                </span>
                              )}
                              {mensuelHt != null && (
                                <span className="flex items-center gap-2">
                                  Mensuel :
                                  <span className="flex flex-col">
                                    {fmt(mensuelHt)} HT
                                    {mensuelTtc != null && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {fmt(mensuelTtc)} TTC
                                      </span>
                                    )}
                                  </span>
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : c.montant_ht == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        (() => {
                          const ht = c.montant_ht;
                          const rate = c.tva_rate ?? null;
                          const ttc =
                            ht != null && rate != null
                              ? ht * (1 + rate / 100)
                              : null;

                          return (
                            <div className="flex flex-col">
                              <span>{fmt(ht)} HT</span>
                              {ttc != null && (
                                <span className="text-[11px] text-muted-foreground">
                                  {fmt(ttc)} TTC
                                </span>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </TableCell>

                    {/* Reste : HT + TTC */}
                    <TableCell className="px-3 py-2 align-middle text-xs">
                      {resteHt == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        (() => {
                          const rate = c.tva_rate ?? null;
                          const resteTtc =
                            rate != null ? resteHt * (1 + rate / 100) : null;

                          return (
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  "font-semibold",
                                  resteHt > 0
                                    ? "text-amber-700"
                                    : resteHt < 0
                                    ? "text-emerald-700"
                                    : "text-slate-700"
                                )}
                              >
                                {fmt(resteHt)} HT
                              </span>
                              {resteTtc != null && (
                                <span className="text-[11px] text-muted-foreground">
                                  {fmt(resteTtc)} TTC
                                </span>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </TableCell>

                    {/* Propos */}
                    <TableCell
                      className="px-3 py-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.proposition_url_envoi ? (
                        <Button
                          asChild
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <a
                            href={c.proposition_url_envoi}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Ouvrir les documents de la proposition"
                          >
                            <DownloadIcon className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Devis */}
                    <TableCell
                      className="px-3 py-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContratDocumentUploader
                        contratId={c.id}
                        docType="devis"
                        existingPath={c.devis_pdf_path}
                      />
                    </TableCell>

                    {/* Devis signé */}
                    <TableCell
                      className="px-3 py-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContratDocumentUploader
                        contratId={c.id}
                        docType="devis_signe"
                        existingPath={c.devis_signe_pdf_path}
                      />
                    </TableCell>

                    {/* Factures */}
                    <TableCell
                      className="px-3 py-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContratDocumentUploader
                        contratId={c.id}
                        docType="facture"
                        existingPath={c.facture_pdf_path}
                      />
                    </TableCell>

                    {/* Actions */}
                    {renderRowActions && (
                      <TableCell
                        className="px-3 py-2 align-middle text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderRowActions(c)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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
                  totalFiltered
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
                  (prev + 1) * pageSize >= totalFiltered ? prev : prev + 1
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
                  Math.max(Math.ceil(totalFiltered / pageSize) - 1, 0)
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
