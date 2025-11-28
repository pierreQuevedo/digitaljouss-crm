// app/dashboard/reglages-agence/page.tsx
"use client";

import { AgencyServicesSettings } from "@/components/reglages-agence/agency-services-settings";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export default function AgencySettingsPage() {
  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Réglages agence</h1>
        <p className="text-sm text-muted-foreground">
          Configure les paramètres de l’agence : services, offres et plus.
        </p>
      </header>

      <Tabs defaultValue="services" className="flex-1 flex flex-col">
        <TabsList className="mb-4 w-full justify-start">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="propositions">Propositions & contrats</TabsTrigger>
          <TabsTrigger value="autres">Autres réglages</TabsTrigger>
        </TabsList>

        {/* Onglet Services */}
        <TabsContent value="services" className="flex-1">
          <div className="rounded-xl border bg-card p-4">
            <AgencyServicesSettings />
          </div>
        </TabsContent>

        {/* Onglet Propositions & contrats (placeholder pour l’instant) */}
        <TabsContent value="propositions" className="flex-1">
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            <p>
              Ici tu pourras configurer les modèles de propositions, contrats,
              numérotation, etc. (à implémenter).
            </p>
          </div>
        </TabsContent>

        {/* Onglet Autres réglages (placeholder pour l’instant) */}
        <TabsContent value="autres" className="flex-1">
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            <p>
              Espace réservé pour d’autres réglages de l’agence (notifications,
              branding, etc.).
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}