// components/settings/agency-services-settings.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
};

type ServiceRow = {
  id: string;
  label: string | null;
  description: string | null;
  is_active: boolean;
  category_id: string | null;
};

type DbServiceRow = {
  id: string;
  label: string | null;
  description: string | null;
  is_active: boolean | null;
  category_id: string | null;
};

// 🎨 Palette de couleurs par slug de catégorie
// → alignée avec ce que tu utilises dans PropositionFormDialog
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

export function AgencyServicesSettings() {
  const supabase = createClient();

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dialog de suppression
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceRow | null>(
    null,
  );

  // --------- LOAD CATEGORIES ---------

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, slug, label")
        .order("label", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Erreur lors du chargement des catégories");
        setLoadingCategories(false);
        return;
      }

      const typed = (data ?? []) as ServiceCategory[];
      setCategories(typed);
      setLoadingCategories(false);
    };

    void fetchCategories();
  }, [supabase]);

  // --------- LOAD SERVICES ---------

  const fetchServices = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("services")
      .select("id, label, description, is_active, category_id")
      .order("label", { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des services", {
        description: error.message,
      });
      setLoading(false);
      return;
    }

    const typed = (data ?? []) as DbServiceRow[];

    setServices(
      typed.map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        is_active: row.is_active ?? false,
        category_id: row.category_id,
      })),
    );

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, ServiceCategory>();
    categories.forEach((c) => {
      map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // --------- ACTIONS ---------

  function openCreateDialog() {
    setEditingService(null);
    setDialogOpen(true);
  }

  function openEditDialog(service: ServiceRow) {
    setEditingService(service);
    setDialogOpen(true);
  }

  function openDeleteDialog(service: ServiceRow) {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  }

  async function handleToggleActive(service: ServiceRow) {
    const newActive = !service.is_active;

    // update optimiste
    setServices((prev) =>
      prev.map((s) =>
        s.id === service.id ? { ...s, is_active: newActive } : s,
      ),
    );

    const { error } = await supabase
      .from("services")
      .update({ is_active: newActive })
      .eq("id", service.id);

    if (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du service", {
        description: error.message,
      });
      // rollback
      void fetchServices();
      return;
    }

    toast.success("Service mis à jour", {
      description: `${service.label ?? "Service"} ${
        newActive ? "activé" : "désactivé"
      }`,
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const label = ((formData.get("label") as string) || "").trim();
    const description =
      ((formData.get("description") as string) || "").trim() || null;

    const rawCategory = (formData.get("category_id") as string | null) ?? null;
    const category_id =
      rawCategory && rawCategory.trim().length > 0 ? rawCategory : null;

    const is_active_raw = formData.get("is_active") as string | null;
    const is_active = is_active_raw === "on";

    if (!label) {
      toast.error("Nom requis", {
        description: "Le service doit avoir un nom.",
      });
      return;
    }

    if (!category_id) {
      toast.error("Catégorie requise", {
        description: "Tu dois choisir une catégorie pour ce service.",
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            label,
            description,
            category_id,
            is_active,
          })
          .eq("id", editingService.id);

        if (error) {
          console.error(error);
          toast.error("Erreur lors de la mise à jour du service", {
            description: error.message,
          });
          return;
        }

        toast.success("Service mis à jour", {
          description: label,
        });
      } else {
        const { error } = await supabase.from("services").insert({
          label,
          description,
          category_id,
          is_active,
        });

        if (error) {
          console.error(error);
          toast.error("Erreur lors de la création du service", {
            description: error.message,
          });
          return;
        }

        toast.success("Service créé", {
          description: label,
        });
      }

      setDialogOpen(false);
      await fetchServices();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!serviceToDelete) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceToDelete.id);

      if (error) {
        console.error(error);
        toast.error("Erreur lors de la suppression du service", {
          description: error.message,
        });
        return;
      }

      setServices((prev) => prev.filter((s) => s.id !== serviceToDelete.id));

      toast.success("Service supprimé", {
        description: `« ${
          serviceToDelete.label ?? "Sans nom"
        } » a été supprimé.`,
      });

      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Services de l’agence</h2>
          <p className="text-xs text-muted-foreground">
            Liste des prestations que tu proposes, organisées par catégories.
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          Ajouter un service
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Nom
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Catégorie
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Description
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                Actif
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  Chargement des services...
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  Aucun service pour le moment.
                </td>
              </tr>
            ) : (
              services.map((service) => {
                const category = service.category_id
                  ? categoriesById.get(service.category_id)
                  : null;

                return (
                  <tr key={service.id} className="border-t">
                    <td className="px-3 py-2 align-center">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {service.label ?? "Sans nom"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-center">
                      {category ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${getCategoryBadgeClasses(
                            category.slug,
                          )}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${getCategoryDotClasses(
                              category.slug,
                            )}`}
                          />
                          {category.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Non défini
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-center">
                      <span className="text-xs text-muted-foreground">
                        {service.description || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center align-center">
                      <div className="inline-flex items-center gap-2">
                        <Switch
                          checked={service.is_active}
                          onCheckedChange={() => handleToggleActive(service)}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {service.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(service)}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => openDeleteDialog(service)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Modifier le service" : "Nouveau service"}
            </DialogTitle>
            <DialogDescription>
              Définis le nom, la catégorie (obligatoire) et la description du
              service.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nom */}
            <div className="grid gap-1.5">
              <Label htmlFor="service_label">Nom *</Label>
              <Input
                id="service_label"
                name="label"
                defaultValue={editingService?.label ?? ""}
                placeholder="Ex : Refonte site vitrine"
                required
              />
            </div>

            {/* Catégorie (obligatoire) */}
            <div className="grid gap-1.5">
              <Label htmlFor="service_category">Catégorie *</Label>
              <Select
                name="category_id"
                defaultValue={editingService?.category_id ?? undefined}
              >
                <SelectTrigger id="service_category">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${getCategoryBadgeClasses(
                          cat.slug,
                        )}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${getCategoryDotClasses(
                            cat.slug,
                          )}`}
                        />
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingCategories && (
                <p className="text-[11px] text-muted-foreground">
                  Chargement des catégories…
                </p>
              )}
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="service_description">Description</Label>
              <Textarea
                id="service_description"
                name="description"
                defaultValue={editingService?.description ?? ""}
                placeholder="Ex : Stratégie, conception et développement d'un site vitrine optimisé."
                rows={3}
              />
            </div>

            {/* Actif */}
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <div className="flex flex-col">
                <span className="text-xs font-medium">Service actif</span>
                <span className="text-[11px] text-muted-foreground">
                  Les services inactifs ne seront pas proposés dans les
                  sélecteurs (propositions, contrats, etc.).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="service_is_active"
                  name="is_active"
                  defaultChecked={editingService?.is_active ?? true}
                />
              </div>
            </div>

            <DialogFooter className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? editingService
                    ? "Enregistrement..."
                    : "Création..."
                  : editingService
                  ? "Enregistrer"
                  : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer ce service ?</DialogTitle>
            <DialogDescription>
              Cette action est définitive. Le service sera retiré de la liste et
              ne pourra plus être utilisé dans les nouvelles propositions ou
              contrats.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-destructive/5 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            Tu es sur le point de supprimer&nbsp;:
            <br />
            <span className="font-semibold">
              {serviceToDelete?.label ?? "Service sans nom"}
            </span>
          </div>

          <DialogFooter className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={submitting}
            >
              {submitting ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}