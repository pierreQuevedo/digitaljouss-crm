"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import {
  ContratsTable,
  type ContratRow,
  ContratRowActions,
} from "@/components/contrats-propos/contrats-table";

const supabase = createClient();

type ServiceCategoryRow = {
  id: string;
  slug: string;
  label: string | null;
};

type ContratsByCategoryPageProps = {
  categorySlug: string;
  title: string;
};

export function ContratsByCategoryPage({
  categorySlug,
  title,
}: ContratsByCategoryPageProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loadingCategory, setLoadingCategory] = useState(true);

  useEffect(() => {
    const fetchCategoryId = async () => {
      setLoadingCategory(true);

      const { data, error } = await supabase
        .from("service_categories") // adapte si le nom est différent
        .select("id, slug, label")
        .eq("slug", categorySlug)
        .maybeSingle<ServiceCategoryRow>();

      setLoadingCategory(false);

      if (error) {
        console.error(error);
        toast.error(
          `Impossible de charger la catégorie "${categorySlug}"`,
          {
            description: error.message,
          }
        );
        return;
      }

      if (!data) {
        toast.error(
          `Catégorie "${categorySlug}" introuvable dans la base de données.`
        );
        return;
      }

      setCategoryId(data.id);
    };

    void fetchCategoryId();
  }, [categorySlug]);

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>

      {loadingCategory && (
        <p className="text-xs text-muted-foreground">
          Chargement de la catégorie…
        </p>
      )}

      {!loadingCategory && !categoryId && (
        <p className="text-xs text-red-600">
          Impossible de filtrer : identifiant de catégorie introuvable.
        </p>
      )}

      {categoryId && (
        <ContratsTable
          serviceCategoryIdIn={categoryId}
          showCategoryFilter={false}
          statutIn={[
            "brouillon",
            "en_attente_signature",
            "signe",
            "en_cours",
            "termine",
            "annule",
          ]}
          renderRowActions={(contrat: ContratRow) => (
            <ContratRowActions contrat={contrat} />
          )}
        />
      )}
    </div>
  );
}