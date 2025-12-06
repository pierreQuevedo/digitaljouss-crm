// components/kpi/contrats/kpi-contrats-en-attente.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type DbClientFromJoin = {
  slug: string | null;
  nom_affichage: string | null;
  nom_legal: string | null;
};

type DbContratEnAttenteRow = {
  id: string;
  slug: string | null;
  client_id: string;
  titre: string | null;
  montant_ht: number | string | null;
  statut: string;
  date_devis_envoi: string | null;
  created_at: string;
  client: DbClientFromJoin | DbClientFromJoin[] | null;
};

type ContratEnAttenteRow = {
  id: string;
  slug: string | null;
  client_slug: string | null;
  client_nom_affichage: string | null;
  client_nom_legal: string | null;
  titre: string;
  montant_ht: number | null;
  base_date: string; // date utilisée pour le calcul
  jours_en_attente: number;
};

/* -------------------------------------------------------------------------- */
/*                                Helpers                                     */
/* -------------------------------------------------------------------------- */

function formatEuro(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function diffInDays(from: string): number {
  const base = new Date(from);
  if (Number.isNaN(base.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - base.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/* -------------------------------------------------------------------------- */
/*                                Composant                                   */
/* -------------------------------------------------------------------------- */

export function KpiContratsEnAttente({
  className,
}: {
  className?: string;
}) {
  const [rows, setRows] = useState<ContratEnAttenteRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEnAttente = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("contrats")
          .select(
            `
            id,
            slug,
            client_id,
            titre,
            montant_ht,
            statut,
            date_devis_envoi,
            created_at,
            client:client_id (
              slug,
              nom_affichage,
              nom_legal
            )
          `
          )
          .eq("statut", "en_attente_signature")
          .order("date_devis_envoi", { ascending: true });

        if (error) {
          console.error(error);
          toast.error(
            "Erreur lors du chargement des contrats en attente de signature",
            {
              description: error.message,
            }
          );
          setRows([]);
          return;
        }

        const raw = (data ?? []) as DbContratEnAttenteRow[];

        const mapped: ContratEnAttenteRow[] = raw.map((row) => {
          const clientJoined: DbClientFromJoin | null = Array.isArray(
            row.client
          )
            ? row.client[0] ?? null
            : row.client;

          const montant =
            row.montant_ht == null
              ? null
              : typeof row.montant_ht === "number"
              ? row.montant_ht
              : Number(row.montant_ht);

          // base_date = date_devis_envoi si présente, sinon created_at
          const baseDate = row.date_devis_envoi ?? row.created_at;
          const joursEnAttente = diffInDays(baseDate);

          return {
            id: row.id,
            slug: row.slug,
            client_slug: clientJoined?.slug ?? null,
            client_nom_affichage: clientJoined?.nom_affichage ?? null,
            client_nom_legal: clientJoined?.nom_legal ?? null,
            titre: row.titre ?? "Sans titre",
            montant_ht: Number.isFinite(montant) ? montant : null,
            base_date: baseDate,
            jours_en_attente: joursEnAttente,
          };
        });

        // On trie par nb de jours décroissant (ceux à relancer en premier)
        mapped.sort((a, b) => b.jours_en_attente - a.jours_en_attente);

        setRows(mapped);
      } finally {
        setLoading(false);
      }
    };

    void fetchEnAttente();
  }, []);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Contrats en attente de signature
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Liste des clients à relancer (statut “en attente signature”)
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun contrat en attente de signature pour le moment 👍
          </p>
        ) : (
          <div className="max-h-80 overflow-auto rounded border bg-background">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="px-2 py-1 text-left text-xs font-medium">
                    Client
                  </TableHead>
                  <TableHead className="px-2 py-1 text-left text-xs font-medium">
                    Contrat
                  </TableHead>
                  <TableHead className="px-2 py-1 text-right text-xs font-medium">
                    Montant HT
                  </TableHead>
                  <TableHead className="px-2 py-1 text-right text-xs font-medium">
                    Jours en attente
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((c) => {
                  const clientLabel =
                    c.client_nom_affichage ||
                    c.client_nom_legal ||
                    "Client inconnu";

                  const dateBaseStr = new Date(c.base_date).toLocaleDateString(
                    "fr-FR"
                  );

                  const isLongWaiting = c.jours_en_attente >= 14; // seuil relance

                  return (
                    <TableRow
                      key={c.id}
                      className="border-t transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="px-2 py-1 align-middle">
                        {c.client_slug ? (
                          <Link
                            href={`/dashboard/clients/${c.client_slug}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {clientLabel}
                          </Link>
                        ) : (
                          <span className="text-xs">{clientLabel}</span>
                        )}
                      </TableCell>

                      <TableCell className="px-2 py-1 align-middle">
                        {c.client_slug && c.slug ? (
                          <Link
                            href={`/dashboard/clients/${c.client_slug}/contrats/${c.slug}`}
                            className="text-[11px] text-muted-foreground hover:underline"
                          >
                            {c.titre}
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {c.titre}
                          </span>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          Depuis le {dateBaseStr}
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-1 align-middle text-right text-xs">
                        {formatEuro(c.montant_ht)}
                      </TableCell>

                      <TableCell
                        className={cn(
                          "px-2 py-1 align-middle text-right text-xs font-semibold",
                          isLongWaiting
                            ? "text-red-600"
                            : c.jours_en_attente >= 7
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {c.jours_en_attente} j
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}