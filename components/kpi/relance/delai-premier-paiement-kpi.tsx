"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

// Une ligne brute venant de ta vue / table contrat_paiements
// (une ligne par paiement)
export type PaiementRow = {
  contrat_id: string;
  date_signature: string | null;
  date_paiement: string | null;
};

type GlobalStats = {
  delai_moyen_jours: number | null;
  delai_mediane_jours: number | null;
  delai_min_jours: number | null;
  delai_max_jours: number | null;
  nb_contrats: number | null;
};

// Data utilisée pour le chart (une ligne par mois)
type ChartRow = {
  rawDate: Date;
  date: string;        // YYYY-MM-DD (1er jour du mois)
  moisLabel: string;   // "janv. 25"
  delai: number;       // délai moyen en jours
  nb_contrats: number; // nombre de contrats
};

export type DelaiPremierPaiementKpiProps = {
  rows: PaiementRow[]; // ⬅️ tu passes simplement contrat_paiements ici
};

/* -------------------------------------------------------------------------- */
/*                          CONFIG DES COULEURS (KPI)                         */
/* -------------------------------------------------------------------------- */

const chartConfig = {
  delai: {
    label: "Délai moyen (jours)",
    // ✅ même couleur que le KPI CA : hsl(var(--chart-1))
    color: "hsl(var(--chart-1))",
  },
  nb_contrats: {
    label: "Nb contrats",
    // deuxième couleur standard de ton thème
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function formatInt(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("fr-FR");
}

// diff en jours entre 2 dates (en ignorant l'heure)
function diffDays(a: Date, b: Date): number {
  const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diffMs = d1.getTime() - d2.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/* -------------------------------------------------------------------------- */
/*                               COMPOSANT MAIN                               */
/* -------------------------------------------------------------------------- */

export function DelaiPremierPaiementKpi({ rows }: DelaiPremierPaiementKpiProps) {
  const [range, setRange] = React.useState<"12m" | "6m" | "all">("12m");

  // 1) On calcule tout à partir des lignes brutes
  const { globalStats, chartData } = React.useMemo(() => {
    // Étape A : pour chaque contrat, on garde uniquement le 1er paiement
    type PerContrat = {
      contrat_id: string;
      date_signature: Date;
      date_premier_paiement: Date;
      delai_jours: number;
    };

    const perContratMap = new Map<string, PerContrat>();

    for (const row of rows) {
      if (!row.date_signature || !row.date_paiement) continue;

      const dSig = new Date(row.date_signature);
      const dPay = new Date(row.date_paiement);
      if (!Number.isFinite(dSig.getTime()) || !Number.isFinite(dPay.getTime())) {
        continue;
      }

      const existing = perContratMap.get(row.contrat_id);

      if (!existing) {
        // Premier paiement qu'on voit pour ce contrat
        const delai = diffDays(dPay, dSig);
        perContratMap.set(row.contrat_id, {
          contrat_id: row.contrat_id,
          date_signature: dSig,
          date_premier_paiement: dPay,
          delai_jours: delai,
        });
      } else {
        // On garde le paiement le plus tôt
        if (dPay.getTime() < existing.date_premier_paiement.getTime()) {
          const delai = diffDays(dPay, dSig);
          perContratMap.set(row.contrat_id, {
            contrat_id: row.contrat_id,
            date_signature: dSig,
            date_premier_paiement: dPay,
            delai_jours: delai,
          });
        }
      }
    }

    const perContrat = Array.from(perContratMap.values());

    // Étape B : stats globales (moyenne, médiane, min, max, nb contrats)
    let global: GlobalStats = {
      delai_moyen_jours: null,
      delai_mediane_jours: null,
      delai_min_jours: null,
      delai_max_jours: null,
      nb_contrats: null,
    };

    if (perContrat.length > 0) {
      const delays = perContrat.map((c) => c.delai_jours).sort((a, b) => a - b);
      const nb = delays.length;
      const sum = delays.reduce((acc, v) => acc + v, 0);
      const mean = sum / nb;

      let median: number;
      if (nb % 2 === 1) {
        median = delays[(nb - 1) / 2];
      } else {
        median = (delays[nb / 2 - 1] + delays[nb / 2]) / 2;
      }

      global = {
        delai_moyen_jours: mean,
        delai_mediane_jours: median,
        delai_min_jours: delays[0],
        delai_max_jours: delays[nb - 1],
        nb_contrats: nb,
      };
    }

    // Étape C : regrouper par mois du PREMIER paiement
    type Agg = { sumDelai: number; count: number };

    const perMonthMap = new Map<string, Agg>(); // key = "YYYY-MM-01"

    for (const c of perContrat) {
      const d = c.date_premier_paiement;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-01`;

      const agg = perMonthMap.get(key) ?? { sumDelai: 0, count: 0 };
      agg.sumDelai += c.delai_jours;
      agg.count += 1;
      perMonthMap.set(key, agg);
    }

    const chartRows: ChartRow[] = Array.from(perMonthMap.entries()).map(
      ([key, agg]) => {
        const d = new Date(key);
        const delaiMoyen = agg.sumDelai / agg.count;

        return {
          rawDate: d,
          date: key,
          moisLabel: d.toLocaleDateString("fr-FR", {
            month: "short",
            year: "2-digit",
          }),
          delai: delaiMoyen,
          nb_contrats: agg.count,
        };
      }
    );

    chartRows.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    return {
      globalStats: global,
      chartData: chartRows,
    };
  }, [rows]);

  // 2) Filtre de période (6m / 12m / all)
  const filteredData = React.useMemo(() => {
    if (range === "all") return chartData;

    const monthsToKeep = range === "12m" ? 12 : 6;
    if (chartData.length <= monthsToKeep) return chartData;

    return chartData.slice(chartData.length - monthsToKeep);
  }, [chartData, range]);

  const delaiMoyen = globalStats.delai_moyen_jours;
  const delaiMediane = globalStats.delai_mediane_jours;
  const delaiMin = globalStats.delai_min_jours;
  const delaiMax = globalStats.delai_max_jours;
  const nbContrats = globalStats.nb_contrats;

  const hasData = filteredData.length > 0;

  /* ------------------------------------------------------------------------ */
  /*                                   RENDER                                 */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
      {/* Bloc KPI chiffres */}
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle>Délai avant 1er paiement</CardTitle>
          <CardDescription>
            Temps entre la signature du contrat et le premier paiement
            enregistré.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Délai moyen
              </p>
              <p className="mt-1 text-xl font-semibold">
                {delaiMoyen != null ? `${delaiMoyen.toFixed(1)} j` : "—"}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Délai médian
              </p>
              <p className="mt-1 text-xl font-semibold">
                {delaiMediane != null ? `${delaiMediane.toFixed(1)} j` : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Plus rapide
              </p>
              <p className="mt-1 text-lg font-semibold">
                {delaiMin != null ? `${delaiMin.toFixed(0)} j` : "—"}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Plus long
              </p>
              <p className="mt-1 text-lg font-semibold">
                {delaiMax != null ? `${delaiMax.toFixed(0)} j` : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Contrats pris en compte
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatInt(nbContrats)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Uniquement les contrats avec une date de signature et un premier
              paiement.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bloc Chart */}
      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Évolution du délai</CardTitle>
            <CardDescription>
              Délai moyen (en jours) entre signature et premier paiement, par
              mois du premier paiement.
            </CardDescription>
          </div>

          <Select
            value={range}
            onValueChange={(v) => setRange(v as "12m" | "6m" | "all")}
          >
            <SelectTrigger
              className="hidden w-[170px] rounded-lg sm:ml-auto sm:flex"
              aria-label="Filtrer la période"
            >
              <SelectValue placeholder="Derniers mois" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="12m" className="rounded-lg">
                12 derniers mois
              </SelectItem>
              <SelectItem value="6m" className="rounded-lg">
                6 derniers mois
              </SelectItem>
              <SelectItem value="all" className="rounded-lg">
                Tout l&apos;historique
              </SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {hasData ? (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[260px] w-full"
            >
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="fillDelai" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-delai)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-delai)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillNbContrats"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-nb_contrats)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-nb_contrats)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} />

                <XAxis
                  dataKey="moisLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                />

                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={40}
                />

                {/* Nb contrats : deuxième axe mais caché */}
                <YAxis yAxisId="right" hide orientation="right" width={0} />

                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(_label, items) => {
                        const p = items?.[0];
                        if (!p) return "";
                        return `Mois : ${p.payload.moisLabel as string}`;
                      }}
                      formatter={(value, name) => {
                        if (name === "delai") {
                          return [
                            `${(value as number).toFixed(1)} j`,
                            "Délai moyen",
                          ];
                        }
                        if (name === "nb_contrats") {
                          return [`${value as number}`, "Nb contrats"];
                        }
                        return [String(value), String(name)];
                      }}
                    />
                  }
                />

                {/* Délai moyen */}
                <Area
                  yAxisId="left"
                  dataKey="delai"
                  type="natural"
                  fill="url(#fillDelai)"
                  stroke="var(--color-delai)"
                  name="delai"
                />

                {/* Nb contrats */}
                <Area
                  yAxisId="right"
                  dataKey="nb_contrats"
                  type="natural"
                  fill="url(#fillNbContrats)"
                  stroke="var(--color-nb_contrats)"
                  name="nb_contrats"
                />

                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Pas encore assez de données pour afficher le graphique.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}