"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { createClient } from "@/lib/supabase/client";
import type { ClientRow } from "@/app/dashboard/clients/[slug]/client-types";

const supabase = createClient();

type ClientDetailsFormProps = {
  client: ClientRow;
};

export function ClientDetailsForm({ client }: ClientDetailsFormProps) {
  const [formData, setFormData] = useState<ClientRow>(client);
  const [isSaving, setIsSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleChange =
    (field: keyof ClientRow) =>
    (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
      const value = e.target.value;
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (field === "logo_url") {
        // On reset l’erreur pour retenter le chargement quand l’URL change
        setLogoError(false);
      }
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from("clients")
        .update({
          nom_legal: formData.nom_legal,
          nom_affichage: formData.nom_affichage,
          statut_client: formData.statut_client,
          type_client: formData.type_client,
          secteur_activite: formData.secteur_activite,
          site_web_principal: formData.site_web_principal,
          email_general: formData.email_general,
          telephone_general: formData.telephone_general,
          contact_principal_nom: formData.contact_principal_nom,
          contact_principal_prenom: formData.contact_principal_prenom,
          contact_principal_role: formData.contact_principal_role,
          contact_principal_email: formData.contact_principal_email,
          contact_principal_telephone: formData.contact_principal_telephone,
          notes_internes: formData.notes_internes,
          logo_url: formData.logo_url,
          slug: formData.slug,
        })
        .eq("id", client.id)
        .select()
        .single();

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la mise à jour du client");
        return;
      }

      setFormData(data as ClientRow);
      toast.success("Client mis à jour");
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de la mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  const hasLogo =
    !!formData.logo_url && formData.logo_url.trim().length > 0 && !logoError;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border p-4 md:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Informations client</h2>
          <p className="text-sm text-muted-foreground">
            Modifie les infos principales puis enregistre.
          </p>
        </div>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      {/* ID + slug */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="ID (lecture seule)">
          <Input value={formData.id} disabled />
        </Field>

        <Field label="Slug">
          <Input
            value={formData.slug ?? ""}
            onChange={handleChange("slug")}
            placeholder="slug-client"
          />
        </Field>
      </div>

      {/* Nom légal / affichage */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom légal">
          <Input
            value={formData.nom_legal}
            onChange={handleChange("nom_legal")}
            required
          />
        </Field>

        <Field label="Nom d’affichage">
          <Input
            value={formData.nom_affichage}
            onChange={handleChange("nom_affichage")}
            required
          />
        </Field>
      </div>

      {/* Statut / type / secteur */}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Statut client">
          <Select
            value={formData.statut_client}
            // on ne passe pas par handleChange ici, c’est plus simple en direct
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                statut_client: value,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionne un statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="ancien">Ancien</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Type de client">
          <Input
            value={formData.type_client ?? ""}
            onChange={handleChange("type_client")}
            placeholder="Agence, marque, freelance…"
          />
        </Field>

        <Field label="Secteur d’activité">
          <Input
            value={formData.secteur_activite ?? ""}
            onChange={handleChange("secteur_activite")}
            placeholder="Tech, Retail, Industrie…"
          />
        </Field>
      </div>

      {/* Web / contact générique */}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Site web principal">
          <Input
            value={formData.site_web_principal ?? ""}
            onChange={handleChange("site_web_principal")}
            placeholder="https://…"
          />
        </Field>

        <Field label="Email général">
          <Input
            type="email"
            value={formData.email_general ?? ""}
            onChange={handleChange("email_general")}
          />
        </Field>

        <Field label="Téléphone général">
          <Input
            value={formData.telephone_general ?? ""}
            onChange={handleChange("telephone_general")}
          />
        </Field>
      </div>

      {/* Contact principal */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Contact principal</h3>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Prénom">
            <Input
              value={formData.contact_principal_prenom ?? ""}
              onChange={handleChange("contact_principal_prenom")}
            />
          </Field>

          <Field label="Nom">
            <Input
              value={formData.contact_principal_nom ?? ""}
              onChange={handleChange("contact_principal_nom")}
            />
          </Field>

          <Field label="Rôle / fonction">
            <Input
              value={formData.contact_principal_role ?? ""}
              onChange={handleChange("contact_principal_role")}
              placeholder="CEO, Responsable marketing…"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Email contact principal">
            <Input
              type="email"
              value={formData.contact_principal_email ?? ""}
              onChange={handleChange("contact_principal_email")}
            />
          </Field>

          <Field label="Téléphone contact principal">
            <Input
              value={formData.contact_principal_telephone ?? ""}
              onChange={handleChange("contact_principal_telephone")}
            />
          </Field>
        </div>
      </div>

      {/* Logo + notes internes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Logo (URL)">
          <div className="space-y-2">
            <Input
              value={formData.logo_url ?? ""}
              onChange={handleChange("logo_url")}
              placeholder="https://…"
            />

            {formData.logo_url && logoError && (
              <p className="text-xs text-destructive">
                Impossible de charger l’image depuis cette URL.
              </p>
            )}

            {hasLogo && (
              <div className="mt-2 flex items-center justify-center rounded-md border bg-muted/40 p-2">
                <div className="relative h-20 w-32 overflow-hidden rounded-md">
                  <Image
                    src={formData.logo_url ?? ""}
                    alt={`Logo de ${
                      formData.nom_affichage || formData.nom_legal
                    }`}
                    fill
                    className="h-full w-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                </div>
              </div>
            )}
          </div>
        </Field>

        <Field label="Notes internes">
          <Textarea
            value={formData.notes_internes ?? ""}
            onChange={handleChange("notes_internes")}
            rows={4}
            placeholder="Notes visibles en interne uniquement…"
          />
        </Field>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*                         PETIT WRAPPER DE CHAMPS UI                         */
/* -------------------------------------------------------------------------- */

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
