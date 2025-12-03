"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

import { ScrollArea } from "@/components/ui/scroll-area";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type StatutProposition =
  | "a_faire"
  | "envoyee"
  | "en_attente_retour"
  | "acceptee"
  | "refusee";

type BillingModel = "one_shot" | "recurring" | "mixed";

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

type ServiceOption = {
  id: string;
  label: string;
  category_id: string | null;
  default_unit_price: number | null;
};

type DbServiceRow = {
  id: string;
  label: string;
  category_id: string | null;
  default_unit_price: number | string | null;
  is_active: boolean;
};

type PropositionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onCreated?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                               HELPERS UI                                   */
/* -------------------------------------------------------------------------- */

function getInitials(name: string | null | undefined) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0];
  const second = parts[1]?.[0];
  return `${first ?? ""}${second ?? ""}`.toUpperCase() || "??";
}

const CATEGORY_COLORS: Record<string, { badge: string; dot: string }> = {
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
  return (
    CATEGORY_COLORS[slug]?.badge ??
    "bg-slate-100 text-slate-700 border-slate-200"
  );
}

function getCategoryDotClasses(slug?: string | null) {
  if (!slug) {
    return "bg-slate-500";
  }
  return CATEGORY_COLORS[slug]?.dot ?? "bg-slate-500";
}

const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  one_shot: "One shot",
  recurring: "Récurrent",
  mixed: "Mixte (one shot + récurrent)",
};

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

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

  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // client
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // catégorie
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(undefined);

  // statut
  const [statutValue, setStatutValue] = useState<StatutProposition>("a_faire");

  // modèle de facturation
  const [billingModel, setBillingModel] = useState<BillingModel>("one_shot");
  const [montantOneShot, setMontantOneShot] = useState<string>("");
  const [montantMensuel, setMontantMensuel] = useState<string>("");

  // services multi-select
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  /* ----------------------------- LOAD DATA ON OPEN ----------------------------- */

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoadingClients(true);
      setLoadingCategories(true);
      setLoadingServices(true);

      const [clientsRes, categoriesRes, servicesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, nom_affichage")
          .order("nom_affichage", { ascending: true }),
        supabase
          .from("service_categories")
          .select("id, slug, label")
          .order("label", { ascending: true }),
        supabase
          .from("services")
          .select("id, label, category_id, default_unit_price, is_active")
          .eq("is_active", true)
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
          }))
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
          }))
        );
      }

      // services
      if (servicesRes.error) {
        console.error(servicesRes.error);
        toast.error("Erreur lors du chargement des services", {
          description: servicesRes.error.message,
        });
      } else if (servicesRes.data) {
        const typed = servicesRes.data as DbServiceRow[];
        setServices(
          typed.map((s) => ({
            id: s.id,
            label: s.label,
            category_id: s.category_id,
            default_unit_price:
              s.default_unit_price == null
                ? null
                : typeof s.default_unit_price === "number"
                ? s.default_unit_price
                : Number(s.default_unit_price),
          }))
        );
      }

      setLoadingClients(false);
      setLoadingCategories(false);
      setLoadingServices(false);
    };

    // reset global state à chaque ouverture
    setSelectedClientId(null);
    setSelectedCategoryId(undefined);
    setSelectedServiceIds([]);
    setStatutValue("a_faire");
    setBillingModel("one_shot");
    setMontantOneShot("");
    setMontantMensuel("");

    void fetchData();
  }, [open, supabase]);

  const selectedCategory = useMemo(
    () =>
      selectedCategoryId
        ? categories.find((c) => c.id === selectedCategoryId) ?? null
        : null,
    [selectedCategoryId, categories]
  );

  /* ---------------------- billing models autorisés / défaut -------------------- */

  const allowedBillingModels: BillingModel[] = useMemo(() => {
    if (!selectedCategory) return ["one_shot", "recurring", "mixed"];

    const slug = selectedCategory.slug;

    if (slug === "social-media-management" || slug === "strategie-digitale") {
      return ["recurring", "mixed"];
    }

    if (slug === "direction-artistique" || slug === "conception-web") {
      return ["one_shot", "mixed"];
    }

    return ["one_shot", "recurring", "mixed"];
  }, [selectedCategory]);

  // met à jour le modèle par défaut quand la catégorie change
  useEffect(() => {
    if (!selectedCategory) return;

    const slug = selectedCategory.slug;

    if (slug === "social-media-management" || slug === "strategie-digitale") {
      setBillingModel("recurring");
      return;
    }

    if (slug === "direction-artistique" || slug === "conception-web") {
      setBillingModel("one_shot");
      return;
    }
  }, [selectedCategory]);

  /* ------------------------ Services filtrés par catégorie ------------------------ */

  const availableServices = useMemo(() => {
    if (!selectedCategoryId) return [] as ServiceOption[];
    return services.filter((s) => s.category_id === selectedCategoryId);
  }, [services, selectedCategoryId]);

  const selectedServicesLabels = useMemo(() => {
    if (!selectedServiceIds.length) return "";
    const labels = availableServices
      .filter((s) => selectedServiceIds.includes(s.id))
      .map((s) => s.label);
    if (!labels.length) return "";
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} + ${labels.length - 2} autres`;
  }, [availableServices, selectedServiceIds]);

  /* --------------------------------- SUBMIT --------------------------------- */

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const client_id = (formData.get("client_id") as string) || null;
    const titre = ((formData.get("titre") as string) || "").trim();

    const date_prevue_facturation_recurrente =
      (
        (formData.get("date_prevue_facturation_recurrente") as string) || ""
      ).trim() || null;
    const devise = ((formData.get("devise") as string) || "").trim() || "EUR";

    const date_prevue_envoi =
      ((formData.get("date_prevue_envoi") as string) || "").trim() || null;

    const notes_internes =
      ((formData.get("notes_internes") as string) || "").trim() || null;

    const url_envoi =
      ((formData.get("url_envoi") as string) || "").trim() || null;

    const service_category_id = selectedCategoryId ?? null;
    const statut = statutValue;

    const montant_ht_one_shot = parseNumber(montantOneShot);
    const montant_ht_mensuel = parseNumber(montantMensuel);

    const montant_ht: number | null = (() => {
      if (billingModel === "one_shot") return montant_ht_one_shot;
      if (billingModel === "recurring") return montant_ht_mensuel;
      if (billingModel === "mixed") {
        const one = montant_ht_one_shot ?? 0;
        const mens = montant_ht_mensuel ?? 0;
        if (!one && !mens) return null;
        return one + mens;
      }
      return null;
    })();

    // validations
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

    if (billingModel === "one_shot" && montant_ht_one_shot == null) {
      toast.error("Montant requis", {
        description: "Pour un modèle one shot, renseigne le montant HT.",
      });
      return;
    }

    if (billingModel === "recurring" && montant_ht_mensuel == null) {
      toast.error("Montant mensuel requis", {
        description:
          "Pour un modèle récurrent, renseigne le montant HT mensuel.",
      });
      return;
    }

    if (
      billingModel === "mixed" &&
      montant_ht_one_shot == null &&
      montant_ht_mensuel == null
    ) {
      toast.error("Montants requis", {
        description:
          "Pour un modèle mixte, renseigne au moins un montant (one shot ou mensuel).",
      });
      return;
    }

    try {
      setSubmitting(true);

      // 1) création de la proposition (avec modèle de facturation + montants)
      const { data, error } = await supabase
        .from("propositions")
        .insert({
          client_id,
          titre,
          devise,
          date_prevue_envoi,
          notes_internes,
          statut,
          url_envoi,
          service_category_id,
          billing_model: billingModel,
          montant_ht,
          montant_ht_one_shot,
          montant_ht_mensuel,
          date_prevue_facturation_recurrente,
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la création de la proposition", {
          description: error.message,
        });
        return;
      }

      const inserted = data as { id: string };

      // 2) si des services sont sélectionnés, on les rattache
      if (selectedServiceIds.length > 0) {
        const rows = selectedServiceIds.map((serviceId) => ({
          proposition_id: inserted.id,
          service_id: serviceId,
        }));

        const { error: linkError } = await supabase
          .from("proposition_services")
          .insert(rows);

        if (linkError) {
          console.error(linkError);
          toast.error(
            "Proposition créée, mais erreur lors de l'association des services",
            {
              description: linkError.message,
            }
          );
        }
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

  /* --------------------------------- RENDER --------------------------------- */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une proposition</DialogTitle>
          <DialogDescription>
            Crée une nouvelle proposition pour un client ou un prospect.
          </DialogDescription>
        </DialogHeader>

        {/* Wrapper avec hauteur max + layout colonne */}
        <div className="mt-2 flex max-h-[70vh] flex-col">
          {/* Zone scrollable */}
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <form
              id="proposition-form"
              onSubmit={handleSubmit}
              className="space-y-4 pb-4"
            >
              {/* Client */}
              <div className="grid gap-1.5">
                <Label htmlFor="client_id">Prospect *</Label>

                <input
                  type="hidden"
                  name="client_id"
                  value={selectedClientId ?? ""}
                />

                <Popover
                  open={clientPopoverOpen}
                  onOpenChange={setClientPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={loadingClients}
                    >
                      {selectedClientId
                        ? clients.find((c) => c.id === selectedClientId)
                            ?.nom_affichage ?? "Sans nom"
                        : loadingClients
                        ? "Chargement..."
                        : "Sélectionner un prospect"}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput
                        className="px-3"
                        placeholder="Rechercher un prospect..."
                      />
                      <CommandList>
                        <CommandEmpty>Aucun prospect trouvé.</CommandEmpty>

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
                                <AvatarImage
                                  src={undefined}
                                  alt={c.nom_affichage ?? ""}
                                />
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
                              router.push("/dashboard/clients/prospects?add=1");
                            }}
                          >
                            <span className="text-sm text-blue-600">
                              + Ajouter un nouveau prospect
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

              {/* Catégorie */}
              <div className="grid gap-1.5">
                <Label htmlFor="service_category">Catégorie *</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={(value) => {
                    setSelectedCategoryId(value);
                    setSelectedServiceIds([]); // reset services quand on change de catégorie
                  }}
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
                            selectedCategory.slug
                          )}`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${getCategoryDotClasses(
                              selectedCategory.slug
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
                            cat.slug
                          )}`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${getCategoryDotClasses(
                              cat.slug
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

              {/* Services associés (multi-select) */}
              <div className="grid gap-1.5">
                <Label>Services associés</Label>

                <Popover
                  open={servicePopoverOpen}
                  onOpenChange={setServicePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                      disabled={!selectedCategoryId || loadingServices}
                    >
                      {selectedCategoryId
                        ? loadingServices
                          ? "Chargement des services..."
                          : selectedServiceIds.length === 0
                          ? "Sélectionner un ou plusieurs services"
                          : selectedServicesLabels
                        : "Choisis d'abord une catégorie"}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput
                        className="px-3"
                        placeholder="Rechercher un service..."
                      />
                      <CommandList>
                        <CommandEmpty>
                          {selectedCategoryId
                            ? "Aucun service pour cette catégorie."
                            : "Choisis d'abord une catégorie."}
                        </CommandEmpty>
                        <CommandGroup heading="Services">
                          {availableServices.map((s) => {
                            const isSelected = selectedServiceIds.includes(
                              s.id
                            );
                            return (
                              <CommandItem
                                key={s.id}
                                value={s.label}
                                onSelect={() => {
                                  setSelectedServiceIds((prev) =>
                                    isSelected
                                      ? prev.filter((id) => id !== s.id)
                                      : [...prev, s.id]
                                  );
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    isSelected ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <span>{s.label}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <input
                  type="hidden"
                  name="service_ids"
                  value={selectedServiceIds.join(",")}
                />

                {selectedCategoryId &&
                  availableServices.length === 0 &&
                  !loadingServices && (
                    <p className="text-[11px] text-muted-foreground">
                      Aucun service actif rattaché à cette catégorie pour le
                      moment.
                    </p>
                  )}
              </div>

              {/* Modèle de facturation */}
              <div className="grid gap-1.5">
                <Label htmlFor="billing_model">Modèle de facturation</Label>
                <Select
                  value={billingModel}
                  onValueChange={(value) =>
                    setBillingModel(value as BillingModel)
                  }
                >
                  <SelectTrigger id="billing_model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedBillingModels.map((bm) => (
                      <SelectItem key={bm} value={bm}>
                        {BILLING_MODEL_LABEL[bm]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Montants selon le modèle */}
              {billingModel === "one_shot" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="montant_one_shot">
                      Montant HT (one shot)
                    </Label>
                    <Input
                      id="montant_one_shot"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={montantOneShot}
                      onChange={(e) => setMontantOneShot(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="devise">Devise</Label>
                    <Input id="devise" name="devise" defaultValue="EUR" />
                  </div>
                </div>
              )}

              {billingModel === "recurring" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="montant_mensuel">Montant HT mensuel</Label>
                    <Input
                      id="montant_mensuel"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={montantMensuel}
                      onChange={(e) => setMontantMensuel(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="devise">Devise</Label>
                    <Input id="devise" name="devise" defaultValue="EUR" />
                  </div>
                </div>
              )}

              {billingModel === "mixed" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="montant_one_shot">
                        Montant HT one shot
                      </Label>
                      <Input
                        id="montant_one_shot"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={montantOneShot}
                        onChange={(e) => setMontantOneShot(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="montant_mensuel">
                        Montant HT mensuel
                      </Label>
                      <Input
                        id="montant_mensuel"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={montantMensuel}
                        onChange={(e) => setMontantMensuel(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="devise">Devise</Label>
                    <Input id="devise" name="devise" defaultValue="EUR" />
                  </div>
                </div>
              )}

              {billingModel === "mixed" && (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="date_prevue_facturation_recurrente">
                      Début prévu facturation récurrente
                    </Label>
                    <Input
                      id="date_prevue_facturation_recurrente"
                      name="date_prevue_facturation_recurrente"
                      type="date"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Optionnel. Le récurrent ne sera considéré comme “lancé”
                      qu&apos;à partir de cette date.
                    </p>
                  </div>
                </div>
              )}

              {/* Date prévue d’envoi */}
              <div className="grid gap-1.5">
                <Label htmlFor="date_prevue_envoi">Date prévue d’envoi</Label>
                <Input
                  id="date_prevue_envoi"
                  name="date_prevue_envoi"
                  type="date"
                />
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
                  Ajoute ici le lien WeTransfer / Drive des documents envoyés au
                  client (optionnel).
                </p>
              </div>

              {/* Statut initial */}
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
                    <SelectItem value="en_attente_retour">
                      En attente retour
                    </SelectItem>
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
            </form>
          </ScrollArea>

          {/* Footer FIXE */}
          <DialogFooter className="mt-2 flex shrink-0 justify-end gap-2 bg-background pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" form="proposition-form" disabled={submitting}>
              {submitting ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
