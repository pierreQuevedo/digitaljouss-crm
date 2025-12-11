"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { BillingModel, StatutContrat } from "@/lib/contrats-domain";

const supabase = createClient();

type BillingPeriod = "one_time" | "monthly" | "quarterly" | "yearly";

type ContratDetail = {
  id: string;
  slug: string;
  titre: string;
  description: string | null;
  statut: StatutContrat;

  client_id: string;
  client_slug: string | null;
  client_nom_affichage: string | null;
  client_nom_legal: string | null;

  proposition_id: string;
  proposition_titre: string | null;
  proposition_url_envoi: string | null;

  service_category_label: string | null;

  montant_ht: number | null;
  montant_ttc: number | null;
  montant_ht_one_shot: number | null;
  montant_ht_mensuel: number | null;
  tva_rate: number | null;

  billing_model: BillingModel;
  billing_period: BillingPeriod;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;

  reference_externe: string | null;

  created_at: string;
  date_signature: string | null;

  date_facturation_one_shot: string | null;
  date_debut_facturation_recurrente: string | null;

  total_paye_ht: number | null;
  total_paye_ttc: number | null;
  reste_a_payer_ht: number | null;
  reste_a_payer_ttc: number | null;

  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;
};

const STATUT_LABEL: Record<StatutContrat, string> = {
  brouillon: "Brouillon",
  en_attente_signature: "En attente de signature",
  signe: "Signé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

export default function ContratDetailPage() {
  const router = useRouter();
  const params = useParams<{
    slug: string;
    contratSlug: string;
  }>();

  const { slug, contratSlug } = params;

  const [contrat, setContrat] = useState<ContratDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contratSlug) return;

    const fetchContrat = async () => {
      setLoading(true);
      try {
        // 1) On récupère le contrat depuis la TABLE `contrats`
        const { data, error } = await supabase
          .from("contrats")
          .select(
            `
            id,
            slug,
            titre,
            description,
            statut,
            client_id,
            montant_ht,
            montant_ht_one_shot,
            montant_ht_mensuel,
            tva_rate,
            montant_ttc,
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
              slug,
              nom_affichage,
              nom_legal
            ),

            proposition:proposition_id (
              id,
              titre,
              url_envoi,
              service_category:service_category_id (
                label
              )
            )
          `
          )
          .eq("slug", contratSlug)
          .maybeSingle();

        if (error) {
          console.error("Erreur SELECT contrats:", error);
          toast.error("Erreur lors du chargement du contrat");
          return;
        }

        if (!data) {
          toast.error("Contrat introuvable");
          return;
        }

        const clientJoined = Array.isArray(data.client)
          ? data.client[0] ?? null
          : data.client;

        const propositionJoined = Array.isArray(data.proposition)
          ? data.proposition[0] ?? null
          : data.proposition;

        const catJoined =
          propositionJoined && propositionJoined.service_category
            ? Array.isArray(propositionJoined.service_category)
              ? propositionJoined.service_category[0] ?? null
              : propositionJoined.service_category
            : null;

        const toNumber = (v: unknown): number | null => {
          if (v == null) return null;
          if (typeof v === "number") return v;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };

        // 2) On récupère les totaux depuis la VUE `contrats_with_paiements`
        const { data: paiementAggs, error: paiementError } = await supabase
          .from("contrats_with_paiements")
          .select(
            `
              total_paye_ht,
              total_paye_ttc,
              reste_a_payer_ht,
              reste_a_payer_ttc
            `
          )
          .eq("id", data.id)
          .maybeSingle();

        if (paiementError) {
          console.error(
            "Erreur SELECT contrats_with_paiements:",
            paiementError
          );
        }

        const mapped: ContratDetail = {
          id: data.id,
          slug: data.slug,
          titre: data.titre,
          description: data.description ?? null,
          statut: data.statut,

          client_id: data.client_id,
          client_slug: clientJoined?.slug ?? null,
          client_nom_affichage: clientJoined?.nom_affichage ?? null,
          client_nom_legal: clientJoined?.nom_legal ?? null,

          proposition_id: propositionJoined?.id ?? "",
          proposition_titre: propositionJoined?.titre ?? null,
          proposition_url_envoi: propositionJoined?.url_envoi ?? null,

          service_category_label: catJoined?.label ?? null,

          montant_ht: toNumber(data.montant_ht),
          montant_ttc: toNumber(data.montant_ttc),
          montant_ht_one_shot: toNumber(data.montant_ht_one_shot),
          montant_ht_mensuel: toNumber(data.montant_ht_mensuel),
          tva_rate: toNumber(data.tva_rate),

          billing_model: data.billing_model ?? "one_shot",
          billing_period: data.billing_period ?? "one_time",
          date_debut: data.date_debut,
          date_fin_prevue: data.date_fin_prevue,
          nb_mois_engagement: data.nb_mois_engagement,

          reference_externe: data.reference_externe,
          created_at: data.created_at,
          date_signature: data.date_signature,

          date_facturation_one_shot: data.date_facturation_one_shot,
          date_debut_facturation_recurrente:
            data.date_debut_facturation_recurrente,

          total_paye_ht: paiementAggs
            ? toNumber(paiementAggs.total_paye_ht)
            : null,
          total_paye_ttc: paiementAggs
            ? toNumber(paiementAggs.total_paye_ttc)
            : null,
          reste_a_payer_ht: paiementAggs
            ? toNumber(paiementAggs.reste_a_payer_ht)
            : null,
          reste_a_payer_ttc: paiementAggs
            ? toNumber(paiementAggs.reste_a_payer_ttc)
            : null,

          devis_pdf_path: data.devis_pdf_path,
          devis_signe_pdf_path: data.devis_signe_pdf_path,
          facture_pdf_path: data.facture_pdf_path,
        };

        setContrat(mapped);
      } finally {
        setLoading(false);
      }
    };

    void fetchContrat();
  }, [contratSlug]);

  const fmtMoney = (v: number | null) =>
    v == null
      ? "—"
      : v.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const fmtDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("fr-FR") : "—";

  if (loading && !contrat) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Chargement du contrat...
      </div>
    );
  }

  if (!contrat) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Contrat introuvable.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Barre supérieure : back + titre + statut */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/clients/${slug}`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour au client
          </Button>

          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">
              {contrat.titre || "Sans titre"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {contrat.client_nom_affichage ||
                contrat.client_nom_legal ||
                "Client inconnu"}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {STATUT_LABEL[contrat.statut]}
          </span>
          {contrat.service_category_label && (
            <span className="text-[11px] text-muted-foreground">
              {contrat.service_category_label}
            </span>
          )}
        </div>
      </div>

      {/* Bloc montants */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-3 text-xs">
          <p className="text-[11px] text-muted-foreground">Montant HT</p>
          <p className="text-sm font-semibold">
            {fmtMoney(contrat.montant_ht)} €
          </p>
        </div>
        <div className="rounded-md border bg-card p-3 text-xs">
          <p className="text-[11px] text-muted-foreground">Montant TTC</p>
          <p className="text-sm font-semibold">
            {fmtMoney(contrat.montant_ttc)} €
          </p>
        </div>
        <div className="rounded-md border bg-card p-3 text-xs">
          <p className="text-[11px] text-muted-foreground">Total payé TTC</p>
          <p className="text-sm font-semibold">
            {fmtMoney(contrat.total_paye_ttc)} €
          </p>
        </div>
        <div className="rounded-md border bg-card p-3 text-xs">
          <p className="text-[11px] text-muted-foreground">Reste à payer TTC</p>
          <p className="text-sm font-semibold">
            {fmtMoney(contrat.reste_a_payer_ttc)} €
          </p>
        </div>
      </div>

      {/* Infos générales */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-card p-3 text-xs space-y-2">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Informations générales
          </h2>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[11px] text-muted-foreground">Réf. externe</p>
              <p className="text-sm">
                {contrat.reference_externe || "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Date de création
              </p>
              <p className="text-sm">
                {fmtDate(contrat.created_at)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Date de début
              </p>
              <p className="text-sm">
                {fmtDate(contrat.date_debut)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Date fin prévue
              </p>
              <p className="text-sm">
                {fmtDate(contrat.date_fin_prevue)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Date signature
              </p>
              <p className="text-sm">
                {fmtDate(contrat.date_signature)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Durée engagement (mois)
              </p>
              <p className="text-sm">
                {contrat.nb_mois_engagement ?? "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Facturation */}
        <div className="rounded-md border bg-card p-3 text-xs space-y-2">
          <h2 className="text-sm font-medium">Facturation</h2>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[11px] text-muted-foreground">
                Modèle
              </p>
              <p className="text-sm">
                {contrat.billing_model === "one_shot"
                  ? "One shot"
                  : "Récurrent"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Périodicité
              </p>
              <p className="text-sm">
                {contrat.billing_period === "monthly"
                  ? "Mensuelle"
                  : contrat.billing_period === "quarterly"
                  ? "Trimestrielle"
                  : contrat.billing_period === "yearly"
                  ? "Annuelle"
                  : "Ponctuelle"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Début facturation one shot
              </p>
              <p className="text-sm">
                {fmtDate(contrat.date_facturation_one_shot)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Début facturation récurrente
              </p>
              <p className="text-sm">
                {fmtDate(contrat.date_debut_facturation_recurrente)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description + proposition commerciale */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-card p-3 text-xs space-y-2">
          <h2 className="text-sm font-medium">Description</h2>
          <p className="whitespace-pre-wrap text-sm">
            {contrat.description || "Aucune description renseignée."}
          </p>
        </div>

        <div className="rounded-md border bg-card p-3 text-xs space-y-2">
          <h2 className="text-sm font-medium">Proposition commerciale</h2>
          <p className="text-sm">
            {contrat.proposition_titre || "—"}
          </p>
          {contrat.proposition_url_envoi && (
            <Button asChild size="sm" variant="outline">
              <a
                href={contrat.proposition_url_envoi}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir la proposition
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}