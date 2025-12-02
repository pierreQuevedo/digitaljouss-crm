// components/facturation/client-facturation-tab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContratDocumentUploader } from "@/components/contrats-propos/contrat-document-uploader";

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

/* -------------------------------------------------------------------------- */
/*                              COMPOSANT PRINCIPAL                           */
/* -------------------------------------------------------------------------- */

export function ClientFacturationTab({ clientId }: ClientFacturationTabProps) {
  const [contrats, setContrats] = useState<ContratRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContrats = async () => {
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
          toast.error("Erreur lors du chargement des contrats pour la facturation");
          return;
        }

        setContrats((data || []) as ContratRow[]);
      } catch (err) {
        console.error(err);
        toast.error("Erreur inattendue lors du chargement de la facturation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchContrats();
  }, [clientId]);

  /* ---------------------------------------------------------------------- */
  /*                         CALCULS DE SYNTHÈSE                            */
  /* ---------------------------------------------------------------------- */

  const { totalContrats, totalEncaisse, totalResteDu } = useMemo(() => {
    let contratsTotal = 0;
    let encaisseTotal = 0;

    for (const contrat of contrats) {
      const contratTtc =
        contrat.montant_ttc != null
          ? Number(contrat.montant_ttc)
          : Number(contrat.montant_ht || 0);

      contratsTotal += contratTtc;

      const paiements = contrat.contrat_paiements || [];
      for (const p of paiements) {
        const montantPaiement =
          p.montant_ttc != null
            ? Number(p.montant_ttc)
            : Number(p.montant_ht || 0);

        encaisseTotal += montantPaiement;
      }
    }

    return {
      totalContrats: contratsTotal,
      totalEncaisse: encaisseTotal,
      totalResteDu: contratsTotal - encaisseTotal,
    };
  }, [contrats]);

  const devise = contrats[0]?.devise ?? "EUR";

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

        {/* placeholder bouton pour plus tard : export, etc. */}
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

      {/* Synthèse */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total contrats signés"
          value={formatMontant(totalContrats, devise)}
        />
        <SummaryCard
          label="Total encaissé"
          value={formatMontant(totalEncaisse, devise)}
        />
        <SummaryCard
          label="Reste dû"
          value={formatMontant(totalResteDu, devise)}
          highlight={totalResteDu > 0}
        />
      </div>

      {/* Liste des contrats */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Chargement de la facturation…
        </p>
      ) : contrats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun contrat trouvé pour ce client.
        </p>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Contrats & paiements</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrat</TableHead>
                  <TableHead>Date signature</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">
                    Montant contrat
                  </TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-right">Reste dû</TableHead>
                  <TableHead>Docs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contrats.map((contrat) => {
                  const contratTtc =
                    contrat.montant_ttc != null
                      ? Number(contrat.montant_ttc)
                      : Number(contrat.montant_ht || 0);

                  const payé = (contrat.contrat_paiements || []).reduce(
                    (sum, p) =>
                      sum +
                      (p.montant_ttc != null
                        ? Number(p.montant_ttc)
                        : Number(p.montant_ht || 0)),
                    0
                  );

                  const reste = contratTtc - payé;

                  return (
                    <ContratRowItem
                      key={contrat.id}
                      contrat={contrat}
                      montantContrat={contratTtc}
                      montantPaye={payé}
                      montantReste={reste}
                      devise={contrat.devise}
                    />
                  );
                })}
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
  montantContrat: number;
  montantPaye: number;
  montantReste: number;
  devise: string;
};

function ContratRowItem({
  contrat,
  montantContrat,
  montantPaye,
  montantReste,
  devise,
}: ContratRowItemProps) {
  const paiements = contrat.contrat_paiements || [];

  return (
    <>
      <TableRow className="align-top">
        <TableCell className="space-y-1">
          <div className="font-medium">{contrat.titre}</div>
          <div className="text-xs text-muted-foreground">
            {paiements.length} paiement(s)
          </div>
        </TableCell>

        <TableCell className="align-middle">
          {contrat.date_signature
            ? format(new Date(contrat.date_signature), "dd MMM yyyy", {
                locale: fr,
              })
            : "—"}
        </TableCell>

        <TableCell className="align-middle">
          <ContratStatusBadge statut={contrat.statut} />
        </TableCell>

        <TableCell className="text-right align-middle">
          {formatMontant(montantContrat, devise)}
        </TableCell>

        <TableCell className="text-right align-middle">
          {formatMontant(montantPaye, devise)}
        </TableCell>

        <TableCell className="text-right align-middle">
          {formatMontant(montantReste, devise)}
        </TableCell>

        <TableCell className="align-middle">
          <div className="flex flex-col gap-1">
            <ContratDocumentUploader
              contratId={contrat.id}
              docType="devis"
              existingPath={contrat.devis_pdf_path}
            />
            <ContratDocumentUploader
              contratId={contrat.id}
              docType="devis_signe"
              existingPath={contrat.devis_signe_pdf_path}
            />
            <ContratDocumentUploader
              contratId={contrat.id}
              docType="facture"
              existingPath={contrat.facture_pdf_path}
            />
          </div>
        </TableCell>
      </TableRow>

      {/* Ligne "sous-table" paiements */}
      {paiements.length > 0 && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/40 p-3">
            <PaiementsSubTable paiements={paiements} devise={devise} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                        SOUS-TABLE DES PAIEMENTS                            */
/* -------------------------------------------------------------------------- */

type PaiementsSubTableProps = {
  paiements: ContratPaiementRow[];
  devise: string;
};

function PaiementsSubTable({ paiements, devise }: PaiementsSubTableProps) {
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
            const montant =
              p.montant_ttc != null
                ? Number(p.montant_ttc)
                : Number(p.montant_ht || 0);

            return (
              <TableRow key={p.id}>
                <TableCell>
                  {format(new Date(p.date_paiement), "dd MMM yyyy", {
                    locale: fr,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  {formatMontant(montant, devise)}
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
/*                          COMPOSANTS UTILITAIRES                            */
/* -------------------------------------------------------------------------- */

type SummaryCardProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

function SummaryCard({ label, value, highlight }: SummaryCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${
        highlight ? "bg-amber-50 dark:bg-amber-950/20" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
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
  const label = statut; // tu pourras mapper proprement si besoin
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