"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ClientKpiRow = {
  id: string;
  nom_affichage: string;
  statut_client:
    | "prospect"
    | "propo_envoyee"
    | "client_actif"
    | "client_inactif"
    | "perdu"
    | "propo_refusee";
  ca_total_ht: number | null;
  nb_contrats_actifs: number | null;
  created_at: string;
};

const statutLabel: Record<ClientKpiRow["statut_client"], string> = {
  prospect: "Prospect",
  propo_envoyee: "Propo envoyée",
  client_actif: "Client actif",
  client_inactif: "Client inactif",
  perdu: "Perdu",
  propo_refusee: "Propo refusée",
};

function statutColor(statut: ClientKpiRow["statut_client"]) {
  switch (statut) {
    case "client_actif":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "propo_envoyee":
    case "propo_refusee":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "perdu":
      return "bg-red-50 text-red-700 border-red-200";
    case "client_inactif":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "prospect":
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

export default function ClientsKpiPage() {
  const supabase = createClient();

  const [data, setData] = React.useState<ClientKpiRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchKpi() {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select(
          `
          id,
          nom_affichage,
          statut_client,
          ca_total_ht,
          nb_contrats_actifs,
          created_at
        `
        )
        .order("ca_total_ht", { ascending: false });

      if (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des KPI clients", {
          description: error.message,
        });
      } else {
        const rows = (data ?? []).map((c) => ({
          ...c,
          ca_total_ht:
            c.ca_total_ht === null || c.ca_total_ht === undefined
              ? null
              : Number(c.ca_total_ht),
          nb_contrats_actifs:
            c.nb_contrats_actifs === null || c.nb_contrats_actifs === undefined
              ? null
              : Number(c.nb_contrats_actifs),
        })) as ClientKpiRow[];

        setData(rows);
      }
      setLoading(false);
    }

    fetchKpi();
  }, [supabase]);

  // Agrégations KPI
  const totalCa = React.useMemo(
    () =>
      data.reduce(
        (sum, c) => sum + (c.ca_total_ht ? Number(c.ca_total_ht) : 0),
        0,
      ),
    [data],
  );

  const totalClients = data.length;
  const activeClients = data.filter(
    (c) => c.statut_client === "client_actif",
  ).length;

  const totalActiveContracts = data.reduce(
    (sum, c) => sum + (c.nb_contrats_actifs ?? 0),
    0,
  );

  const avgCaPerClient = totalClients ? totalCa / totalClients : 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);

  const topClients = data.slice(0, 10);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            KPI Clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue d’ensemble des performances clients : CA, activité et contrats.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              CA total clients (HT)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? "—" : formatCurrency(totalCa)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Somme de tous les CA clients depuis le début.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Clients actifs / total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? "—" : `${activeClients} / ${totalClients}`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Basé sur le statut <span className="font-semibold">client actif</span>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              CA moyen par client (HT)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading || !totalClients ? "—" : formatCurrency(avgCaPerClient)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Moyenne sur l’ensemble des clients.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Contrats actifs (total)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? "—" : totalActiveContracts}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Somme de contrats actifs sur tous les clients.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top clients table */}
      <Card className="mt-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Top clients par CA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium w-[40%]">
                    Client
                  </TableHead>
                  <TableHead className="text-xs font-medium">
                    Statut
                  </TableHead>
                  <TableHead className="text-xs font-medium text-right">
                    CA total HT
                  </TableHead>
                  <TableHead className="text-xs font-medium text-right">
                    Contrats actifs
                  </TableHead>
                  <TableHead className="text-xs font-medium text-right hidden md:table-cell">
                    Depuis
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Chargement des KPI clients...
                    </TableCell>
                  </TableRow>
                ) : topClients.length ? (
                  topClients.map((client) => {
                    const ca = client.ca_total_ht
                      ? formatCurrency(client.ca_total_ht)
                      : "—";
                    const created = client.created_at
                      ? new Date(client.created_at).toLocaleDateString("fr-FR")
                      : "—";

                    return (
                      <TableRow key={client.id}>
                        <TableCell className="align-middle">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {client.nom_affichage}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border px-2 py-0.5 text-[11px] font-medium",
                              statutColor(client.statut_client),
                            )}
                          >
                            {statutLabel[client.statut_client]}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-middle text-right text-sm">
                          {ca}
                        </TableCell>
                        <TableCell className="align-middle text-right text-sm">
                          {client.nb_contrats_actifs ?? 0}
                        </TableCell>
                        <TableCell className="align-middle text-right text-xs text-muted-foreground hidden md:table-cell">
                          {created}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Aucun client avec des KPI pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}