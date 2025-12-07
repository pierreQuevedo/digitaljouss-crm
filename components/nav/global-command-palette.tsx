// components/layout/global-command-palette.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import {
  LayoutDashboard,
  Users,
  FileText,
  FileSignature,
  Search,
} from "lucide-react";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type DbClientRow = {
  id: string;
  slug: string | null;
  nom_affichage: string | null;
  nom_legal: string | null;
};

type CommandClient = {
  id: string;
  slug: string | null;
  nom_affichage: string | null;
  nom_legal: string | null;
};

type DbContratClientJoined = {
  slug: string | null;
  nom_affichage: string | null;
  nom_legal: string | null;
};

type DbContratRow = {
  id: string;
  slug: string | null;
  titre: string | null;
  client: DbContratClientJoined | DbContratClientJoined[] | null;
};

type CommandContrat = {
  id: string;
  slug: string | null;
  titre: string | null;
  client_slug: string | null;
  client_nom_affichage: string | null;
  client_nom_legal: string | null;
};

/* -------------------------------------------------------------------------- */
/*                                Helpers                                     */
/* -------------------------------------------------------------------------- */

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    result.push(row);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*                                Composant                                   */
/* -------------------------------------------------------------------------- */

export function GlobalCommandPalette() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<CommandClient[]>([]);
  const [contrats, setContrats] = useState<CommandContrat[]>([]);

  // ⌘K / Ctrl+K pour ouvrir / fermer
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset des résultats quand on ferme
  useEffect(() => {
    if (!open) {
      setSearch("");
      setClients([]);
      setContrats([]);
      setLoading(false);
    }
  }, [open]);

  // Recherche côté Supabase (clients + contrats)
  useEffect(() => {
    if (!open) return;
    const term = search.trim();

    if (term.length < 2) {
      setClients([]);
      setContrats([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchResults = async () => {
      try {
        const likeTerm = `%${term}%`;

        /* ------------------------------- CLIENTS ------------------------------ */
        const [
          { data: clientsByNomAff, error: errAff },
          { data: clientsByNomLegal, error: errLegal },
        ] = await Promise.all([
          supabase
            .from("clients")
            .select("id, slug, nom_affichage, nom_legal")
            .ilike("nom_affichage", likeTerm)
            .limit(8),
          supabase
            .from("clients")
            .select("id, slug, nom_affichage, nom_legal")
            .ilike("nom_legal", likeTerm)
            .limit(8),
        ]);

        if (errAff || errLegal) {
          console.error(errAff || errLegal);
          toast.error("Erreur lors de la recherche clients");
        }

        const clientRows = dedupeById<DbClientRow>([
          ...(clientsByNomAff ?? []),
          ...(clientsByNomLegal ?? []),
        ]);

        const mappedClients: CommandClient[] = clientRows.map(
          (c: DbClientRow): CommandClient => ({
            id: c.id,
            slug: c.slug,
            nom_affichage: c.nom_affichage,
            nom_legal: c.nom_legal,
          })
        );

        /* ------------------------------ CONTRATS ------------------------------ */
        const [
          { data: contratsByTitre, error: errTitre },
          { data: contratsAll, error: errAll },
        ] = await Promise.all([
          // filtrage par titre (SQL)
          supabase
            .from("contrats_with_paiements")
            .select(
              `
              id,
              slug,
              titre,
              client:client_id (
                slug,
                nom_affichage,
                nom_legal
              )
            `
            )
            .ilike("titre", likeTerm)
            .limit(30),
          // récupération large pour filtrage sur nom client côté front
          supabase
            .from("contrats_with_paiements")
            .select(
              `
              id,
              slug,
              titre,
              client:client_id (
                slug,
                nom_affichage,
                nom_legal
              )
            `
            )
            .order("created_at", { ascending: false })
            .limit(60),
        ]);

        if (errTitre || errAll) {
          console.error(errTitre || errAll);
          toast.error("Erreur lors de la recherche contrats");
        }

        const rawContrats: DbContratRow[] = dedupeById<DbContratRow>([
          ...(contratsByTitre ?? []),
          ...(contratsAll ?? []),
        ]);

        const lowerTerm = term.toLowerCase();
        const filteredContrats = rawContrats.filter((c) => {
          const clientJoined: DbContratClientJoined | null = Array.isArray(
            c.client
          )
            ? c.client[0] ?? null
            : c.client;

          const haystack = [
            c.titre ?? "",
            clientJoined?.nom_affichage ?? "",
            clientJoined?.nom_legal ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(lowerTerm);
        });

        const mappedContrats: CommandContrat[] = filteredContrats
          .slice(0, 12)
          .map((c: DbContratRow): CommandContrat => {
            const clientJoined: DbContratClientJoined | null = Array.isArray(
              c.client
            )
              ? c.client[0] ?? null
              : c.client;

            return {
              id: c.id,
              slug: c.slug,
              titre: c.titre,
              client_slug: clientJoined?.slug ?? null,
              client_nom_affichage: clientJoined?.nom_affichage ?? null,
              client_nom_legal: clientJoined?.nom_legal ?? null,
            };
          });

        if (cancelled) return;

        setClients(mappedClients);
        setContrats(mappedContrats);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timeout = setTimeout(() => {
      void fetchResults();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, open]);

  const goTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const labelClient = (c: CommandClient) =>
    c.nom_affichage || c.nom_legal || "Client sans nom";

  const labelContrat = (c: CommandContrat) => c.titre || "Contrat sans titre";

  return (
    <>
      {/* Widget de recherche dans la nav */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden w-72 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground md:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Rechercher…</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center rounded border px-1 py-0.5 font-mono">
            ⌘K
          </span>
        </span>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher… (clients, contrats, navigation)"
          onValueChange={setSearch}
          className="!h-8 px-3"
        />
        <CommandList>
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Search className="h-3 w-3" />
              Recherche en cours…
            </div>
          )}

          <CommandEmpty>
            {search.trim().length < 2
              ? "Tape au moins 2 caractères pour rechercher."
              : "Aucun résultat."}
          </CommandEmpty>

          {/* NAVIGATION */}
          <CommandGroup heading="Navigation">
            <CommandItem value="dashboard" onSelect={() => goTo("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>

            <CommandItem
              value="clients"
              onSelect={() => goTo("/dashboard/clients")}
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Clients</span>
            </CommandItem>

            <CommandItem
              value="contrats"
              onSelect={() => goTo("/dashboard/contrats")}
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>Contrats</span>
            </CommandItem>

            <CommandItem
              value="contrats conception web"
              onSelect={() => goTo("/dashboard/contrats/conception-web")}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Conception web</span>
            </CommandItem>
            <CommandItem
              value="contrats direction artistique"
              onSelect={() => goTo("/dashboard/contrats/direction-artistique")}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Direction artistique</span>
            </CommandItem>
            <CommandItem
              value="contrats strategie digitale"
              onSelect={() => goTo("/dashboard/contrats/strategie-digitale")}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Stratégie digitale</span>
            </CommandItem>
            <CommandItem
              value="contrats social media management"
              onSelect={() =>
                goTo("/dashboard/contrats/social-media-management")
              }
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Social media management</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* CLIENTS */}
          {clients.length > 0 && (
            <CommandGroup heading="Clients">
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={labelClient(client).toLowerCase()}
                  onSelect={() => {
                    if (!client.slug) {
                      toast.error(
                        "Impossible d’ouvrir le client (slug manquant)."
                      );
                      return;
                    }
                    goTo(`/dashboard/clients/${client.slug}`);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>{labelClient(client)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* CONTRATS */}
          {contrats.length > 0 && (
            <CommandGroup heading="Contrats">
              {contrats.map((contrat) => {
                const clientLabel =
                  contrat.client_nom_affichage ||
                  contrat.client_nom_legal ||
                  "Client inconnu";

                const itemValue = `${labelContrat(
                  contrat
                )} ${clientLabel}`.toLowerCase();

                return (
                  <CommandItem
                    key={contrat.id}
                    value={itemValue}
                    onSelect={() => {
                      if (!contrat.client_slug || !contrat.slug) {
                        toast.error(
                          "Impossible d’ouvrir le contrat (slug client ou contrat manquant)."
                        );
                        return;
                      }
                      goTo(
                        `/dashboard/clients/${contrat.client_slug}/contrats/${contrat.slug}`
                      );
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{labelContrat(contrat)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {clientLabel}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex items-center justify-end px-3 pb-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">
            <kbd className="font-mono">⌘</kbd>
            <kbd className="font-mono">K</kbd>
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
