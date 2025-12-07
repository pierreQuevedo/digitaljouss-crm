// app/dashboard/facturation/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import {
  ClientFacturationContratsTable,
  type ContratFacturationContrat,
  type ContratFacturationRow,
} from "@/components/facturation/client-facturation-contrats-table";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                       SNAPSHOT FACTURATION PAR CONTRAT                     */
/* -------------------------------------------------------------------------- */

function buildSnapshot(
  contrat: ContratFacturationContrat
): ContratFacturationRow["snapshot"] {
  const tvaRate = Number(contrat.tva_rate ?? 20);

  const montantHtOneShot = Number(contrat.montant_ht_one_shot ?? 0);
  const montantHtMensuel = Number(contrat.montant_ht_mensuel ?? 0);
  const montantHtBase = Number(contrat.montant_ht ?? 0);

  const nbMoisTotal = contrat.nb_mois_engagement ?? 0;

  // Engagement HT
  let engagementTotalHt = 0;

  if (contrat.billing_model === "one_shot") {
    engagementTotalHt = montantHtOneShot || montantHtBase;
  } else if (contrat.billing_model === "recurrent") {
    engagementTotalHt = montantHtMensuel * nbMoisTotal;
  } else if (contrat.billing_model === "mixte") {
    engagementTotalHt = montantHtOneShot + montantHtMensuel * nbMoisTotal;
  }

  if (!engagementTotalHt && montantHtBase) {
    engagementTotalHt = montantHtBase;
  }

  const engagementTotalTtc = engagementTotalHt * (1 + tvaRate / 100);

  // Paiements
  const paiements = contrat.contrat_paiements ?? [];

  const paidTtc = paiements.reduce((sum, p) => {
    if (p.montant_ttc != null) return sum + Number(p.montant_ttc);
    if (p.montant_ht != null)
      return sum + Number(p.montant_ht) * (1 + tvaRate / 100);
    return sum;
  }, 0);

  const paidHt = paiements.reduce((sum, p) => {
    if (p.montant_ht != null) return sum + Number(p.montant_ht);
    if (p.montant_ttc != null)
      return sum + Number(p.montant_ttc) / (1 + tvaRate / 100);
    return sum;
  }, 0);

  const resteDuTtc = engagementTotalTtc - paidTtc;
  const resteDuHt = engagementTotalHt - paidHt;

  // Pour l’instant on garde quelque chose de simple pour la partie "accrual"
  const nbMoisEcoules = 0;
  const engagementFuturHt = 0;
  const engagementFuturTtc = 0;

  return {
    nbMoisTotal,
    nbMoisEcoules,
    engagementTotalHt,
    engagementTotalTtc,
    duHt: resteDuHt,
    duTtc: resteDuTtc,
    paidHt,
    paidTtc,
    resteDuHt,
    resteDuTtc,
    engagementFuturHt,
    engagementFuturTtc,
  };
}

/* -------------------------------------------------------------------------- */
/*                            PAGE FACTURATION GLOBALE                        */
/* -------------------------------------------------------------------------- */

export default function FacturationPage() {
  const [rows, setRows] = useState<ContratFacturationRow[]>([]);
  const [devise, setDevise] = useState<string>("EUR");
  const [loadingContrats, setLoadingContrats] = useState(false);

  /* ------------------------------ Load contrats ---------------------------- */

  const fetchContrats = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoadingContrats(true);
    }

    try {
      const { data, error } = await supabase
        .from("contrats")
        .select(
          `
            id,
            client_id,
            titre,
            statut,
            montant_ht,
            montant_ttc,
            tva_rate,
            devise,
            billing_model,
            billing_period,
            date_signature,
            date_debut,
            date_fin_prevue,
            nb_mois_engagement,
            montant_ht_one_shot,
            montant_ht_mensuel,
            devis_pdf_path,
            devis_signe_pdf_path,
            facture_pdf_path,
            contrat_paiements:contrat_paiements (
              id,
              contrat_id,
              montant_ht,
              montant_ttc,
              date_paiement,
              mode_paiement,
              note,
              commentaire
            )
          `
        )
        // ✅ uniquement les contrats signés
        .eq("statut", "signe")
        .order("date_signature", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Impossible de charger les contrats de facturation");
        setRows([]);
        return;
      }

      const contrats = (data ?? []) as unknown as ContratFacturationContrat[];

      const mappedRows: ContratFacturationRow[] = contrats.map((contrat) => ({
        contrat,
        snapshot: buildSnapshot(contrat),
      }));

      setRows(mappedRows);
      const firstDevise = mappedRows[0]?.contrat.devise ?? "EUR";
      setDevise(firstDevise);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors du chargement de la facturation");
    } finally {
      setLoadingContrats(false);
    }
  }, []);

  /* ------------------------------- useEffect ------------------------------- */

  useEffect(() => {
    void fetchContrats();
  }, [fetchContrats]);

  /* ------------------------------- Render UI ------------------------------ */

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">Facturation</h1>
          <p className="text-sm text-muted-foreground">
            Vue globale des contrats <span className="font-medium">signés</span>
            , des paiements et des documents (devis, devis signés, factures).
          </p>
        </div>

        <div>
          {loadingContrats ? (
            <p className="text-sm text-muted-foreground">
              Chargement des contrats de facturation…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun contrat signé trouvé.
            </p>
          ) : (
            <ClientFacturationContratsTable
              contrats={rows}
              devise={devise}
              onPaymentAdded={() => {
                // après ajout de paiement ou upload doc, on refetch en silencieux
                void fetchContrats({ silent: true });
              }}
              showStatusFilter={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
