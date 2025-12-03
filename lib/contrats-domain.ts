// lib/contrats-domain.ts

export type StatutContrat =
  | "brouillon"
  | "en_attente_signature"
  | "signe"
  | "en_cours"
  | "termine"
  | "annule";

export type BillingModel = "one_shot" | "recurring" | "mixed";
export type BillingPeriod = "one_time" | "monthly" | "quarterly" | "yearly";

export type MinimalContratForRecurring = {
  billing_model: BillingModel;
  statut: StatutContrat;
  date_debut_facturation_recurrente: string | null;
};

export function canStartRecurringBilling(
  contrat: MinimalContratForRecurring,
  now = new Date(),
): boolean {
  if (contrat.billing_model === "one_shot") return false;

  // pas encore un contrat vraiment actif
  if (!["en_cours", "termine"].includes(contrat.statut)) return false;

  if (!contrat.date_debut_facturation_recurrente) return false;

  const start = new Date(contrat.date_debut_facturation_recurrente);
  if (Number.isNaN(start.getTime())) return false;

  return start <= now;
}

/* -------------------------------------------------------------------------- */
/*                  Calcul des dates de facturation initiales                 */
/* -------------------------------------------------------------------------- */

function toDateString(date: Date): string {
  // pour une colonne SQL "date"
  return date.toISOString().slice(0, 10); // yyyy-mm-dd
}

type InitialFacturationArgs = {
  billing_model: BillingModel;

  /** Date de début de contrat (si tu la connais à la création) */
  date_debut?: string | null;

  /**
   * Si tu la connais déjà (ex: champ spécifique dans ton form de création),
   * tu peux forcer une date de début pour le récurrent.
   */
  explicit_recurring_start?: string | null;

  /** Pour les tests / jobs, sinon new Date() par défaut */
  baseDate?: Date;
};

export type InitialFacturationDates = {
  date_facturation_one_shot: string | null;
  date_debut_facturation_recurrente: string | null;
};

/**
 * Règles :
 * - one_shot :
 *   - date_facturation_one_shot = aujourd'hui
 *   - pas de récurrent
 * - recurring :
 *   - date_debut_facturation_recurrente = explicit_recurring_start
 *     || date_debut || aujourd'hui
 * - mixed :
 *   - date_facturation_one_shot = aujourd'hui
 *   - date_debut_facturation_recurrente = explicit_recurring_start
 *     || date_debut || aujourd'hui
 */
export function computeInitialFacturationDates(
  args: InitialFacturationArgs,
): InitialFacturationDates {
  const {
    billing_model,
    date_debut = null,
    explicit_recurring_start = null,
    baseDate = new Date(),
  } = args;

  const today = toDateString(baseDate);

  let date_facturation_one_shot: string | null = null;
  let date_debut_facturation_recurrente: string | null = null;

  if (billing_model === "one_shot") {
    date_facturation_one_shot = today;
  }

  if (billing_model === "recurring") {
    date_debut_facturation_recurrente =
      explicit_recurring_start || date_debut || today;
  }

  if (billing_model === "mixed") {
    date_facturation_one_shot = today;
    date_debut_facturation_recurrente =
      explicit_recurring_start || date_debut || today;
  }

  return {
    date_facturation_one_shot,
    date_debut_facturation_recurrente,
  };
}