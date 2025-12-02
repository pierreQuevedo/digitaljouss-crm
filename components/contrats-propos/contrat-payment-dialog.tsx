// components/contrats-propos/contrat-payment-dialog.tsx

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ContratPaymentFormValues = {
  date_paiement: string;
  montant_ttc: number | null;
  montant_ht: number | null;
  commentaire?: string | null;
};

type ContratPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** callback appelée quand on valide le formulaire */
  onSubmit: (values: ContratPaymentFormValues) => Promise<void> | void;

  /** TVA du contrat (pour calcul auto HT <-> TTC) */
  tvaRatePercent?: number | null;

  className?: string;
};

export function ContratPaymentDialog({
  open,
  onOpenChange,
  onSubmit,
  tvaRatePercent = 20,
  className,
}: ContratPaymentDialogProps) {
  const [datePaiement, setDatePaiement] = useState("");
  const [montantTtc, setMontantTtc] = useState<string>("");
  const [montantHt, setMontantHt] = useState<string>("");
  const [commentaire, setCommentaire] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // reset du form à l’ouverture
  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
      setDatePaiement(today);
      setMontantTtc("");
      setMontantHt("");
      setCommentaire("");
    }
  }, [open]);

  const parseNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const normalized = value.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const handleChangeTtc = (value: string) => {
    setMontantTtc(value);

    const nTtc = parseNumber(value);
    if (nTtc == null || !tvaRatePercent) {
      setMontantHt("");
      return;
    }
    const ht = nTtc / (1 + tvaRatePercent / 100);
    setMontantHt(
      ht.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  };

  const handleChangeHt = (value: string) => {
    setMontantHt(value);

    const nHt = parseNumber(value);
    if (nHt == null || !tvaRatePercent) {
      setMontantTtc("");
      return;
    }
    const ttc = nHt * (1 + tvaRatePercent / 100);
    setMontantTtc(
      ttc.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nHt = parseNumber(montantHt);
    const nTtc = parseNumber(montantTtc);

    if (!nTtc && !nHt) {
      // tu peux mettre un toast ici si tu veux
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        date_paiement: datePaiement,
        montant_ht: nHt,
        montant_ttc: nTtc,
        commentaire: commentaire.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className={cn("max-w-md", className)}>
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Ajouter un paiement reçu
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enregistre un nouveau paiement pour ce contrat. Le montant HT est
            calculé automatiquement à partir du TTC (et inversement) selon la TVA.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Date */}
          <div className="grid gap-1.5">
            <Label htmlFor="date_paiement">Date du paiement</Label>
            <Input
              id="date_paiement"
              type="date"
              value={datePaiement}
              onChange={(e) => setDatePaiement(e.target.value)}
              required
            />
          </div>

          {/* Montants */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="montant_ttc">Montant TTC</Label>
              <Input
                id="montant_ttc"
                inputMode="decimal"
                placeholder="Ex : 1200,00"
                value={montantTtc}
                onChange={(e) => handleChangeTtc(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Saisis le TTC, le HT sera calculé avec TVA{" "}
                {tvaRatePercent ?? 0}
                %.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="montant_ht">Montant HT</Label>
              <Input
                id="montant_ht"
                inputMode="decimal"
                placeholder="Ex : 1000,00"
                value={montantHt}
                onChange={(e) => handleChangeHt(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Ou saisis directement le HT, le TTC sera recalculé.
              </p>
            </div>
          </div>

          {/* Commentaire */}
          <div className="grid gap-1.5">
            <Label htmlFor="commentaire">Commentaire</Label>
            <Textarea
              id="commentaire"
              rows={3}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Référence facture, mode de paiement, etc."
            />
          </div>

          <DialogFooter className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer le paiement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}