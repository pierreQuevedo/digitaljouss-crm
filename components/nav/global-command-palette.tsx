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
        // --- Clients ---
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select("id, slug, nom_affichage, nom_legal")
          .or(
            `nom_affichage.ilike.%${term}%,nom_legal.ilike.%${term}%`
          )
          .limit(8);

        if (clientsError) {
          console.error(clientsError);
          toast.error("Erreur lors de la recherche clients");
        }

        const clientRows = (clientsData ?? []) as DbClientRow[];

        const mappedClients: CommandClient[] = clientRows.map(
          (c: DbClientRow): CommandClient => ({
            id: c.id,
            slug: c.slug,
            nom_affichage: c.nom_affichage,
            nom_legal: c.nom_legal,
          })
        );

        // --- Contrats ---
        const { data: contratsData, error: contratsError } = await supabase
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
          .or(`titre.ilike.%${term}%`)
          .limit(8);

        if (contratsError) {
          console.error(contratsError);
          toast.error("Erreur lors de la recherche contrats");
        }

        const contratRows = (contratsData ?? []) as DbContratRow[];

        const mappedContrats: CommandContrat[] = contratRows.map(
          (c: DbContratRow): CommandContrat => {
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
          }
        );

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
      {/* ------------------------------------------------------------------ */}
      {/*  Petit widget de recherche pour la nav (comme sur la doc shadcn)   */}
      {/* ------------------------------------------------------------------ */}
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

      {/* Si tu veux qu’il apparaisse aussi sur mobile, enlève `hidden md:flex` */}
      {/* ou remplace par `flex` directement. */}

      {/* ------------------------------------------------------------------ */}
      {/*                      Command Palette (dialog)                       */}
      {/* ------------------------------------------------------------------ */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Rechercher… (clients, contrats, navigation)"
          value={search}
          onValueChange={setSearch}
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
            <CommandItem onSelect={() => goTo("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>

            <CommandItem onSelect={() => goTo("/dashboard/clients")}>
              <Users className="mr-2 h-4 w-4" />
              <span>Clients</span>
            </CommandItem>

            <CommandItem onSelect={() => goTo("/dashboard/contrats")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Contrats</span>
            </CommandItem>

            <CommandItem
              onSelect={() => goTo("/dashboard/contrats/conception-web")}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Conception web</span>
            </CommandItem>
            <CommandItem
              onSelect={() => goTo("/dashboard/contrats/direction-artistique")}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Direction artistique</span>
            </CommandItem>
            <CommandItem
              onSelect={() => goTo("/dashboard/contrats/strategie-digitale")}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              <span>Contrats – Stratégie digitale</span>
            </CommandItem>
            <CommandItem
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

                return (
                  <CommandItem
                    key={contrat.id}
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