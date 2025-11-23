// components/clients/client-add-sheet.tsx
"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";

// ---------- Types services actifs (même modèle que dans clients-table) ----------

type ServiceFamilyKey =
  | "strategie_digitale"
  | "direction_artistique"
  | "conception_web"
  | "social_media_management";

type ServicesActifs = Partial<Record<ServiceFamilyKey, Record<string, boolean>>>;

type ServiceItem = {
  label: string;
  value: string; // ex: "strategie_digitale.audit"
};

const SERVICE_ITEMS: ServiceItem[] = [
  // Stratégie digitale
  { label: "Stratégie • Audit", value: "strategie_digitale.audit" },
  { label: "Stratégie • Process", value: "strategie_digitale.process" },
  { label: "Stratégie • SEO", value: "strategie_digitale.seo" },
  { label: "Stratégie • SEA", value: "strategie_digitale.sea" },
  { label: "Stratégie • SMO", value: "strategie_digitale.smo" },
  { label: "Stratégie • SMA", value: "strategie_digitale.sma" },

  // Direction artistique
  {
    label: "DA • Identité visuelle",
    value: "direction_artistique.identite_visuelle",
  },
  { label: "DA • Print", value: "direction_artistique.print" },
  { label: "DA • UI / UX design", value: "direction_artistique.ui_ux_design" },
  { label: "DA • Motion design", value: "direction_artistique.motion_design" },

  // Conception web
  { label: "Web • Landing page", value: "conception_web.landing_page" },
  { label: "Web • Site vitrine", value: "conception_web.site_vitrine" },
  { label: "Web • E-commerce", value: "conception_web.ecommerce" },
  { label: "Web • Application", value: "conception_web.application" },
  { label: "Web • Plateforme", value: "conception_web.plateforme" },
  { label: "Web • Appel d’offres", value: "conception_web.appel_offres" },

  // Social media management
  {
    label: "Social • Réseaux sociaux",
    value: "social_media_management.reseaux_sociaux",
  },
  { label: "Social • Réels", value: "social_media_management.reels" },
  { label: "Social • Vidéos", value: "social_media_management.videos" },
  { label: "Social • Photos", value: "social_media_management.photos" },
];

function parseServiceValue(
  value: string,
): { family: ServiceFamilyKey; key: string } | null {
  const [family, key] = value.split(".");
  if (!family || !key) return null;
  if (
    family !== "strategie_digitale" &&
    family !== "direction_artistique" &&
    family !== "conception_web" &&
    family !== "social_media_management"
  ) {
    return null;
  }
  return { family: family as ServiceFamilyKey, key };
}

function buildServicesActifsFromItems(items: ServiceItem[]): ServicesActifs {
  const result: ServicesActifs = {};

  for (const item of items) {
    const parsed = parseServiceValue(item.value);
    if (!parsed) continue;
    if (!result[parsed.family]) {
      result[parsed.family] = {};
    }
    result[parsed.family]![parsed.key] = true;
  }

  return result;
}

// ---------- Composant principal ----------

type ClientAddSheetProps = {
  onCreated?: () => void;
  className?: string;
};

export function ClientAddSheet({ onCreated, className }: ClientAddSheetProps) {
  const supabase = createClient();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<ServiceItem[]>(
    [],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const nom_affichage = (formData.get("nom_affichage") as string)?.trim();
    const nom_legal = (formData.get("nom_legal") as string)?.trim();
    const email_general = (formData.get("email_general") as string) || null;
    const site_web_principal =
      (formData.get("site_web_principal") as string) || null;
    const statut_client =
      ((formData.get("statut_client") as string) ||
        "prospect") as
        | "prospect"
        | "propo_envoyee"
        | "client_actif"
        | "client_inactif"
        | "perdu"
        | "propo_refusee";
    const origine_lead =
      ((formData.get("origine_lead") as string) ||
        null) as
        | "inbound"
        | "recommandation"
        | "appel_offres"
        | "linkedin"
        | null;
    const notes_internes =
      (formData.get("notes_internes") as string) || null;

    if (!nom_affichage || !nom_legal) {
      toast.error("Champs obligatoires manquants", {
        description: "Nom légal et nom d’affichage sont requis.",
      });
      return;
    }

    const services_actifs = buildServicesActifsFromItems(selectedServices);

    try {
      setLoading(true);

      const { error } = await supabase.from("clients").insert([
        {
          nom_affichage,
          nom_legal,
          email_general,
          site_web_principal,
          statut_client,
          origine_lead,
          notes_internes,
          services_actifs,
        },
      ]);

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la création du client", {
          description: error.message,
        });
        return;
      }

      toast.success("Client créé", {
        description: `${nom_affichage} a été ajouté à la base.`,
      });

      form.reset();
      setSelectedServices([]);
      setOpen(false);
      onCreated?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className={className}>
          Ajouter un client
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Ajouter un client</SheetTitle>
          <SheetDescription>
            Renseigne les informations principales du client. Tu pourras
            compléter le reste plus tard.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {/* Identité */}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nom_affichage">Nom d’affichage *</Label>
              <Input
                id="nom_affichage"
                name="nom_affichage"
                placeholder="Nom utilisé dans le CRM"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nom_legal">Nom légal *</Label>
              <Input
                id="nom_legal"
                name="nom_legal"
                placeholder="Raison sociale complète"
                required
              />
            </div>
          </div>

          {/* Coordonnées */}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="site_web_principal">Site web</Label>
              <Input
                id="site_web_principal"
                name="site_web_principal"
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email_general">Email général</Label>
              <Input
                id="email_general"
                name="email_general"
                type="email"
                placeholder="contact@exemple.com"
              />
            </div>
          </div>

          {/* Statut / origine */}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="statut_client">Statut client</Label>
              <Select name="statut_client" defaultValue="prospect">
                <SelectTrigger id="statut_client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="propo_envoyee">
                    Proposition envoyée
                  </SelectItem>
                  <SelectItem value="client_actif">Client actif</SelectItem>
                  <SelectItem value="client_inactif">
                    Client inactif
                  </SelectItem>
                  <SelectItem value="perdu">Perdu</SelectItem>
                  <SelectItem value="propo_refusee">
                    Proposition refusée
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="origine_lead">Origine du lead</Label>
              <Select name="origine_lead" defaultValue="">
                <SelectTrigger id="origine_lead">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="recommandation">
                    Recommandation
                  </SelectItem>
                  <SelectItem value="appel_offres">
                    Appel d’offres
                  </SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Services actifs */}
          <Field>
            <FieldLabel>Services actifs</FieldLabel>
            <Combobox
              items={SERVICE_ITEMS}
              multiple
              value={selectedServices}
              onValueChange={(value: ServiceItem[]) =>
                setSelectedServices(value)
              }
            >
              <ComboboxChips>
                <ComboboxValue>
                  {(value: ServiceItem[]) => (
                    <>
                      {value?.map((item) => (
                        <ComboboxChip
                          aria-label={item.label}
                          key={item.value}
                        >
                          {item.label}
                        </ComboboxChip>
                      ))}
                      <ComboboxInput
                        aria-label="Sélectionner des services"
                        placeholder={
                          value.length > 0
                            ? undefined
                            : "Sélectionner des services…"
                        }
                      />
                    </>
                  )}
                </ComboboxValue>
              </ComboboxChips>
              <ComboboxPopup>
                <ComboboxEmpty>Aucun service trouvé.</ComboboxEmpty>
                <ComboboxList>
                  {(item: ServiceItem) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxPopup>
            </Combobox>
            <FieldDescription>
              Choisis les services que l’agence opère (ou opérera) pour ce
              client.
            </FieldDescription>
          </Field>

          {/* Notes internes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes_internes">Notes internes</Label>
            <Textarea
              id="notes_internes"
              name="notes_internes"
              placeholder="Contexte, attentes, points d’attention..."
              rows={4}
            />
          </div>

          <SheetFooter className="mt-2 flex justify-end gap-2 p-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}