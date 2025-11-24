// components/clients/client-form-dialog.tsx
"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatutClient = "client" | "prospect";

type ClientForForm = {
  id: string;
  statut_client: StatutClient;
  nom_affichage: string;
  nom_legal: string | null;
  logo_url: string | null;
  email_general: string | null;
  site_web_principal: string | null;
  contact_principal_nom: string | null;
  contact_principal_prenom: string | null;
  contact_principal_email: string | null;
  notes_internes: string | null;
};

type ClientFormDialogProps = {
  /** Dialog contrôlé */
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Contenu qui ouvre le dialog (bouton, item de menu, etc.) */
  children?: React.ReactNode;

  /** Si présent : édition, sinon création */
  client?: ClientForForm | null;

  /** Statut par défaut en création (client/prospect) */
  defaultStatut?: StatutClient;

  /** Callback après succès (pour refetch la table par ex.) */
  onSaved?: () => void;
};

export function ClientFormDialog({
  open,
  onOpenChange,
  children,
  client,
  defaultStatut = "client",
  onSaved,
}: ClientFormDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = React.useState(false);

  const isEdit = Boolean(client);

  const [statut, setStatut] = React.useState<StatutClient>(
    client?.statut_client ?? defaultStatut,
  );

  React.useEffect(() => {
    setStatut(client?.statut_client ?? defaultStatut);
  }, [client, defaultStatut]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const nom_affichage = (formData.get("nom_affichage") as string)?.trim();
    const nom_legal =
      ((formData.get("nom_legal") as string) || "").trim() || null;
    const logo_url =
      ((formData.get("logo_url") as string) || "").trim() || null;
    const email_general =
      ((formData.get("email_general") as string) || "").trim() || null;
    const site_web_principal =
      ((formData.get("site_web_principal") as string) || "").trim() || null;

    const contact_principal_prenom =
      ((formData.get("contact_principal_prenom") as string) || "").trim() ||
      null;
    const contact_principal_nom =
      ((formData.get("contact_principal_nom") as string) || "").trim() || null;
    const contact_principal_email =
      ((formData.get("contact_principal_email") as string) || "").trim() ||
      null;

    const notes_internes =
      ((formData.get("notes_internes") as string) || "").trim() || null;

    if (!nom_affichage) {
      toast.error("Nom d’affichage requis", {
        description: "Le nom d’affichage ne peut pas être vide.",
      });
      return;
    }

    const payload = {
      statut_client: statut,
      nom_affichage,
      nom_legal,
      logo_url,
      email_general,
      site_web_principal,
      contact_principal_prenom,
      contact_principal_nom,
      contact_principal_email,
      notes_internes,
    };

    try {
      setLoading(true);

      let error;
      if (isEdit && client) {
        const { error: updateError } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", client.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("clients")
          .insert([payload]);
        error = insertError;
      }

      if (error) {
        console.error(error);
        toast.error(
          isEdit
            ? "Erreur lors de la mise à jour du client"
            : "Erreur lors de la création du client",
          {
            description: error.message,
          },
        );
        return;
      }

      toast.success(isEdit ? "Client mis à jour" : "Client créé", {
        description: nom_affichage,
      });

      onSaved?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  const title = isEdit ? "Modifier le client" : "Ajouter un client";
  const description = isEdit
    ? "Mets à jour les informations de l’entreprise et du contact principal."
    : "Renseigne les informations du client. Tu pourras compléter plus tard.";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identité */}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nom_affichage">Nom d’affichage *</Label>
              <Input
                id="nom_affichage"
                name="nom_affichage"
                defaultValue={client?.nom_affichage ?? ""}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nom_legal">Nom légal</Label>
              <Input
                id="nom_legal"
                name="nom_legal"
                defaultValue={client?.nom_legal ?? ""}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="logo_url">Logo (URL)</Label>
              <Input
                id="logo_url"
                name="logo_url"
                defaultValue={client?.logo_url ?? ""}
                placeholder="https://..."
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
                defaultValue={client?.site_web_principal ?? ""}
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email_general">Email général</Label>
              <Input
                id="email_general"
                name="email_general"
                type="email"
                defaultValue={client?.email_general ?? ""}
                placeholder="contact@exemple.com"
              />
            </div>
          </div>

          {/* Contact principal */}
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="contact_principal_prenom">Prénom</Label>
                <Input
                  id="contact_principal_prenom"
                  name="contact_principal_prenom"
                  defaultValue={client?.contact_principal_prenom ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contact_principal_nom">Nom</Label>
                <Input
                  id="contact_principal_nom"
                  name="contact_principal_nom"
                  defaultValue={client?.contact_principal_nom ?? ""}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contact_principal_email">
                Email du contact
              </Label>
              <Input
                id="contact_principal_email"
                name="contact_principal_email"
                type="email"
                defaultValue={client?.contact_principal_email ?? ""}
              />
            </div>
          </div>

          {/* Statut + notes */}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="statut_client">Statut</Label>
              <Select
                value={statut}
                onValueChange={(value) => setStatut(value as StatutClient)}
                name="statut_client"
              >
                <SelectTrigger id="statut_client" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes_internes">Notes internes</Label>
              <Textarea
                id="notes_internes"
                name="notes_internes"
                defaultValue={client?.notes_internes ?? ""}
                placeholder="Contexte, attentes, points d’attention..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEdit
                  ? "Enregistrement..."
                  : "Création..."
                : isEdit
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}