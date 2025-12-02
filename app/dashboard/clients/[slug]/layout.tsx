// app/dashboard/clients/[slug]/layout.tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import type { ClientRow } from "./client-types";
import { ClientProvider } from "./client-context";

const supabase = createClient();

type LayoutProps = {
  children: React.ReactNode;
  // ⬇️ params est maintenant un Promise
  params: Promise<{ slug: string }>;
};

export default function ClientLayout({ children, params }: LayoutProps) {
  // ⬇️ on “débloque” params ici
  const { slug } = use(params);

  const router = useRouter();
  const segment = useSelectedLayoutSegment(); // "contrats" | "propositions" | null
  const [client, setClient] = useState<ClientRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const { data, error } = await supabase
          .from("clients")
          .select(
            `
            id,
            nom_legal,
            nom_affichage,
            statut_client,
            type_client,
            secteur_activite,
            site_web_principal,
            email_general,
            telephone_general,
            contact_principal_nom,
            contact_principal_prenom,
            contact_principal_role,
            contact_principal_email,
            contact_principal_telephone,
            notes_internes,
            logo_url,
            slug
          `
          )
          .eq("slug", slug)
          .single();

        if (error || !data) {
          console.error(error);
          toast.error("Client introuvable");
          router.push("/dashboard/clients");
          return;
        }

        setClient(data as ClientRow);
      } catch (err) {
        console.error(err);
        toast.error("Erreur lors du chargement du client");
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchClient();
    }
  }, [slug, router]);

  const currentTab = segment ?? "details";

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Impossible de charger ce client.
      </div>
    );
  }

  return (
    <ClientProvider client={client}>
      <div className="p-6 space-y-6">
        {/* Header client */}
        <div>
          <h1 className="text-2xl font-semibold">
            {client.nom_affichage || client.nom_legal || "Client"}
          </h1>
          {client.slug && (
            <p className="text-sm text-muted-foreground">Slug : {client.slug}</p>
          )}
        </div>

        {/* Tabs + contenu de page */}
        <Tabs value={currentTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details" asChild>
              <Link href={`/dashboard/clients/${slug}`}>Détails</Link>
            </TabsTrigger>

            <TabsTrigger value="contrats" asChild>
              <Link href={`/dashboard/clients/${slug}/contrats`}>
                Contrats
              </Link>
            </TabsTrigger>

            <TabsTrigger value="propositions" asChild>
              <Link href={`/dashboard/clients/${slug}/propositions`}>
                Propositions
              </Link>
            </TabsTrigger>
            <TabsTrigger value="facturation" asChild>
              <Link href={`/dashboard/clients/${slug}/facturation`}>
                Facturation
              </Link>
            </TabsTrigger>
          </TabsList>

          {children}
        </Tabs>
      </div>
    </ClientProvider>
  );
}