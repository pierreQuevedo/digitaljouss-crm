// components/contrats-propos/contrat-detail-dialog.tsx

"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import type { ContratRow } from "@/components/contrats-propos/contrats-table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ContratPaymentRow = {
  id: string;
  contrat_id: string;
  date_paiement: string;
  montant_ht: number | null;
  montant_ttc: number | null;
  commentaire: string | null;
};

type ContratDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrat: ContratRow | null;

  /** Montant total déjà payé côté HT / TTC (optionnel) */
  totalPaidHt?: number | null;
  totalPaidTtc?: number | null;

  /** Paiements du contrat (pour le listing) */
  payments?: ContratPaymentRow[];

  /**
   * Callback quand on clique sur "Ajouter un paiement".
   * Le form réel est géré par ContratPaymentDialog dans la page.
   */
  onOpenPaymentsDialog?: (contrat: ContratRow) => void;

  /** Action “Éditer le contrat” (optionnelle) */
  onEditContrat?: (contrat: ContratRow) => void;
};

const STATUT_LABEL: Record<ContratRow["statut"], string> = {
  brouillon: "Brouillon",
  en_attente_signature: "En attente signature",
  signe: "Signé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

// mêmes helpers que dans le tableau
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

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export function ContratDetailDialog({
  open,
  onOpenChange,
  contrat,
  totalPaidHt = null,
  totalPaidTtc = null,
  payments = [],
  onOpenPaymentsDialog,
  onEditContrat,
}: ContratDetailDialogProps) {
  const [paymentsListOpen, setPaymentsListOpen] = useState(false);

  const montantHt = contrat?.montant_ht ?? null;
  const tvaRate = contrat?.tva_rate ?? null;

  const montantTtc = useMemo(() => {
    if (montantHt == null) return null;
    const rate = tvaRate ?? 0;
    return montantHt * (1 + rate / 100);
  }, [montantHt, tvaRate]);

  const resteHt = useMemo(() => {
    if (montantHt == null || totalPaidHt == null) return null;
    return montantHt - totalPaidHt;
  }, [montantHt, totalPaidHt]);

  const resteTtc = useMemo(() => {
    if (montantTtc == null || totalPaidTtc == null) return null;
    return montantTtc - totalPaidTtc;
  }, [montantTtc, totalPaidTtc]);

  const devise = contrat?.devise ?? "EUR";

  if (!contrat) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contrat introuvable</DialogTitle>
            <DialogDescription className="text-xs">
              Aucune donnée de contrat n&apos;a été fournie.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const createdAt = new Date(contrat.created_at).toLocaleDateString("fr-FR");
  const signedAt = contrat.date_signature
    ? new Date(contrat.date_signature).toLocaleDateString("fr-FR")
    : null;

  const hasPayments = payments.length > 0;

  return (
    <>
      {/* --- Dialog principal : contrat --- */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl sm:max-w-4xl p-10">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold">
                  {contrat.titre || "Sans titre"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {contrat.client_nom_affichage ||
                    contrat.client_nom_legal ||
                    "Client inconnu"}
                </span>
              </div>

              <div className="flex flex-col items-end gap-3">
                {/* Statut */}
                <Badge variant="outline" className="text-[11px]">
                  {STATUT_LABEL[contrat.statut]}
                </Badge>

                {/* Catégorie */}
                {contrat.service_category_label && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                      getCategoryBadgeClasses(contrat.service_category_slug),
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        getCategoryDotClasses(contrat.service_category_slug),
                      )}
                    />
                    <span>{contrat.service_category_label}</span>
                  </span>
                )}

                <span className="text-[11px] text-muted-foreground">
                  Créé le {createdAt}
                </span>
                {signedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    Signé le {signedAt}
                  </span>
                )}
              </div>
            </DialogTitle>

            <DialogDescription className="text-xs">
              Vue détaillée du contrat, des montants et des paiements
              éventuels.
            </DialogDescription>
          </DialogHeader>

          {/* Contenu */}
          <div className="space-y-4 text-xs">
            {/* Description */}
            {contrat.description && (
              <div className="space-y-1.5">
                <p className="font-medium text-lg">Description</p>
                <p className="whitespace-pre-wrap text-sm">
                  {contrat.description}
                </p>
              </div>
            )}

            {/* Bloc Montants / Paiements */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* Montants */}
              <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
                <p className="font-medium text-sm">Montants & facturation</p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Montant HT
                    </span>
                    <span className="text-xs font-medium">
                      {montantHt == null
                        ? "—"
                        : `${montantHt.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ${devise}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      TVA (%)
                    </span>
                    <span className="text-xs">
                      {tvaRate == null
                        ? "—"
                        : `${tvaRate.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} %`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Montant TTC
                    </span>
                    <span className="text-xs font-medium">
                      {montantTtc == null
                        ? "—"
                        : `${montantTtc.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ${devise}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Paiements / reste à charge */}
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">
                    Paiements & reste à charge
                  </p>

                  {onOpenPaymentsDialog && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenPaymentsDialog(contrat)}
                    >
                      Ajouter un paiement
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  {/* Total payé HT */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Total payé HT
                    </span>
                    <span className="text-xs">
                      {totalPaidHt == null
                        ? "—"
                        : `${totalPaidHt.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ${devise}`}
                    </span>
                  </div>

                  {/* Reste à charge HT */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Reste à charge HT
                    </span>
                    <span className="text-xs font-semibold">
                      {resteHt == null
                        ? "—"
                        : `${resteHt.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ${devise}`}
                    </span>
                  </div>

                  {/* Total payé TTC */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Total payé TTC
                    </span>
                    <span className="text-xs">
                      {totalPaidTtc == null
                        ? "—"
                        : `${totalPaidTtc.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ${devise}`}
                    </span>
                  </div>

                  {/* Reste à charge TTC */}
                  <div className="flex items-center justify_between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Reste à charge TTC
                    </span>
                    <span className="text-xs font-semibold">
                      {resteTtc == null
                        ? "—"
                        : `${resteTtc.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ${devise}`}
                    </span>
                  </div>
                </div>

                {/* Bouton voir paiements */}
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="px-1 text-[11px]"
                    disabled={!hasPayments}
                    onClick={() => hasPayments && setPaymentsListOpen(true)}
                  >
                    {hasPayments
                      ? `Voir les paiements (${payments.length})`
                      : "Aucun paiement enregistré"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-4 flex items-center justify-between gap-2">
            {onEditContrat ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEditContrat(contrat)}
              >
                Modifier le contrat
              </Button>
            ) : (
              <span />
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Dialog “Liste des paiements” --- */}
      <Dialog open={paymentsListOpen} onOpenChange={setPaymentsListOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Paiements du contrat
            </DialogTitle>
            <DialogDescription className="text-xs">
              Historique des paiements enregistrés pour ce contrat.
            </DialogDescription>
          </DialogHeader>

          {hasPayments ? (
            <div className="mt-2 max-h-80 space-y-2 overflow-y-auto text-xs">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-right">HT</th>
                    <th className="px-2 py-1 text-right">TTC</th>
                    <th className="px-2 py-1 text-left">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-1 align-top">
                        {new Date(p.date_paiement).toLocaleDateString(
                          "fr-FR",
                        )}
                      </td>
                      <td className="px-2 py-1 align-top text-right">
                        {p.montant_ht == null
                          ? "—"
                          : p.montant_ht.toLocaleString("fr-FR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                      </td>
                      <td className="px-2 py-1 align-top text-right">
                        {p.montant_ttc == null
                          ? "—"
                          : p.montant_ttc.toLocaleString("fr-FR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {p.commentaire || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Aucun paiement enregistré pour ce contrat.
            </p>
          )}

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPaymentsListOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}