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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type ServiceCategoryOption = {
  id: string;
  slug: string;
  label: string;
};

type DbServiceCategoryRow = {
  id: string;
  slug: string;
  label: string;
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

// mapping couleurs (même logique que pour les services)
const CATEGORY_COLORS: Record<
  string,
  { badge: string; dot: string }
> = {
  "strategie-digitale": {
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    dot: "bg-sky-500",
  },
  "direction-artistique": {
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
  "conception-web": {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  "social-media-management": {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
};

function getCategoryBadgeClasses(slug?: string | null) {
  if (!slug) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  return CATEGORY_COLORS[slug]?.badge ?? "bg-slate-100 text-slate-700 border-slate-200";
}

function getCategoryDotClasses(slug?: string | null) {
  if (!slug) {
    return "bg-slate-500";
  }
  return CATEGORY_COLORS[slug]?.dot ?? "bg-slate-500";
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

  const [categories, setCategories] = useState<ServiceCategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // état du combobox client
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // état de la catégorie
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);

  // état du statut (pour le Select shadcn)
  const [statutValue, setStatutValue] = useState<StatutProposition>("a_faire");

  // charger la liste des clients + catégories quand le dialog s’ouvre
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoadingClients(true);
      setLoadingCategories(true);

      const [clientsRes, categoriesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, nom_affichage")
          .order("nom_affichage", { ascending: true }),
        supabase
          .from("service_categories")
          .select("id, slug, label")
          .order("label", { ascending: true }),
      ]);

      // clients
      if (clientsRes.error) {
        console.error(clientsRes.error);
        toast.error("Erreur lors du chargement des clients", {
          description: clientsRes.error.message,
        });
      } else if (clientsRes.data) {
        const typed = clientsRes.data as DbClientRow[];
        setClients(
          typed.map((c) => ({
            id: c.id,
            nom_affichage: c.nom_affichage,
          })),
        );
      }

      // catégories
      if (categoriesRes.error) {
        console.error(categoriesRes.error);
        toast.error("Erreur lors du chargement des catégories", {
          description: categoriesRes.error.message,
        });
      } else if (categoriesRes.data) {
        const typed = categoriesRes.data as DbServiceCategoryRow[];
        setCategories(
          typed.map((c) => ({
            id: c.id,
            slug: c.slug,
            label: c.label,
          })),
        );
      }

      setLoadingClients(false);
      setLoadingCategories(false);
    };

    // reset à chaque ouverture
    setSelectedClientId(null);
    setSelectedCategoryId(undefined);
    setStatutValue("a_faire");
    fetchData();
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

    const service_category_id = selectedCategoryId ?? null;
    const statut = statutValue; // 👈 vient du Select shadcn

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

    if (!service_category_id) {
      toast.error("Catégorie requise", {
        description: "Choisis une catégorie pour cette proposition.",
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
        service_category_id, // 👈 nouvelle colonne liée à service_categories
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

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null;

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

          {/* Catégorie de service (obligatoire) */}
          <div className="grid gap-1.5">
            <Label htmlFor="service_category">Catégorie *</Label>
            <Select
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
            >
              <SelectTrigger id="service_category">
                <SelectValue
                  placeholder={
                    loadingCategories
                      ? "Chargement des catégories..."
                      : "Choisir une catégorie"
                  }
                >
                  {selectedCategory ? (
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs ${getCategoryBadgeClasses(
                        selectedCategory.slug,
                      )}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${getCategoryDotClasses(
                          selectedCategory.slug,
                        )}`}
                      />
                      <span>{selectedCategory.label}</span>
                    </div>
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px] ${getCategoryBadgeClasses(
                        cat.slug,
                      )}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${getCategoryDotClasses(
                          cat.slug,
                        )}`}
                      />
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="service_category_id"
              value={selectedCategoryId ?? ""}
            />
            {loadingCategories && (
              <p className="text-[11px] text-muted-foreground">
                Chargement des catégories…
              </p>
            )}
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

          {/* Statut initial (Select shadcn) */}
          <div className="grid gap-1.5">
            <Label htmlFor="statut">Statut initial</Label>
            <Select
              value={statutValue}
              onValueChange={(value) =>
                setStatutValue(value as StatutProposition)
              }
            >
              <SelectTrigger id="statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_faire">À faire</SelectItem>
                <SelectItem value="envoyee">Envoyée</SelectItem>
                <SelectItem value="acceptee">Acceptée</SelectItem>
                <SelectItem value="refusee">Refusée</SelectItem>
              </SelectContent>
            </Select>
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