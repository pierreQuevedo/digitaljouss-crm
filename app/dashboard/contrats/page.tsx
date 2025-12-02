// app/dashboard/contrats/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  ContratsTable,
  type ContratRow,
} from "@/components/contrats-propos/contrats-table";
import {
  ContratDetailDialog,
  type ContratPaymentRow,
} from "@/components/contrats-propos/contrat-detail-dialog";
import {
  ContratPaymentDialog,
  type ContratPaymentFormValues,
} from "@/components/contrats-propos/contrat-payment-dialog";
import { Button } from "@/components/ui/button";

const supabase = createClient();

type SupabaseContratPaymentRow = {
  id: string;
  contrat_id: string;
  date_paiement: string;
  montant_ht: number | string | null;
  montant_ttc: number | string | null;
  commentaire: string | null;
};

function mapPaymentRow(row: SupabaseContratPaymentRow): ContratPaymentRow {
  return {
    id: row.id,
    contrat_id: row.contrat_id,
    date_paiement: row.date_paiement,
    montant_ht:
      row.montant_ht == null
        ? null
        : typeof row.montant_ht === "number"
        ? row.montant_ht
        : Number(row.montant_ht),
    montant_ttc:
      row.montant_ttc == null
        ? null
        : typeof row.montant_ttc === "number"
        ? row.montant_ttc
        : Number(row.montant_ttc),
    commentaire: row.commentaire,
  };
}

export default function ContratsPage() {
  const [selected, setSelected] = useState<ContratRow | null>(null);
  const [openDetail, setOpenDetail] = useState(false);

  const [payments, setPayments] = useState<ContratPaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);

  const selectedId = selected?.id ?? null;

  // Chargement des paiements pour un contrat
  const loadPaymentsForContrat = async (contratId: string) => {
    setLoadingPayments(true);

    const { data, error } = await supabase
      .from("contrat_paiements")
      .select(
        `
        id,
        contrat_id,
        date_paiement,
        montant_ht,
        montant_ttc,
        commentaire
      `,
      )
      .eq("contrat_id", contratId)
      .order("date_paiement", { ascending: true });

    setLoadingPayments(false);

    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des paiements", {
        description: error.message,
      });
      setPayments([]);
      return;
    }

    const rows: ContratPaymentRow[] = (data ?? []).map((row) =>
      mapPaymentRow(row as SupabaseContratPaymentRow),
    );

    setPayments(rows);
  };

  useEffect(() => {
    if (!selectedId) {
      setPayments([]);
      return;
    }
    void loadPaymentsForContrat(selectedId);
  }, [selectedId]);

  const totalPaidHt = useMemo(() => {
    if (!payments.length) return null;
    return payments.reduce((sum, p) => sum + (p.montant_ht ?? 0), 0);
  }, [payments]);

  const totalPaidTtc = useMemo(() => {
    if (!payments.length) return null;
    return payments.reduce((sum, p) => sum + (p.montant_ttc ?? 0), 0);
  }, [payments]);

  const handleOpenDetail = (contrat: ContratRow) => {
    setSelected(contrat);
    setOpenDetail(true);
  };

  // Création d’un paiement (via dialog générique)
  const handleCreatePayment = async (
    contrat: ContratRow,
    values: ContratPaymentFormValues,
  ) => {
    const { date_paiement, montant_ht, montant_ttc, commentaire } = values;

    const { data, error } = await supabase
      .from("contrat_paiements")
      .insert({
        contrat_id: contrat.id,
        date_paiement,
        montant_ht,
        montant_ttc,
        commentaire: commentaire || null,
        note: commentaire || null,
      })
      .select(
        `
        id,
        contrat_id,
        date_paiement,
        montant_ht,
        montant_ttc,
        commentaire
      `,
      )
      .single();

    if (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement du paiement", {
        description: error.message,
      });
      return;
    }

    const mapped = mapPaymentRow(data as SupabaseContratPaymentRow);
    setPayments((prev) => [...prev, mapped]);

    toast.success("Paiement enregistré");
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contrats</h1>
      </div>

      {/* Table des contrats */}
      <ContratsTable
        statutIn={[
          "brouillon",
          "en_attente_signature",
          "signe",
          "en_cours",
          "termine",
          "annule",
        ]}
        onRowClick={handleOpenDetail}
        renderRowActions={(contrat) => (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(contrat);
            }}
          >
            Détails
          </Button>
        )}
      />

      {/* Dialog de détail */}
      <ContratDetailDialog
        open={openDetail}
        onOpenChange={(open) => {
          setOpenDetail(open);
          if (!open) {
            setSelected(null);
            setPayments([]);
          }
        }}
        contrat={selected}
        totalPaidHt={totalPaidHt}
        totalPaidTtc={totalPaidTtc}
        payments={payments}
        onOpenPaymentsDialog={(contrat) => {
          setSelected(contrat);
          setOpenPaymentDialog(true);
        }}
        onEditContrat={(contrat) => {
          // ex: router.push(`/dashboard/contrats/${contrat.id}`)
          console.log("Edit contrat", contrat.id);
        }}
      />

      {/* Dialog “Ajouter un paiement” */}
      {selected && (
        <ContratPaymentDialog
          open={openPaymentDialog}
          onOpenChange={setOpenPaymentDialog}
          tvaRatePercent={selected.tva_rate ?? 20}
          onSubmit={async (values) => {
            await handleCreatePayment(selected, values);
          }}
        />
      )}

      {loadingPayments && openDetail && (
        <p className="px-4 text-xs text-muted-foreground">
          Chargement des paiements…
        </p>
      )}
    </div>
  );
}