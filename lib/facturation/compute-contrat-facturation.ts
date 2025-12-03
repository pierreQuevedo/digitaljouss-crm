// lib/facturation/compute-contrat-facturation.ts

export type ContratBillingModel = "one_shot" | "recurrent" | "mixte";
export type ContratBillingPeriod = "one_time" | "monthly"; // étends si besoin

export type ContratPaiementLite = {
  montant_ht: string | null;
  montant_ttc: string | null;
  date_paiement: string; // ISO date (YYYY-MM-DD)
};

export type ContratForFacturation = {
  montant_ht: string; // total HT (optionnel mais pratique en fallback)
  montant_ttc: string | null;
  tva_rate: number | null;

  billing_model: ContratBillingModel;
  billing_period: ContratBillingPeriod;

  date_debut: string | null;       // date
  date_fin_prevue: string | null;  // date
  nb_mois_engagement: number | null;

  montant_ht_one_shot: string | null;
  montant_ht_mensuel: string | null;

  contrat_paiements: ContratPaiementLite[];
};

export type ContratFacturationSnapshot = {
  // Infos “structure contrat”
  nbMoisTotal: number;
  nbMoisEcoules: number;

  // Engagement total sur la durée
  engagementTotalHt: number;
  engagementTotalTtc: number;

  // Dû à date (accru) – ce que tu es censé avoir facturé / réclamé
  duHt: number;
  duTtc: number;

  // Paiements effectifs
  paidHt: number;
  paidTtc: number;

  // Reste dû à date
  resteDuHt: number;
  resteDuTtc: number;

  // Engagement futur (récurrent restant / non encore exigible)
  engagementFuturHt: number;
  engagementFuturTtc: number;
};

function parseNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// diff en mois “pleins” entre 2 dates
function diffInMonths(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calcul des métriques de facturation pour un contrat à une date de référence.
 * - gère one_shot / recurrent / mixte
 * - pour les mensuels, calcule un "accrual" (dû à date) en fonction des mois écoulés
 */
export function computeContratFacturation(
  contrat: ContratForFacturation,
  today: Date = new Date(),
): ContratFacturationSnapshot {
  const tvaRate = parseNumber(contrat.tva_rate ?? 20);
  const tva = tvaRate / 100;

  const montantHtGlobal = parseNumber(contrat.montant_ht);
  const montantHtMensuel = parseNumber(contrat.montant_ht_mensuel);
  const montantHtOneShot = parseNumber(contrat.montant_ht_one_shot);

  const dateDebut = safeDate(contrat.date_debut);
  const dateFinPrevue = safeDate(contrat.date_fin_prevue);

  // 1) Nombre de mois d’engagement total
  let nbMoisTotal = 0;

  if (contrat.nb_mois_engagement && contrat.nb_mois_engagement > 0) {
    nbMoisTotal = contrat.nb_mois_engagement;
  } else if (dateDebut && dateFinPrevue) {
    nbMoisTotal = diffInMonths(dateDebut, dateFinPrevue) + 1; // +1 si tu comptes mois inclus
    if (nbMoisTotal < 0) nbMoisTotal = 0;
  }

  // Si pas de notion de récurrence, on ignore le récurrent
  const isMonthly =
    contrat.billing_period === "monthly" &&
    (contrat.billing_model === "recurrent" ||
      contrat.billing_model === "mixte");

  // 2) Engagement total HT
  let engagementTotalHt = 0;

  if (isMonthly) {
    const totalRecurrentHt = montantHtMensuel * nbMoisTotal;
    engagementTotalHt = totalRecurrentHt + montantHtOneShot;
  } else {
    // contrat one-shot : on prend montant_ht global ou one-shot
    engagementTotalHt =
      montantHtGlobal > 0 ? montantHtGlobal : montantHtOneShot;
  }

  const engagementTotalTtc = engagementTotalHt * (1 + tva);

  // 3) Dû à date (accru)
  let nbMoisEcoules = 0;
  let duHt = 0;

  if (isMonthly && dateDebut && nbMoisTotal > 0) {
    const dRef = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    const dStart = new Date(
      dateDebut.getFullYear(),
      dateDebut.getMonth(),
      1,
    );

    const rawDiff = diffInMonths(dStart, dRef);
    nbMoisEcoules = clamp(rawDiff + 1, 0, nbMoisTotal); // +1 = mois en cours inclus

    const recurrentDuHt = montantHtMensuel * nbMoisEcoules;
    const oneShotDuHt = today >= dateDebut ? montantHtOneShot : 0;

    duHt = recurrentDuHt + oneShotDuHt;
  } else {
    // one-shot ou pas de récurrence : on considère tout dû dès la date de début
    if (!dateDebut || today >= dateDebut) {
      duHt = engagementTotalHt;
    } else {
      duHt = 0;
    }
    nbMoisEcoules = 0;
  }

  const duTtc = duHt * (1 + tva);

  // 4) Paiements effectifs
  let paidTtc = 0;
  let paidHt = 0;

  for (const p of contrat.contrat_paiements ?? []) {
    const pTtc = p.montant_ttc != null
      ? parseNumber(p.montant_ttc)
      : parseNumber(p.montant_ht) * (1 + tva);

    const pHt = p.montant_ht != null
      ? parseNumber(p.montant_ht)
      : pTtc / (1 + tva);

    paidTtc += pTtc;
    paidHt += pHt;
  }

  // 5) Reste dû à date
  const resteDuTtc = Math.max(0, duTtc - paidTtc);
  const resteDuHt = Math.max(0, duHt - paidHt);

  // 6) Engagement futur (non encore exigible)
  const engagementFuturHt = Math.max(0, engagementTotalHt - duHt);
  const engagementFuturTtc = engagementFuturHt * (1 + tva);

  return {
    nbMoisTotal,
    nbMoisEcoules,
    engagementTotalHt,
    engagementTotalTtc,
    duHt,
    duTtc,
    paidHt,
    paidTtc,
    resteDuHt,
    resteDuTtc,
    engagementFuturHt,
    engagementFuturTtc,
  };
}