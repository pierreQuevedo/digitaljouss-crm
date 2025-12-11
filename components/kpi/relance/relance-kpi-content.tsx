// components/kpi/relance/relance-kpi-content.tsx
import { createClient } from "@/lib/supabase/server";
import {
  DelaiPremierPaiementKpi,
  type PaiementRow,
} from "@/components/kpi/relance/delai-premier-paiement-kpi";

type RawContrat = {
  id: string;
  date_signature: string | null;
};

type RawPaiement = {
  contrat_id: string;
  date_paiement: string | null;
};

export default async function RelanceKpiContent() {
  const supabase = await createClient();

  // 1) On récupère les contrats avec leur date de signature
  const { data: contrats, error: contratsError } = await supabase
    .from("contrats_with_paiements")
    .select("id, date_signature");

  if (contratsError) {
    console.error(
      "Erreur chargement contrats pour KPI délai 1er paiement :",
      contratsError.message
    );
  }

  // 2) On récupère tous les paiements
  const { data: paiements, error: paiementsError } = await supabase
    .from("contrat_paiements")
    .select("contrat_id, date_paiement");

  if (paiementsError) {
    console.error(
      "Erreur chargement paiements pour KPI délai 1er paiement :",
      paiementsError.message
    );
  }

  const contratsArray = (contrats ?? []) as RawContrat[];
  const paiementsArray = (paiements ?? []) as RawPaiement[];

  // 3) Map contrat_id -> date_signature
  const signatureByContrat = new Map<string, string>();
  for (const c of contratsArray) {
    if (c.date_signature) {
      signatureByContrat.set(c.id, c.date_signature);
    }
  }

  // 4) On construit les rows pour le composant KPI
  const rows: PaiementRow[] = paiementsArray
    .map((p) => {
      const date_signature = signatureByContrat.get(p.contrat_id) ?? null;
      return {
        contrat_id: p.contrat_id,
        date_signature,
        date_paiement: p.date_paiement,
      };
    })
    // On garde uniquement ceux qui ont bien signature + paiement
    .filter(
      (r): r is PaiementRow =>
        Boolean(r.date_signature) && Boolean(r.date_paiement)
    );

  return <DelaiPremierPaiementKpi rows={rows} />;
}