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
  montant_ht: string | null;
  montant_ttc: string | null;
  date_paiement: string;
  mode_paiement: string | null;
  note: string | null;
  commentaire: string | null;
};

type ContratTarifMensuelRow = {
  id: string;
  contrat_id: string;
  date_debut: string; // 'YYYY-MM-DD'
  date_fin: string | null; // null = tarif actuel
  montant_ht_mensuel: string; // numeric => string
};

type ContratRow = {
  id: string;
  client_id: string;
  titre: string;
  statut: string;

  montant_ht: string;
  montant_ttc: string | null;
  tva_rate: number | null;
  devise: string;

  billing_model: "one_shot" | "recurrent" | "mixte";
  billing_period: "one_time" | "monthly";

  date_signature: string | null;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;

  montant_ht_one_shot: string | null;
  montant_ht_mensuel: string | null;

  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;

  contrat_paiements: ContratPaiementRow[];

  contrat_tarifs_mensuels: ContratTarifMensuelRow[];
};

type ClientFacturationTabProps = {
  clientId: string;
};

type StatutFilter = "all" | "brouillon" | "signe" | "other";

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
    contrat_paiements (
      id,
      contrat_id,
      montant_ht,
      montant_ttc,
      date_paiement,
      mode_paiement,
      note,
      commentaire
    ),
    contrat_tarifs_mensuels (
      id,
      contrat_id,
      date_debut,
      date_fin,
      montant_ht_mensuel
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
        const snap = computeContratFacturation(contrat);
        if (snap.resteDuTtc <= 0.01) return false;
      }

      return true;
    });
  }, [contrats, statutFilter, onlyWithResteDu]);

  /* ---------------------------------------------------------------------- */
  /*                         CALCULS DE SYNTHÈSE                            */
  /* ---------------------------------------------------------------------- */

  const {
    totalEngagementTtc,
    totalEngagementHt,
    totalEncaisseTtc,
    totalEncaisseHt,
    totalResteTtc,
    totalResteHt,
    totalRecurringMensuelTtc,
    totalRecurringMensuelHt,
    totalNextMonthMensuelTtc,
    totalNextMonthMensuelHt,
  } = useMemo(() => {
    let engTtc = 0;
    let engHt = 0;
    let encTtc = 0;
    let encHt = 0;
    let resteTtc = 0;
    let resteHt = 0;

    let recurringMensuelHt = 0;
    let recurringMensuelTtc = 0;

    let nextMonthMensuelHt = 0;
    let nextMonthMensuelTtc = 0;

    const today = new Date();
    const currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
    const nextMonthStart = addMonths(currentMonthStart, 1);

    for (const contrat of filteredContrats) {
      const snap = computeContratFacturation(contrat);

      engHt += snap.engagementTotalHt;
      engTtc += snap.engagementTotalTtc;
      encHt += snap.paidHt;
      encTtc += snap.paidTtc;
      resteHt += snap.resteDuHt;
      resteTtc += snap.resteDuTtc;

      // 🔹 Mensuel du mois en cours
      const currentMensuel = getContratMensuelPourMois(
        contrat,
        currentMonthStart
      );
      recurringMensuelHt += currentMensuel.ht;
      recurringMensuelTtc += currentMensuel.ttc;

      // 🔹 Mensuel du mois prochain (prévisionnel)
      const nextMensuel = getContratMensuelPourMois(
        contrat,
        nextMonthStart
      );
      nextMonthMensuelHt += nextMensuel.ht;
      nextMonthMensuelTtc += nextMensuel.ttc;
    }

    return {
      totalEngagementTtc: engTtc,
      totalEngagementHt: engHt,
      totalEncaisseTtc: encTtc,
      totalEncaisseHt: encHt,
      totalResteTtc: resteTtc,
      totalResteHt: resteHt,
      totalRecurringMensuelTtc: recurringMensuelTtc,
      totalRecurringMensuelHt: recurringMensuelHt,
      totalNextMonthMensuelTtc: nextMonthMensuelTtc,
      totalNextMonthMensuelHt: nextMonthMensuelHt,
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
          <span>Uniquement les contrats avec reste dû (à date)</span>
        </label>
      </div>

      {/* Synthèse */}
            {/* Synthèse */}
            <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard
          label="Total contrats signés (engagement)"
          ttc={totalEngagementTtc}
          ht={totalEngagementHt}
          devise={devise}
        />
        <SummaryCard
          label="Total encaissé"
          ttc={totalEncaisseTtc}
          ht={totalEncaisseHt}
          devise={devise}
        />
        <SummaryCard
          label="Reste dû à date"
          ttc={totalResteTtc}
          ht={totalResteHt}
          devise={devise}
          highlight={totalResteTtc > 0}
        />
        <SummaryCard
          label="Récurrent mensuel (mois en cours)"
          ttc={totalRecurringMensuelTtc}
          ht={totalRecurringMensuelHt}
          devise={devise}
        />
        <SummaryCard
          label="Reste à facturer mois prochain (récurrent)"
          ttc={totalNextMonthMensuelTtc}
          ht={totalNextMonthMensuelHt}
          devise={devise}
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
                    Engagement contrat
                  </TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-right">Reste dû à date</TableHead>
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

  const snapshot = computeContratFacturation(contrat);
  const {
    engagementTotalHt,
    engagementTotalTtc,
    paidHt,
    paidTtc,
    resteDuHt,
    resteDuTtc,
  } = snapshot;

  const paiements = contrat.contrat_paiements || [];
  const tva = getTvaRate(contrat.tva_rate);

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

        {/* Montant contrat = engagement total */}
        <TableCell className="align-middle text-right">
          <div>
            {formatMontant(engagementTotalTtc, devise)}{" "}
            <span className="text-xs text-muted-foreground">TTC</span>
          </div>
          {engagementTotalHt > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatMontant(engagementTotalHt, devise)} HT
            </div>
          )}
        </TableCell>

        {/* PAYÉ = snapshot payé TTC + HT + œil à côté */}
        <TableCell className="align-middle text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="text-right">
              <div>
                {formatMontant(paidTtc, devise)}{" "}
                <span className="text-xs text-muted-foreground">TTC</span>
              </div>
              {paidHt > 0 && (
                <div className="text-xs text-muted-foreground">
                  {formatMontant(paidHt, devise)} HT
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

        {/* Reste dû à date */}
        <TableCell className="align-middle text-right">
          <div>
            {formatMontant(resteDuTtc, devise)}{" "}
            <span className="text-xs text-muted-foreground">TTC</span>
          </div>
          {Math.abs(resteDuHt) > 0.01 && (
            <div className="text-xs text-muted-foreground">
              {formatMontant(resteDuHt, devise)} HT
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

function PaiementsSubTable({
  paiements,
  devise,
  tvaRate,
}: PaiementsSubTableProps) {
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

  const snapshot = computeContratFacturation(contrat);
  const {
    engagementTotalHt,
    engagementTotalTtc,
    paidHt,
    paidTtc,
    resteDuHt,
    resteDuTtc,
    nbMoisTotal,
    nbMoisEcoules,
    engagementFuturTtc,
  } = snapshot;

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
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Statut : <ContratStatusBadge statut={contrat.statut} />
            </p>
            {contrat.billing_model !== "one_shot" && nbMoisTotal > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Récurent : {nbMoisEcoules}/{nbMoisTotal} mois “accrus” à date
              </p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard
              label="Engagement contrat"
              ttc={engagementTotalTtc}
              ht={engagementTotalHt}
              devise={devise}
            />
            <SummaryCard
              label="Total payé"
              ttc={paidTtc}
              ht={paidHt}
              devise={devise}
            />
            <SummaryCard
              label="Reste dû à date"
              ttc={resteDuTtc}
              ht={resteDuHt}
              devise={devise}
              highlight={resteDuTtc > 0}
            />
          </div>

          {engagementFuturTtc > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Engagement futur (non encore exigible) :{" "}
              {formatMontant(engagementFuturTtc, devise)} TTC
            </p>
          )}

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
/*                    LOGIQUE DE CALCUL FACTURATION CONTRAT                   */
/* -------------------------------------------------------------------------- */

type ContratFacturationSnapshot = {
  nbMoisTotal: number;
  nbMoisEcoules: number;

  engagementTotalHt: number;
  engagementTotalTtc: number;

  duHt: number;
  duTtc: number;

  paidHt: number;
  paidTtc: number;

  resteDuHt: number;
  resteDuTtc: number;

  engagementFuturHt: number;
  engagementFuturTtc: number;
};

function parseNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// diff en mois “pleins” entre 2 dates (en se plaçant au 1er du mois)
function diffInMonths(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return years * 12 + months;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getTvaRate(raw: number | string | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 20; // fallback 20%
}

type TarifPeriod = {
  start: Date;
  end: Date | null;
  montantHt: number;
};

function buildTarifPeriods(contrat: ContratRow): TarifPeriod[] {
  const periods: TarifPeriod[] = [];

  // 1) Périodes venant de contrat_tarifs_mensuels
  for (const t of contrat.contrat_tarifs_mensuels || []) {
    const start = safeDate(t.date_debut);
    if (!start) continue;
    const end = safeDate(t.date_fin);
    const montantHt = parseNumber(t.montant_ht_mensuel);
    if (montantHt <= 0) continue;

    periods.push({ start, end, montantHt });
  }

  // 2) Si aucune période mais un montant_ht_mensuel sur le contrat => fallback
  if (periods.length === 0) {
    const fallbackMensuel = parseNumber(contrat.montant_ht_mensuel);
    if (fallbackMensuel > 0) {
      const startRaw = contrat.date_debut ?? contrat.date_signature ?? null;
      const start = safeDate(startRaw) ?? new Date();
      periods.push({
        start,
        end: null,
        montantHt: fallbackMensuel,
      });
    }
  }

  // tri par date_debut
  periods.sort((a, b) => a.start.getTime() - b.start.getTime());
  return periods;
}

function findMensuelHtForMonth(
  monthDate: Date,
  periods: TarifPeriod[],
  fallbackMensuel: number
): number {
  // On cherche la dernière période dont start <= monthDate <= end (ou end null)
  for (let i = periods.length - 1; i >= 0; i--) {
    const p = periods[i];
    if (p.start <= monthDate && (!p.end || p.end >= monthDate)) {
      return p.montantHt;
    }
  }
  return fallbackMensuel > 0 ? fallbackMensuel : 0;
}

/**
 * Calcul des métriques de facturation pour un contrat à une date de référence.
 * - gère les périodes tarifaires mensuelles (400€ -> 700€ en cours de route)
 * - gère one_shot / recurrent / mixte
 */
function computeContratFacturation(
  contrat: ContratRow,
  today: Date = new Date()
): ContratFacturationSnapshot {
  const tvaRate = getTvaRate(contrat.tva_rate ?? 20);
  const tva = tvaRate / 100;

  const montantHtGlobal = parseNumber(contrat.montant_ht);
  const montantHtMensuelFallback = parseNumber(contrat.montant_ht_mensuel);
  const montantHtOneShot = parseNumber(contrat.montant_ht_one_shot);

  const periods = buildTarifPeriods(contrat);

  const hasMonthlyComponent =
    periods.length > 0 || montantHtMensuelFallback > 0;

  // Start du contrat : on prend date_debut, sinon date_signature, sinon 1er tarif
  const firstPeriodStart = periods[0]?.start ?? null;
  const startRaw = contrat.date_debut ?? contrat.date_signature ?? null;
  const dateDebut = safeDate(startRaw) ?? firstPeriodStart ?? null;

  let nbMoisTotal = 0;
  let nbMoisEcoules = 0;

  let engagementRecurrentHt = 0;
  let duRecurrentHt = 0;

  if (hasMonthlyComponent && dateDebut) {
    const startMonth = new Date(
      dateDebut.getFullYear(),
      dateDebut.getMonth(),
      1
    );
    const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Mois écoulés pour le "dû à date"
    if (todayMonth < startMonth) {
      nbMoisEcoules = 0;
    } else {
      nbMoisEcoules = diffInMonths(startMonth, todayMonth) + 1;
    }

    // Nombre de mois total : si engagement fixé, on projette, sinon = mois écoulés (contrat open-ended)
    if (contrat.nb_mois_engagement && contrat.nb_mois_engagement > 0) {
      nbMoisTotal = contrat.nb_mois_engagement;
    } else if (contrat.date_fin_prevue) {
      const dEnd = safeDate(contrat.date_fin_prevue);
      if (dEnd && dEnd >= dateDebut) {
        const endMonth = new Date(dEnd.getFullYear(), dEnd.getMonth(), 1);
        nbMoisTotal = diffInMonths(startMonth, endMonth) + 1;
      } else {
        nbMoisTotal = nbMoisEcoules;
      }
    } else {
      // contrat sans durée définie : on ne projette pas plus loin que la date du jour
      nbMoisTotal = nbMoisEcoules;
    }

    nbMoisTotal = Math.max(nbMoisTotal, 0);
    nbMoisEcoules = clamp(nbMoisEcoules, 0, nbMoisTotal);

    // Boucle sur les mois du contrat
    for (let i = 0; i < nbMoisTotal; i++) {
      const monthDate = addMonths(startMonth, i);
      const mensuelHt = findMensuelHtForMonth(
        monthDate,
        periods,
        montantHtMensuelFallback
      );

      engagementRecurrentHt += mensuelHt;

      if (i < nbMoisEcoules) {
        duRecurrentHt += mensuelHt;
      }
    }
  }

  let engagementTotalHt = 0;
  let duHt = 0;

  if (hasMonthlyComponent) {
    engagementTotalHt = engagementRecurrentHt;
    duHt = duRecurrentHt;

    // On ajoute la partie one-shot si elle existe
    if (montantHtOneShot > 0) {
      engagementTotalHt += montantHtOneShot;
      if (!dateDebut || today >= dateDebut) {
        duHt += montantHtOneShot;
      }
    }
  } else {
    // Pas de récurrent : contrat purement one-shot
    engagementTotalHt =
      montantHtGlobal > 0 ? montantHtGlobal : montantHtOneShot;

    if (!dateDebut || today >= dateDebut) {
      duHt = engagementTotalHt;
    } else {
      duHt = 0;
    }

    nbMoisTotal = contrat.nb_mois_engagement ?? 0;
    nbMoisEcoules = 0;
  }

  const engagementTotalTtc = engagementTotalHt * (1 + tva);
  const duTtc = duHt * (1 + tva);

  // Paiements effectifs
  let paidTtc = 0;
  let paidHt = 0;

  for (const p of contrat.contrat_paiements || []) {
    const pTtc =
      p.montant_ttc != null
        ? parseNumber(p.montant_ttc)
        : parseNumber(p.montant_ht) * (1 + tva);
    const pHt =
      p.montant_ht != null ? parseNumber(p.montant_ht) : pTtc / (1 + tva);

    paidTtc += pTtc;
    paidHt += pHt;
  }

  const resteDuTtc = Math.max(0, duTtc - paidTtc);
  const resteDuHt = Math.max(0, duHt - paidHt);

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

/* ---------- 🔽 AJOUT ICI : CALCUL DU MONTANT RÉCURRENT POUR UN MOIS ------- */

type ContratMonthlyRecurring = {
    ht: number;
    ttc: number;
  };
  
  /**
   * Renvoie le montant récurrent (HT/TTC) du contrat pour un mois donné.
   * Tient compte des périodes tarifaires, début/fin de contrat, engagement, etc.
   */
  function getContratMensuelPourMois(
    contrat: ContratRow,
    monthDate: Date
  ): ContratMonthlyRecurring {
    const tvaRate = getTvaRate(contrat.tva_rate ?? 20);
    const tva = tvaRate / 100;
  
    const periods = buildTarifPeriods(contrat);
    const montantHtMensuelFallback = parseNumber(contrat.montant_ht_mensuel);
  
    // 🔁 On considère que le contrat est “mensuel” s’il a un montant mensuel
    // ou des périodes dans contrat_tarifs_mensuels, peu importe les enums
    const hasMonthlyComponent =
      periods.length > 0 || montantHtMensuelFallback > 0;
  
    if (!hasMonthlyComponent) {
      return { ht: 0, ttc: 0 };
    }
  
    // Start du contrat : date_debut, sinon date_signature, sinon 1er tarif
    const firstPeriodStart = periods[0]?.start ?? null;
    const startRaw = contrat.date_debut ?? contrat.date_signature ?? null;
    const contractStart = safeDate(startRaw) ?? firstPeriodStart;
    if (!contractStart) {
      return { ht: 0, ttc: 0 };
    }
  
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const contractStartMonth = new Date(
      contractStart.getFullYear(),
      contractStart.getMonth(),
      1
    );
  
    // Si on est avant le début du contrat
    if (monthStart < contractStartMonth) {
      return { ht: 0, ttc: 0 };
    }
  
    // Fin du contrat si engagement limité ou date_fin_prevue
    let contractEndMonth: Date | null = null;
  
    if (contrat.nb_mois_engagement && contrat.nb_mois_engagement > 0) {
      contractEndMonth = addMonths(
        contractStartMonth,
        contrat.nb_mois_engagement - 1
      );
    } else if (contrat.date_fin_prevue) {
      const dEnd = safeDate(contrat.date_fin_prevue);
      if (dEnd) {
        contractEndMonth = new Date(dEnd.getFullYear(), dEnd.getMonth(), 1);
      }
    }
  
    // Si on est après la fin du contrat
    if (contractEndMonth && monthStart > contractEndMonth) {
      return { ht: 0, ttc: 0 };
    }
  
    const mensuelHt = findMensuelHtForMonth(
      monthStart,
      periods,
      montantHtMensuelFallback
    );
  
    if (mensuelHt <= 0) {
      return { ht: 0, ttc: 0 };
    }
  
    return {
      ht: mensuelHt,
      ttc: mensuelHt * (1 + tva),
    };
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