// components/propositions-commerciale/proposition-form-dialog.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ChevronDown, Check } from "lucide-react";

type StatutProposition =
  | "a_faire"
  | "envoyee"
  | "en_attente_retour"
  | "acceptee"
  | "refusee";

type ClientOption = {
  id: string;
  nom_affichage: string | null;
};

type DbClientRow = {
  id: string;
  nom_affichage: string | null;
};

type PropositionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onCreated?: () => void;
};

// helper pour les initiales
function getInitials(name: string | null | undefined) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0];
  const second = parts[1]?.[0];
  return `${first ?? ""}${second ?? ""}`.toUpperCase() || "??";
}

export function PropositionFormDialog({
  open,
  onOpenChange,
  children,
  onCreated,
}: PropositionFormDialogProps) {
  const supabase = createClient();
  const router = useRouter();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // état du combobox client
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // charger la liste des clients quand le dialog s’ouvre
  useEffect(() => {
    if (!open) return;

    const fetchClients = async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom_affichage")
        .order("nom_affichage", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des clients", {
          description: error.message,
        });
      } else if (data) {
        const typed = data as DbClientRow[];
        setClients(
          typed.map((c) => ({
            id: c.id,
            nom_affichage: c.nom_affichage,
          })),
        );
      }

      setLoadingClients(false);
    };

    // reset sélection à chaque ouverture (optionnel, mais plus clair)
    setSelectedClientId(null);
    fetchClients();
  }, [open, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const client_id = (formData.get("client_id") as string) || null;
    const titre = ((formData.get("titre") as string) || "").trim();
    const montantRaw = ((formData.get("montant_ht") as string) || "").trim();
    const montant_ht =
      montantRaw === "" ? null : Number(montantRaw.replace(",", "."));

    const devise =
      ((formData.get("devise") as string) || "").trim() || "EUR";

    const date_prevue_envoi =
      ((formData.get("date_prevue_envoi") as string) || "").trim() || null;

    const notes_internes =
      ((formData.get("notes_internes") as string) || "").trim() || null;

    const url_envoi =
      ((formData.get("url_envoi") as string) || "").trim() || null;

    const statut =
      ((formData.get("statut") as StatutProposition) || "a_faire") as StatutProposition;

    if (!client_id) {
      toast.error("Client requis", {
        description: "Tu dois sélectionner un client ou un prospect.",
      });
      return;
    }

    if (!titre) {
      toast.error("Titre requis", {
        description: "La proposition doit avoir un titre.",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from("propositions").insert({
        client_id,
        titre,
        montant_ht,
        devise,
        date_prevue_envoi,
        notes_internes,
        statut,
        url_envoi,
        // etat est géré par la colonne par défaut + trigger
      });

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la création de la proposition", {
          description: error.message,
        });
        return;
      }

      toast.success("Proposition créée", {
        description: titre,
      });

      onCreated?.();

      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* bouton trigger (fourni par le parent) */}
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une proposition</DialogTitle>
          <DialogDescription>
            Crée une nouvelle proposition pour un client ou un prospect.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client */}
          <div className="grid gap-1.5">
            <Label htmlFor="client_id">Client *</Label>

            {/* champ caché pour le submit */}
            <input type="hidden" name="client_id" value={selectedClientId ?? ""} />

            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={loadingClients}
                >
                  {selectedClientId
                    ? clients.find((c) => c.id === selectedClientId)?.nom_affichage ??
                      "Sans nom"
                    : loadingClients
                    ? "Chargement..."
                    : "Sélectionner un client"}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[320px] p-0">
                <Command>
                  <CommandInput className="px-3" placeholder="Rechercher un client..." />
                  <CommandList>
                    <CommandEmpty>Aucun client trouvé.</CommandEmpty>

                    <CommandGroup heading="Clients">
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.nom_affichage ?? "Sans nom"}
                          onSelect={() => {
                            setSelectedClientId(c.id);
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Avatar className="mr-2 h-6 w-6">
                            {/* plus tard tu peux ajouter logo_url si tu l’as */}
                            <AvatarImage src={undefined} alt={c.nom_affichage ?? ""} />
                            <AvatarFallback className="text-xs">
                              {getInitials(c.nom_affichage)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{c.nom_affichage || "Sans nom"}</span>
                          {selectedClientId === c.id && (
                            <Check className="ml-auto h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup>
                      <CommandItem
                        value="__add_new_client__"
                        onSelect={() => {
                          setClientPopoverOpen(false);
                          onOpenChange(false);
                          router.push("/dashboard/clients?add=1");
                        }}
                      >
                        <span className="text-sm text-blue-600">
                          + Ajouter un nouveau client
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Titre */}
          <div className="grid gap-1.5">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              name="titre"
              placeholder="Refonte site web Acme – Offre 2025"
              required
            />
          </div>

          {/* Montant + devise */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="montant_ht">Montant HT</Label>
              <Input
                id="montant_ht"
                name="montant_ht"
                type="number"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="devise">Devise</Label>
              <Input id="devise" name="devise" defaultValue="EUR" />
            </div>
          </div>

          {/* Date prévue d’envoi */}
          <div className="grid gap-1.5">
            <Label htmlFor="date_prevue_envoi">Date prévue d’envoi</Label>
            <Input id="date_prevue_envoi" name="date_prevue_envoi" type="date" />
          </div>

          {/* Lien docs envoyés */}
          <div className="grid gap-1.5">
            <Label htmlFor="url_envoi">Lien des documents envoyés</Label>
            <Input
              id="url_envoi"
              name="url_envoi"
              type="url"
              placeholder="https://wetransfer.com/..."
            />
            <p className="text-[11px] text-muted-foreground">
              Ajoute ici le lien WeTransfer / Drive des documents envoyés au client
              (optionnel).
            </p>
          </div>

          {/* Statut initial */}
          <div className="grid gap-1.5">
            <Label htmlFor="statut">Statut initial</Label>
            <select
              id="statut"
              name="statut"
              defaultValue="a_faire"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="a_faire">À faire</option>
              <option value="envoyee">Envoyée</option>
              <option value="en_attente_retour">En attente de retour</option>
              <option value="acceptee">Acceptée</option>
              <option value="refusee">Refusée</option>
            </select>
          </div>

          {/* Notes internes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes_internes">Notes internes</Label>
            <Textarea
              id="notes_internes"
              name="notes_internes"
              placeholder="Contexte, objections, next steps..."
              rows={4}
            />
          </div>

          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}