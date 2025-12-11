// components/relance/relance-table.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { createClient } from "@/lib/supabase/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

const supabase = createClient();

type RelanceNiveau = "none" | "t1" | "t2" | "t3" | "t4";
type RelanceStatut = "none" | "r1" | "r2" | "r3";

type DbRelanceRow = {
  id: string; // id de la vue = id du contrat dans contrats_with_paiements
  contrat_id: string; // id réel dans la table contrats
  client_id: string;
  slug: string | null;
  client_slug: string | null;
  titre: string | null;
  statut: string;
  date_signature: string | null;
  montant_ttc: number | string | null;
  total_paye_ttc: number | string | null;
  reste_a_payer_ttc: number | string | null;
  jours_depuis_signature: number | string;
  relance_statut: string | null;
  relance_date: string | null;
};

export type RelanceRow = {
  id: string; // id de la vue
  contrat_id: string; // id réel du contrat (table contrats)
  client_id: string;
  contrat_slug: string | null;
  client_slug: string | null;

  titre: string;
  statut: string;
  date_signature: string | null;
  montant_ttc: number | null;
  total_paye_ttc: number;
  reste_a_payer_ttc: number;
  jours_depuis_signature: number;

  niveau: RelanceNiveau;

  relance_statut: RelanceStatut;
  relance_date: string | null;

  jours_depuis_ref: number;
};

/* -------------------------------------------------------------------------- */
/*                              HELPERS / FORMAT                              */
/* -------------------------------------------------------------------------- */

function safeNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMontant(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const NIVEAU_LABEL: Record<RelanceNiveau, string> = {
  none: "Pas besoin de relance",
  t1: "N1 – Première relance",
  t2: "N2 – Relance soutenue",
  t3: "N3 – Relance forte",
  t4: "N4 – Critique",
};

const NIVEAU_BADGE_CLASS: Record<RelanceNiveau, string> = {
  none: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-100",
  t1: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100",
  t2: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-100",
  t3: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-100",
  t4: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-100",
};

/**
 * Niveau de relance automatique en fonction des jours depuis référence (dernière relance ou signature)
 *
 *  - < t1Max  -> none
 *  - < t2Max  -> t1
 *  - < t3Max  -> t2
 *  - == t3Max -> t3
 *  - > t3Max  -> t4
 */
function computeNiveau(
  jours: number,
  t1Max: number,
  t2Max: number,
  t3Max: number
): RelanceNiveau {
  if (jours < t1Max) return "none";
  if (jours < t2Max) return "t1";
  if (jours < t3Max) return "t2";
  if (jours === t3Max) return "t3";
  return "t4";
}

/* -------------------------------------------------------------------------- */
/*                               COMPOSANT MAIN                               */
/* -------------------------------------------------------------------------- */

export function RelanceTable() {
  const router = useRouter();

  const [rows, setRows] = useState<RelanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Seuils récupérés depuis agence_settings
  const [thresholds, setThresholds] = useState<{
    t1Max: number;
    t2Max: number;
    t3Max: number;
  }>({
    t1Max: 7,
    t2Max: 14,
    t3Max: 30,
  });

  // Filtres UI
  const [search, setSearch] = useState("");
  const [niveauFilter, setNiveauFilter] = useState<"all" | RelanceNiveau>(
    "all"
  );

  const [updatingRelanceId, setUpdatingRelanceId] = useState<string | null>(
    null
  );

  /* ------------------------------ Fetch Supabase --------------------------- */

  useEffect(() => {
    const fetchRelance = async () => {
      setLoading(true);

      try {
        // 1) Seuils
        const { data: settings, error: settingsError } = await supabase
          .from("agence_settings")
          .select("relance_seuil_1, relance_seuil_2, relance_seuil_3")
          .single();

        let t1Max = 7;
        let t2Max = 14;
        let t3Max = 30;

        if (settingsError) {
          console.error("Erreur agence_settings :", settingsError.message);
        } else if (settings) {
          t1Max = settings.relance_seuil_1 ?? t1Max;
          t2Max = settings.relance_seuil_2 ?? t2Max;
          t3Max = settings.relance_seuil_3 ?? t3Max;
        }

        setThresholds({ t1Max, t2Max, t3Max });
        console.log("Relance thresholds from DB:", { t1Max, t2Max, t3Max });

        // 2) Données de relance
        const { data, error } = await supabase
          .from("contrats_relance")
          .select(
            `
              id,
              contrat_id,
              client_id,
              slug,
              client_slug,
              titre,
              statut,
              date_signature,
              montant_ttc,
              total_paye_ttc,
              reste_a_payer_ttc,
              jours_depuis_signature,
              relance_statut,
              relance_date
            `
          )
          .order("jours_depuis_signature", { ascending: false });

        if (error) {
          console.error("Erreur contrats_relance:", error);
          toast.error("Erreur lors du chargement des contrats à relancer", {
            description: error.message,
          });
          setRows([]);
          return;
        }

        const raw = (data ?? []) as DbRelanceRow[];

        const today = new Date();
        const todayAtMidnight = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        // 🔎 ➜ on enlève tous les contrats qui ont déjà un paiement (> 0)
        const rawUnpaid = raw.filter(
          (row) => safeNumber(row.total_paye_ttc) === 0
        );

        const mapped: RelanceRow[] = rawUnpaid.map((row) => {
          const joursSignature = safeNumber(row.jours_depuis_signature);

          // Jours depuis dernière relance si dispo, sinon depuis signature
          let joursRef = joursSignature;

          if (row.relance_date) {
            const d = new Date(row.relance_date);
            const dMidnight = new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate()
            );
            const diffMs = todayAtMidnight.getTime() - dMidnight.getTime();
            joursRef = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          }

          const reste = safeNumber(row.reste_a_payer_ttc);
          const totalPaye = safeNumber(row.total_paye_ttc);
          const montant =
            row.montant_ttc == null ? null : safeNumber(row.montant_ttc);

          const niveau = computeNiveau(joursRef, t1Max, t2Max, t3Max);

          const relanceStatut: RelanceStatut =
            (row.relance_statut as RelanceStatut | null) ?? "none";

          return {
            id: row.id,
            contrat_id: row.contrat_id,
            client_id: row.client_id,
            contrat_slug: row.slug,
            client_slug: row.client_slug,
            titre: row.titre ?? "Sans titre",
            statut: row.statut,
            date_signature: row.date_signature,
            montant_ttc: montant,
            total_paye_ttc: totalPaye,
            reste_a_payer_ttc: reste,
            jours_depuis_signature: joursSignature,
            niveau,
            relance_statut: relanceStatut,
            relance_date: row.relance_date,
            jours_depuis_ref: joursRef,
          };
        });

        setRows(mapped);
      } finally {
        setLoading(false);
      }
    };

    void fetchRelance();
  }, []);

  /* ------------------------------ Filtres front ---------------------------- */

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (niveauFilter !== "all" && r.niveau !== niveauFilter) {
        return false;
      }

      if (!q) return true;

      const content = [r.titre, r.statut].join(" ").toLowerCase();
      return content.includes(q);
    });
  }, [rows, search, niveauFilter]);

  /* ---------------------- Update statut de relance (manuel) ---------------- */

  const handleUpdateRelanceStatut = async (
    contratDbId: string, // id réel de la table contrats
    newStatut: RelanceStatut
  ) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { t1Max, t2Max, t3Max } = thresholds;

    // 🔁 Optimistic update côté UI
    setRows((prev) =>
      prev.map((r) => {
        if (r.contrat_id !== contratDbId) return r;

        // 🅰️ Cas "Non relancé" → on supprime la date, et on recalcule le niveau
        // à partir des jours depuis la signature
        if (newStatut === "none") {
          const joursRef = r.jours_depuis_signature;
          const nouveauNiveau = computeNiveau(joursRef, t1Max, t2Max, t3Max);

          return {
            ...r,
            relance_statut: "none",
            relance_date: null,
            jours_depuis_ref: joursRef,
            niveau: nouveauNiveau,
          };
        }

        // 🅱️ Cas Relance 1 / 2 / 3 → on met la date à aujourd’hui
        const joursRef = 0;
        const nouveauNiveau = computeNiveau(joursRef, t1Max, t2Max, t3Max);

        return {
          ...r,
          relance_statut: newStatut,
          relance_date: todayStr,
          jours_depuis_ref: joursRef,
          niveau: nouveauNiveau,
        };
      })
    );

    setUpdatingRelanceId(contratDbId);

    try {
      // 📦 En DB : si "none" -> relance_date = null, sinon today
      const relanceDateForDb = newStatut === "none" ? null : todayStr;

      const { error } = await supabase
        .from("contrats")
        .update({
          relance_statut: newStatut,
          relance_date: relanceDateForDb,
        })
        .eq("id", contratDbId);

      if (error) {
        console.error("[relance] update error", error);
        throw error;
      }

      // Optionnel : refetch depuis la vue pour vérifier
      const { data: refreshed, error: refetchError } = await supabase
        .from("contrats_relance")
        .select("id, contrat_id, relance_statut, relance_date")
        .eq("contrat_id", contratDbId)
        .maybeSingle();

      console.log("[relance] refreshed from view", { refreshed, refetchError });

      toast.success("Statut de relance mis à jour");
    } catch (err: unknown) {
      console.error("[relance] update error (catch)", err);

      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Erreur inconnue";

      toast.error("Erreur lors de la mise à jour du statut de relance", {
        description: message,
      });
    } finally {
      setUpdatingRelanceId(null);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */

  const { t1Max, t2Max, t3Max } = thresholds;

  return (
    <div className="flex flex-col gap-3">
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher (titre, statut...)"
          className="h-8 max-w-xs text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Filtre par niveau de relance */}
        <Select
          value={niveauFilter}
          onValueChange={(v) => setNiveauFilter(v as "all" | RelanceNiveau)}
        >
          <SelectTrigger className="h-8 w-[220px] text-xs">
            <SelectValue placeholder="Tous les niveaux de relance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            <SelectItem value="none">{NIVEAU_LABEL.none}</SelectItem>
            <SelectItem value="t1">{NIVEAU_LABEL.t1}</SelectItem>
            <SelectItem value="t2">{NIVEAU_LABEL.t2}</SelectItem>
            <SelectItem value="t3">{NIVEAU_LABEL.t3}</SelectItem>
            <SelectItem value="t4">{NIVEAU_LABEL.t4}</SelectItem>
          </SelectContent>
        </Select>

        {Boolean(search || niveauFilter !== "all") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch("");
              setNiveauFilter("all");
            }}
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-medium">Contrat</TableHead>
              <TableHead className="text-xs font-medium">
                Date signature
              </TableHead>
              <TableHead className="text-xs font-medium text-right">
                Jours depuis signature
              </TableHead>
              <TableHead className="text-xs font-medium text-right">
                Montant TTC
              </TableHead>
              <TableHead className="text-xs font-medium text-right">
                Total payé TTC
              </TableHead>
              <TableHead className="text-xs font-medium text-right">
                Reste à payer TTC
              </TableHead>
              <TableHead className="text-xs font-medium text-right">
                Statut relance
              </TableHead>
              <TableHead className="text-xs font-medium">
                Dernière relance
              </TableHead>
              <TableHead className="text-xs font-medium text-right">
                Niveau relance
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Chargement des contrats à relancer…
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Aucun contrat à relancer selon ces critères.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  {/* Titre cliquable */}
                  <TableCell className="align-middle">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="w-fit text-left text-sm font-medium text-primary hover:underline"
                        onClick={() => {
                          if (row.client_slug && row.contrat_slug) {
                            router.push(
                              `/dashboard/clients/${row.client_slug}/contrats/${row.contrat_slug}`
                            );
                          } else {
                            toast.error(
                              "Impossible d’ouvrir le contrat (slug manquant)."
                            );
                          }
                        }}
                      >
                        {row.titre}
                      </button>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        Statut : {row.statut}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="align-middle text-xs">
                    {row.date_signature
                      ? format(new Date(row.date_signature), "dd MMM yyyy", {
                          locale: fr,
                        })
                      : "—"}
                  </TableCell>

                  <TableCell className="align-middle text-right text-xs">
                    {row.jours_depuis_signature} j
                  </TableCell>

                  <TableCell className="align-middle text-right text-xs">
                    {formatMontant(row.montant_ttc)}
                  </TableCell>

                  <TableCell className="align-middle text-right text-xs">
                    {formatMontant(row.total_paye_ttc)}
                  </TableCell>

                  <TableCell className="align-middle text-right text-xs font-medium">
                    {formatMontant(row.reste_a_payer_ttc)}
                  </TableCell>

                  {/* Statut relance (manuel) */}
                  <TableCell className="align-middle text-right text-xs">
                    <Select
                      value={row.relance_statut}
                      onValueChange={(v) =>
                        handleUpdateRelanceStatut(
                          row.contrat_id,
                          v as RelanceStatut
                        )
                      }
                      disabled={updatingRelanceId === row.contrat_id}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non relancé</SelectItem>
                        <SelectItem value="r1">Relance 1</SelectItem>
                        <SelectItem value="r2">Relance 2</SelectItem>
                        <SelectItem value="r3">Relance 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Date de dernière relance */}
                  <TableCell className="align-middle text-xs">
                    {row.relance_date
                      ? format(new Date(row.relance_date), "dd MMM yyyy", {
                          locale: fr,
                        })
                      : "—"}
                  </TableCell>

                  <TableCell className="align-middle text-right">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium ${
                        NIVEAU_BADGE_CLASS[row.niveau]
                      }`}
                    >
                      {NIVEAU_LABEL[row.niveau]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Petit rappel des seuils actuels */}
      <p className="text-[11px] text-muted-foreground">
        Seuils actuels : &lt; {t1Max} j → Pas besoin de relance • ensuite N1 /
        N2 / N3 / N4 selon les seuils {t1Max}, {t2Max}, {t3Max}
      </p>
    </div>
  );
}
