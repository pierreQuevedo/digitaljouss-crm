// components/facturation/client-facturation-tab.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Eye, EllipsisVertical } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContratDocumentUploader } from "@/components/contrats-propos/contrat-document-uploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type ContratPaiementRow = {
  id: string;
  contrat_id: string;
  montant_ht: string | null; // numeric => string
  montant_ttc: string | null;
  date_paiement: string; // date
  mode_paiement: string | null;
  note: string | null;
  commentaire: string | null;
};

type ContratRow = {
  id: string;
  client_id: string;
  titre: string;
  statut: string; // contrat_statut_enum
  montant_ht: string; // numeric => string
  montant_ttc: string | null;
  tva_rate: number | null;
  devise: string;
  date_signature: string | null;
  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;
  contrat_paiements: ContratPaiementRow[];
};

type ClientFacturationTabProps = {
  clientId: string;
};

type StatutFilter = "all" | "brouillon" | "signe" | "other";

function getTvaRate(raw: number | string | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 20; // fallback à 20%
}

/* -------------------------------------------------------------------------- */
/*                              COMPOSANT PRINCIPAL                           */
/* -------------------------------------------------------------------------- */

export function ClientFacturationTab({ clientId }: ClientFacturationTabProps) {
  const [contrats, setContrats] = useState<ContratRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [statutFilter, setStatutFilter] = useState<StatutFilter>("all");
  const [onlyWithResteDu, setOnlyWithResteDu] = useState(false);

  const fetchContrats = useCallback(async () => {
    try {
      setIsLoading(true);
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
          date_signature,
          devis_pdf_path,
          devis_signe_pdf_path,
          facture_pdf_path,
          contrat_paiements (
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
        .eq("client_id", clientId)
        .order("date_signature", { ascending: false });

      if (error) {
        console.error(error);
        toast.error(
          "Erreur lors du chargement des contrats pour la facturation"
        );
        return;
      }

      setContrats((data || []) as ContratRow[]);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors du chargement de la facturation");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchContrats();
  }, [fetchContrats]);

  /* ---------------------------------------------------------------------- */
  /*                        FILTRES SUR LES CONTRATS                        */
  /* ---------------------------------------------------------------------- */

  const filteredContrats = useMemo(() => {
    return contrats.filter((contrat) => {
      if (statutFilter === "brouillon" && contrat.statut !== "brouillon") {
        return false;
      }
      if (statutFilter === "signe" && contrat.statut !== "signe") {
        return false;
      }
      if (
        statutFilter === "other" &&
        (contrat.statut === "brouillon" || contrat.statut === "signe")
      ) {
        return false;
      }

      if (onlyWithResteDu) {
        const tva = getTvaRate(contrat.tva_rate);
        const contratHt = Number(contrat.montant_ht || 0);
        const contratTtc =
          contrat.montant_ttc != null
            ? Number(contrat.montant_ttc)
            : contratHt * (1 + tva / 100);

        const totalPaiementsTtc = (contrat.contrat_paiements || []).reduce(
          (sum, p) =>
            sum +
            (p.montant_ttc != null
              ? Number(p.montant_ttc)
              : Number(p.montant_ht || 0)),
          0
        );

        const resteTtc = contratTtc - totalPaiementsTtc;
        if (resteTtc <= 0.01) return false;
      }

      return true;
    });
  }, [contrats, statutFilter, onlyWithResteDu]);

  /* ---------------------------------------------------------------------- */
  /*                         CALCULS DE SYNTHÈSE                            */
  /* ---------------------------------------------------------------------- */

  const {
    totalContratsTtc,
    totalContratsHt,
    totalEncaisseTtc,
    totalEncaisseHt,
    totalResteTtc,
    totalResteHt,
  } = useMemo(() => {
    let contratsTtc = 0;
    let contratsHt = 0;
    let encaisseTtc = 0;
    let encaisseHt = 0;

    for (const contrat of filteredContrats) {
      const tva = getTvaRate(contrat.tva_rate);
      const ht = Number(contrat.montant_ht || 0);
      const ttc =
        contrat.montant_ttc != null
          ? Number(contrat.montant_ttc)
          : ht * (1 + tva / 100);

      contratsHt += ht;
      contratsTtc += ttc;

      const paiements = contrat.contrat_paiements || [];
      for (const p of paiements) {
        const pTtcRaw =
          p.montant_ttc != null
            ? Number(p.montant_ttc)
            : Number(p.montant_ht || 0);
        const pHtRaw = p.montant_ht != null ? Number(p.montant_ht) : 0;
        const pHt =
          pHtRaw > 0 ? pHtRaw : pTtcRaw / (1 + tva / 100);

        encaisseTtc += pTtcRaw;
        encaisseHt += pHt;
      }
    }

    return {
      totalContratsTtc: contratsTtc,
      totalContratsHt: contratsHt,
      totalEncaisseTtc: encaisseTtc,
      totalEncaisseHt: encaisseHt,
      totalResteTtc: contratsTtc - encaisseTtc,
      totalResteHt: contratsHt - encaisseHt,
    };
  }, [filteredContrats]);

  const devise = contrats[0]?.devise ?? "EUR";
  const hasAnyContrat = contrats.length > 0;

  /* ---------------------------------------------------------------------- */
  /*                                 RENDER                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6 rounded-lg border p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-medium">Facturation</h2>
          <p className="text-sm text-muted-foreground">
            Vue d’ensemble des contrats et des paiements pour ce client.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() =>
            toast.info("TODO: Export / rapport de facturation à implémenter 🙂")
          }
        >
          Exporter
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Statut contrat
          </span>
          <Select
            value={statutFilter}
            onValueChange={(value) => setStatutFilter(value as StatutFilter)}
          >
            <SelectTrigger className="h-8 w-[170px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="brouillon">Brouillon</SelectItem>
              <SelectItem value="signe">Signé</SelectItem>
              <SelectItem value="other">Autres</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3 w-3"
            checked={onlyWithResteDu}
            onChange={(e) => setOnlyWithResteDu(e.target.checked)}
          />
          <span>Uniquement les contrats avec reste dû</span>
        </label>
      </div>

      {/* Synthèse */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total contrats signés"
          ttc={totalContratsTtc}
          ht={totalContratsHt}
          devise={devise}
        />
        <SummaryCard
          label="Total encaissé"
          ttc={totalEncaisseTtc}
          ht={totalEncaisseHt}
          devise={devise}
        />
        <SummaryCard
          label="Reste dû"
          ttc={totalResteTtc}
          ht={totalResteHt}
          devise={devise}
          highlight={totalResteTtc > 0}
        />
      </div>

      {/* Liste des contrats */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Chargement de la facturation…
        </p>
      ) : !hasAnyContrat ? (
        <p className="text-sm text-muted-foreground">
          Aucun contrat trouvé pour ce client.
        </p>
      ) : filteredContrats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun contrat ne correspond aux filtres.
        </p>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Contrats & paiements</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrat</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">
                    Montant contrat
                  </TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                  <TableHead>Devis</TableHead>
                  <TableHead>Devis signé</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContrats.map((contrat) => (
                  <ContratRowItem
                    key={contrat.id}
                    contrat={contrat}
                    devise={contrat.devise}
                    onPaymentAdded={fetchContrats}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          LIGNE DE TABLE PAR CONTRAT                        */
/* -------------------------------------------------------------------------- */

type ContratRowItemProps = {
  contrat: ContratRow;
  devise: string;
  onPaymentAdded: () => void;
};

function ContratRowItem({
  contrat,
  devise,
  onPaymentAdded,
}: ContratRowItemProps) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const paiements = contrat.contrat_paiements || [];
  const tva = getTvaRate(contrat.tva_rate);

  const montantContratHt = Number(contrat.montant_ht || 0);
  const montantContratTtc =
    contrat.montant_ttc != null
      ? Number(contrat.montant_ttc)
      : montantContratHt * (1 + tva / 100);

  const totalPaiementsTtc = paiements.reduce((sum, p) => {
    const pTtcRaw =
      p.montant_ttc != null
        ? Number(p.montant_ttc)
        : Number(p.montant_ht || 0);
    return sum + pTtcRaw;
  }, 0);

  const totalPaiementsHt = paiements.reduce((sum, p) => {
    const pTtcRaw =
      p.montant_ttc != null
        ? Number(p.montant_ttc)
        : Number(p.montant_ht || 0);
    const pHtRaw = p.montant_ht != null ? Number(p.montant_ht) : 0;
    const pHt = pHtRaw > 0 ? pHtRaw : pTtcRaw / (1 + tva / 100);
    return sum + pHt;
  }, 0);

  const resteTtc = montantContratTtc - totalPaiementsTtc;
  const resteHt = montantContratHt - totalPaiementsHt;

  return (
    <>
      <TableRow className="align-middle">
        <TableCell className="space-y-1">
          <div className="font-medium">{contrat.titre}</div>
          <div className="text-xs text-muted-foreground">
            {paiements.length} paiement(s)
          </div>
        </TableCell>

        <TableCell className="align-middle">
          <ContratStatusBadge statut={contrat.statut} />
        </TableCell>

        <TableCell className="align-middle text-right">
          <div>
            {formatMontant(montantContratTtc, devise)}{" "}
            <span className="text-xs text-muted-foreground">TTC</span>
          </div>
          {montantContratHt > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatMontant(montantContratHt, devise)} HT
            </div>
          )}
        </TableCell>

        {/* PAYÉ = TTC + HT + œil à côté */}
        <TableCell className="align-middle text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="text-right">
              <div>
                {formatMontant(totalPaiementsTtc, devise)}{" "}
                <span className="text-xs text-muted-foreground">TTC</span>
              </div>
              {totalPaiementsHt > 0 && (
                <div className="text-xs text-muted-foreground">
                  {formatMontant(totalPaiementsHt, devise)} HT
                </div>
              )}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsDetailsOpen(true)}
              title="Voir le détail des paiements"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>

        <TableCell className="align-middle text-right">
          <div>
            {formatMontant(resteTtc, devise)}{" "}
            <span className="text-xs text-muted-foreground">TTC</span>
          </div>
          {Math.abs(resteHt) > 0.01 && (
            <div className="text-xs text-muted-foreground">
              {formatMontant(resteHt, devise)} HT
            </div>
          )}
        </TableCell>

        <TableCell className="align-middle">
          <ContratDocumentUploader
            contratId={contrat.id}
            docType="devis"
            existingPath={contrat.devis_pdf_path}
          />
        </TableCell>
        <TableCell className="align-middle">
          <ContratDocumentUploader
            contratId={contrat.id}
            docType="devis_signe"
            existingPath={contrat.devis_signe_pdf_path}
          />
        </TableCell>
        <TableCell className="align-middle">
          <ContratDocumentUploader
            contratId={contrat.id}
            docType="facture"
            existingPath={contrat.facture_pdf_path}
          />
        </TableCell>

        {/* Actions : menu 3 points verticaux + dialog "Actions" */}
        <TableCell className="align-middle text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="shadow-none h-8 w-8"
                  aria-label="Actions sur le contrat"
                >
                  <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsActionsOpen(true)}>
                Ajouter un paiement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AddPaiementDialog
            open={isActionsOpen}
            onOpenChange={setIsActionsOpen}
            contratId={contrat.id}
            devise={devise}
            tvaRate={tva}
            onPaymentAdded={onPaymentAdded}
          />
        </TableCell>
      </TableRow>

      {/* Dialog détails (contrat + paiements) */}
      <ContratDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        contrat={contrat}
        devise={devise}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                        SOUS-TABLE DES PAIEMENTS (DÉTAILS)                  */
/* -------------------------------------------------------------------------- */

type PaiementsSubTableProps = {
  paiements: ContratPaiementRow[];
  devise: string;
  tvaRate: number;
};

function PaiementsSubTable({ paiements, devise, tvaRate }: PaiementsSubTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Date paiement</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Commentaire</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paiements.map((p) => {
            const pTtcRaw =
              p.montant_ttc != null
                ? Number(p.montant_ttc)
                : Number(p.montant_ht || 0);
            const pHtRaw = p.montant_ht != null ? Number(p.montant_ht) : 0;
            const montantHt =
              pHtRaw > 0 ? pHtRaw : pTtcRaw / (1 + tvaRate / 100);

            return (
              <TableRow key={p.id}>
                <TableCell>
                  {format(new Date(p.date_paiement), "dd MMM yyyy", {
                    locale: fr,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div>
                    {formatMontant(pTtcRaw, devise)}{" "}
                    <span className="text-[10px] text-muted-foreground">
                      TTC
                    </span>
                  </div>
                  {montantHt > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {formatMontant(montantHt, devise)} HT
                    </div>
                  )}
                </TableCell>
                <TableCell>{p.mode_paiement ?? "—"}</TableCell>
                <TableCell>{p.note ?? "—"}</TableCell>
                <TableCell>{p.commentaire ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        DIALOG DÉTAILS CONTRAT                              */
/* -------------------------------------------------------------------------- */

type ContratDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrat: ContratRow;
  devise: string;
};

function ContratDetailsDialog({
  open,
  onOpenChange,
  contrat,
  devise,
}: ContratDetailsDialogProps) {
  const paiements = contrat.contrat_paiements || [];
  const tva = getTvaRate(contrat.tva_rate);

  const montantContratHt = Number(contrat.montant_ht || 0);
  const montantContratTtc =
    contrat.montant_ttc != null
      ? Number(contrat.montant_ttc)
      : montantContratHt * (1 + tva / 100);

  const totalPaiementsTtc = paiements.reduce((sum, p) => {
    const pTtcRaw =
      p.montant_ttc != null
        ? Number(p.montant_ttc)
        : Number(p.montant_ht || 0);
    return sum + pTtcRaw;
  }, 0);

  const totalPaiementsHt = paiements.reduce((sum, p) => {
    const pTtcRaw =
      p.montant_ttc != null
        ? Number(p.montant_ttc)
        : Number(p.montant_ht || 0);
    const pHtRaw = p.montant_ht != null ? Number(p.montant_ht) : 0;
    const pHt = pHtRaw > 0 ? pHtRaw : pTtcRaw / (1 + tva / 100);
    return sum + pHt;
  }, 0);

  const resteTtc = montantContratTtc - totalPaiementsTtc;
  const resteHt = montantContratHt - totalPaiementsHt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Détails du contrat</DialogTitle>
          <DialogDescription>
            Synthèse et historique des paiements pour ce contrat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium">{contrat.titre}</p>
            <p className="text-xs text-muted-foreground">
              Statut : <ContratStatusBadge statut={contrat.statut} />
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard
              label="Montant contrat"
              ttc={montantContratTtc}
              ht={montantContratHt}
              devise={devise}
            />
            <SummaryCard
              label="Total payé"
              ttc={totalPaiementsTtc}
              ht={totalPaiementsHt}
              devise={devise}
            />
            <SummaryCard
              label="Reste dû"
              ttc={resteTtc}
              ht={resteHt}
              devise={devise}
              highlight={resteTtc > 0}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Paiements
            </p>
            {paiements.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun paiement enregistré pour ce contrat.
              </p>
            ) : (
              <PaiementsSubTable
                paiements={paiements}
                devise={devise}
                tvaRate={tva}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                        DIALOG AJOUT PAIEMENT (ACTIONS)                     */
/* -------------------------------------------------------------------------- */

type AddPaiementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratId: string;
  devise: string;
  tvaRate: number;
  onPaymentAdded: () => void;
};

function AddPaiementDialog({
  open,
  onOpenChange,
  contratId,
  devise,
  tvaRate,
  onPaymentAdded,
}: AddPaiementDialogProps) {
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [montant, setMontant] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [commentaire, setCommentaire] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setMontant("");
    setMode("");
    setNote("");
    setCommentaire("");
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      resetForm();
    }
    onOpenChange(value);
  };

  const handleSubmit = async () => {
    const montantClean = montant.replace(",", ".");
    const montantTtc = Number(montantClean);

    if (!montant || isNaN(montantTtc) || montantTtc <= 0) {
      toast.error("Merci de saisir un montant valide.");
      return;
    }

    const montantHt = montantTtc / (1 + tvaRate / 100);

    setIsSaving(true);

    try {
      const { error } = await supabase.from("contrat_paiements").insert({
        contrat_id: contratId,
        montant_ttc: montantTtc,
        montant_ht: montantHt,
        date_paiement: date || new Date().toISOString().slice(0, 10),
        mode_paiement: mode || null,
        note: note || null,
        commentaire: commentaire || null,
      });

      if (error) {
        console.error(error);
        toast.error("Erreur lors de l’ajout du paiement");
        return;
      }

      toast.success("Paiement ajouté");
      resetForm();
      onPaymentAdded();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de l’ajout du paiement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actions</DialogTitle>
          <DialogDescription>
            Ajouter un paiement pour ce contrat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Date de paiement
            </label>
            <Input
              type="date"
              className="h-8"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Montant (TTC)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                className="h-8"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0,00"
              />
              <span className="text-xs text-muted-foreground">{devise}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Mode de paiement
            </label>
            <Input
              className="h-8"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              placeholder="Virement, CB, chèque…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Note interne
            </label>
            <Input
              className="h-8"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : acompte, facture n°X…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Commentaire
            </label>
            <Input
              className="h-8"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Champ libre…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleClose(false)}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Enregistrement…" : "Ajouter le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                          COMPOSANTS UTILITAIRES                            */
/* -------------------------------------------------------------------------- */

type SummaryCardProps = {
  label: string;
  ttc: number;
  ht: number;
  devise: string;
  highlight?: boolean;
};

function SummaryCard({ label, ttc, ht, devise, highlight }: SummaryCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${
        highlight ? "bg-amber-50 dark:bg-amber-950/20" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">
        {formatMontant(ttc, devise)}{" "}
        <span className="text-xs text-muted-foreground">TTC</span>
      </p>
      {ht > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatMontant(ht, devise)} HT
        </p>
      )}
    </div>
  );
}

function formatMontant(montant: number, devise: string) {
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise || "EUR",
    maximumFractionDigits: 2,
  });

  return formatter.format(montant || 0);
}

type ContratStatusBadgeProps = {
  statut: string;
};

function ContratStatusBadge({ statut }: ContratStatusBadgeProps) {
  const label = statut;
  const baseClass =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

  const variantClass =
    statut === "signe"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
      : statut === "brouillon"
      ? "bg-muted text-muted-foreground"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";

  return <span className={`${baseClass} ${variantClass}`}>{label}</span>;
}