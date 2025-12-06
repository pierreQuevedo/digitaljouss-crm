"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
// import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { EllipsisVerticalIcon } from "lucide-react";
import { toast } from "sonner";

import {
  // canStartRecurringBilling,
  type BillingModel,
  type StatutContrat,
} from "@/lib/contrats-domain";
import { Eye, Download, Trash2, Pencil, FileText, Plus } from "lucide-react";
import { ContratDocumentUploader } from "@/components/contrats-propos/contrat-document-uploader";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type BillingPeriod = "one_time" | "monthly" | "quarterly" | "yearly";

export type ServiceCategory = {
  id: string;
  slug: string;
  label: string;
};

export type ContratRow = {
  id: string;
  proposition_id: string;
  client_id: string;

  slug: string;
  client_slug: string | null;

  titre: string;
  description: string | null;
  statut: StatutContrat;

  montant_ht: number | null;
  montant_ht_one_shot: number | null;
  montant_ht_mensuel: number | null;
  tva_rate: number | null;
  montant_ttc: number | null;

  billing_model: BillingModel;
  billing_period: BillingPeriod;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;
  reference_externe: string | null;

  created_at: string;
  date_signature: string | null;

  // temporalité facturation
  date_facturation_one_shot: string | null;
  date_debut_facturation_recurrente: string | null;

  client_nom_affichage: string | null;
  client_nom_legal: string | null;

  proposition_titre: string | null;

  // lien docs de la proposition
  proposition_url_envoi: string | null;

  service_category: ServiceCategory | null;
  service_category_slug: string | null;
  service_category_label: string | null;

  proposition_service_ids: string[]; // pour la logique / liens
  proposition_services: { id: string; label: string | null }[]; // pour l'affichage UI

  // docs contrat
  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;

  total_paye_ht: number | null;
  total_paye_ttc: number | null;
  reste_a_payer_ht: number | null;
  reste_a_payer_ttc: number | null;
};

type DbClientFromJoin = {
  slug: string;
  nom_affichage: string | null;
  nom_legal: string | null;
};

type DbServiceCategoryFromJoin = {
  id: string;
  slug: string;
  label: string;
};

type DocType = "devis" | "devis_signe" | "facture";

type ListedFile = {
  name: string;
  path: string;
};

type DbServiceFromJoin = {
  id: string;
  label: string | null;
};

type DbPropositionServiceFromJoin = {
  service_id: string;
  service: DbServiceFromJoin | DbServiceFromJoin[] | null;
};

type DbPropositionFromJoin = {
  titre: string | null;
  url_envoi: string | null;
  service_category:
    | DbServiceCategoryFromJoin
    | DbServiceCategoryFromJoin[]
    | null;
  proposition_services:
    | DbPropositionServiceFromJoin
    | DbPropositionServiceFromJoin[]
    | null;
};

type DbContratRow = {
  id: string;
  slug: string;
  proposition_id: string;
  client_id: string;

  titre: string;
  description: string | null;
  statut: StatutContrat;

  montant_ht: string | number | null;
  montant_ht_one_shot: string | number | null;
  montant_ht_mensuel: string | number | null;
  tva_rate: string | number | null;
  montant_ttc: string | number | null;

  billing_model: BillingModel | null;
  billing_period: BillingPeriod | null;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;
  reference_externe: string | null;

  created_at: string;
  date_signature: string | null;

  date_facturation_one_shot: string | null;
  date_debut_facturation_recurrente: string | null;

  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null;

  client: DbClientFromJoin | DbClientFromJoin[] | null;
  proposition: DbPropositionFromJoin | DbPropositionFromJoin[] | null;

  total_paye_ht: string | number | null;
  total_paye_ttc: string | number | null;
  reste_a_payer_ht: string | number | null;
  reste_a_payer_ttc: string | number | null;
};

/* -------------------------------------------------------------------------- */
/*                              Const/ helpers UI                             */
/* -------------------------------------------------------------------------- */

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

const pageSizeOptions = [5, 10, 25, 50];

const STATUT_LABEL: Record<StatutContrat, string> = {
  brouillon: "Brouillon",
  en_attente_signature: "En attente signature",
  signe: "Signé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  one_shot: "One shot",
  recurring: "Récurrent",
};

export type CategoryOption = {
  value: string;
  label: string;
};

function slugifyForFileName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-") // espaces & caractères spéciaux -> -
    .replace(/^-+|-+$/g, ""); // trim -
}

function getProjectBaseName(c: ContratRow | null): string {
  if (!c) return "contrat";

  const raw =
    c.proposition_titre ||
    c.titre ||
    c.client_nom_affichage ||
    c.client_nom_legal ||
    "contrat";

  return slugifyForFileName(raw);
}

/* -------------------------------------------------------------------------- */
/*                               Props du tableau                             */
/* -------------------------------------------------------------------------- */

export type ContratsTableProps = {
  className?: string;

  /** Scope côté SQL (filtre en base) */
  clientId?: string;
  statutIn?: StatutContrat[];
  billingModelIn?: BillingModel[];
  billingPeriodIn?: BillingPeriod[];
  serviceCategoryIdIn?: string;

  /** Valeurs initiales des filtres UI */
  initialStatutFilter?: StatutContrat | "all";
  initialCategoryFilter?: string | "all";
  initialBillingModelFilter?: BillingModel | "all";

  /** Page size par défaut (50 par défaut) */
  defaultPageSize?: number;

  /** Options personnalisées de catégories (sinon fallback sur les 4 standards) */
  categoryOptions?: CategoryOption[];

  /** Afficher / masquer le filtre de catégories dans la barre de filtres */
  showCategoryFilter?: boolean;

  /** Callback quand on clique toute la ligne */
  onRowClick?: (contrat: ContratRow) => void;

  /** Rendu d'une colonne "Actions" personnalisée à droite */
  renderRowActions?: (contrat: ContratRow) => ReactNode;
};

/* -------------------------------------------------------------------------- */
/*                                Composant                                   */
/* -------------------------------------------------------------------------- */

export function ContratsTable({
  className,
  clientId,
  statutIn,
  billingModelIn,
  billingPeriodIn,
  serviceCategoryIdIn,
  initialStatutFilter = "all",
  initialCategoryFilter = "all",
  initialBillingModelFilter = "all",
  defaultPageSize = 50,
  categoryOptions,
  showCategoryFilter = true,
  onRowClick,
  renderRowActions,
}: ContratsTableProps) {
  const router = useRouter();
  const [data, setData] = useState<ContratRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatutId, setUpdatingStatutId] = useState<string | null>(null);

  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [selectedContrat, setSelectedContrat] = useState<ContratRow | null>(
    null
  );
  const [docDeleting, setDocDeleting] = useState<DocType | null>(null);
  const [zipLoading, setZipLoading] = useState(false);

  // Doc actuellement en édition (devis / devis signé / facture)
  const [activeDocType, setActiveDocType] = useState<DocType | null>(null);

  // dialog pour gérer les factures multiples
  const [facturesDialogOpen, setFacturesDialogOpen] = useState(false);
  const [factures, setFactures] = useState<ListedFile[]>([]);
  const [facturesLoading, setFacturesLoading] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [statutFilter, setStatutFilter] = useState<StatutContrat | "all">(
    initialStatutFilter
  );
  const [categoryFilter, setCategoryFilter] = useState<string | "all">(
    initialCategoryFilter
  );
  const [billingModelFilter, setBillingModelFilter] = useState<
    BillingModel | "all"
  >(initialBillingModelFilter);

  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // options de catégories (UI) — configurable via props
  const effectiveCategoryOptions: CategoryOption[] = categoryOptions ?? [
    { value: "conception-web", label: "Conception web" },
    { value: "direction-artistique", label: "Direction artistique" },
    { value: "social-media-management", label: "Social media management" },
    { value: "strategie-digitale", label: "Stratégie digitale" },
  ];

  // clés stables pour les useEffect (évite JSON.stringify dans le tableau de deps)
  const statutInKey = useMemo(
    () => (statutIn && statutIn.length > 0 ? statutIn.join("|") : ""),
    [statutIn]
  );
  const billingModelInKey = useMemo(
    () =>
      billingModelIn && billingModelIn.length > 0
        ? billingModelIn.join("|")
        : "",
    [billingModelIn]
  );
  const billingPeriodInKey = useMemo(
    () =>
      billingPeriodIn && billingPeriodIn.length > 0
        ? billingPeriodIn.join("|")
        : "",
    [billingPeriodIn]
  );

  /* ------------------------- helpers statut / docs -------------------------- */

  const handleChangeStatut = async (
    contratId: string,
    newStatut: StatutContrat
  ) => {
    // Optimistic update
    setData((prev) =>
      prev.map((c) =>
        c.id === contratId
          ? {
              ...c,
              statut: newStatut,
            }
          : c
      )
    );

    setUpdatingStatutId(contratId);

    const { error } = await supabase
      .from("contrats")
      .update({ statut: newStatut })
      .eq("id", contratId);

    setUpdatingStatutId(null);

    if (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du statut", {
        description: error.message,
      });
      // si tu veux être ultra propre : refetch ici
    } else {
      toast.success("Statut mis à jour");
    }
  };

  const getDocColumn = (docType: DocType): keyof ContratRow => {
    if (docType === "devis") return "devis_pdf_path";
    if (docType === "devis_signe") return "devis_signe_pdf_path";
    return "facture_pdf_path";
  };

  const getDocPath = (
    contrat: ContratRow | null,
    docType: DocType
  ): string | null => {
    if (!contrat) return null;
    const column = getDocColumn(docType);
    const value = contrat[column];
    return typeof value === "string" ? value : null;
  };

  const openSignedUrlInNewTab = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("documents-contrats")
      .createSignedUrl(path, 60 * 5);

    if (error || !data?.signedUrl) {
      console.error(error);
      toast.error("Impossible d’ouvrir le document");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  // ✅ force un vrai téléchargement via Blob (même pour devis / devis signé)
  const downloadFileFromStorage = async (path: string, filename?: string) => {
    const { data, error } = await supabase.storage
      .from("documents-contrats")
      .download(path);

    if (error || !data) {
      console.error(error);
      toast.error("Impossible de télécharger le document");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const loadFacturesForContrat = async (
    contrat: ContratRow
  ): Promise<ListedFile[]> => {
    setFacturesLoading(true);
    try {
      const prefix = `contrats/${contrat.id}/factures`;
      const { data, error } = await supabase.storage
        .from("documents-contrats")
        .list(prefix, { limit: 100 });

      if (error) {
        console.error(error);
        toast.error("Impossible de lister les factures");
        setFactures([]);
        return [];
      }

      const files: ListedFile[] =
        data?.map((f) => ({
          name: f.name,
          path: `${prefix}/${f.name}`,
        })) ?? [];

      setFactures(files);
      return files;
    } finally {
      setFacturesLoading(false);
    }
  };

  const handlePreviewDoc = async (docType: DocType) => {
    if (!selectedContrat) return;

    if (docType === "facture") {
      const files = await loadFacturesForContrat(selectedContrat);

      if (!files.length) {
        toast.error("Aucune facture pour ce contrat.");
        return;
      }

      if (files.length === 1) {
        await openSignedUrlInNewTab(files[0].path);
        return;
      }

      // plusieurs factures -> dialog
      setFacturesDialogOpen(true);
      return;
    }

    // Devis / Devis signé
    const path = getDocPath(selectedContrat, docType);
    if (!path) {
      toast.error("Aucun document pour ce type.");
      return;
    }

    await openSignedUrlInNewTab(path);
  };

  const handleDownloadDoc = async (docType: DocType) => {
    if (!selectedContrat) return;

    const baseName = getProjectBaseName(selectedContrat);

    if (docType === "facture") {
      const files = await loadFacturesForContrat(selectedContrat);

      if (!files.length) {
        toast.error("Aucune facture pour ce contrat.");
        return;
      }

      if (files.length === 1) {
        await downloadFileFromStorage(files[0].path, `facture-${baseName}.pdf`);
        return;
      }

      // plusieurs factures -> ZIP factures-<projet>.zip
      setZipLoading(true);
      try {
        const zip = new JSZip();

        for (const f of files) {
          const { data, error } = await supabase.storage
            .from("documents-contrats")
            .download(f.path);

          if (error || !data) {
            console.error(error);
            toast.error(`Erreur lors du téléchargement de ${f.name}`);
            continue;
          }

          zip.file(f.name, data);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `factures-${baseName}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        toast.error("Erreur lors de la génération du ZIP des factures");
      } finally {
        setZipLoading(false);
      }

      return;
    }

    // Devis / devis signé -> vrai téléchargement
    const path = getDocPath(selectedContrat, docType);
    if (!path) {
      toast.error("Aucun document pour ce type.");
      return;
    }

    const filename =
      docType === "devis"
        ? `devis-${baseName}.pdf`
        : `devis-signe-${baseName}.pdf`;

    await downloadFileFromStorage(path, filename);
  };

  const handleDeleteDoc = async (docType: DocType) => {
    if (!selectedContrat) return;

    setDocDeleting(docType);

    try {
      if (docType === "facture") {
        const files = await loadFacturesForContrat(selectedContrat);

        if (!files.length) {
          toast.error("Aucune facture à supprimer.");
          return;
        }

        const paths = files.map((f) => f.path);

        const { error: removeError } = await supabase.storage
          .from("documents-contrats")
          .remove(paths);

        if (removeError) {
          console.error(removeError);
          toast.error("Erreur lors de la suppression des factures");
          return;
        }

        const { error: updateError } = await supabase
          .from("contrats")
          .update({ facture_pdf_path: null })
          .eq("id", selectedContrat.id);

        if (updateError) {
          console.error(updateError);
          toast.error(
            "Factures supprimées du stockage, mais erreur lors de la mise à jour du contrat"
          );
          return;
        }

        setData((prev) =>
          prev.map((c) =>
            c.id === selectedContrat.id ? { ...c, facture_pdf_path: null } : c
          )
        );
        setSelectedContrat((prev) =>
          prev && prev.id === selectedContrat.id
            ? { ...prev, facture_pdf_path: null }
            : prev
        );
        setFactures([]);

        toast.success("Toutes les factures ont été supprimées");
        return;
      }

      // devis / devis signé
      const path = getDocPath(selectedContrat, docType);
      if (!path) {
        toast.error("Aucun document pour ce type.");
        return;
      }

      const column = getDocColumn(docType);

      const { error: removeError } = await supabase.storage
        .from("documents-contrats")
        .remove([path]);

      if (removeError) {
        console.error(removeError);
        toast.error("Erreur lors de la suppression du fichier");
        return;
      }

      const { error: updateError } = await supabase
        .from("contrats")
        .update({ [column]: null })
        .eq("id", selectedContrat.id);

      if (updateError) {
        console.error(updateError);
        toast.error("Fichier supprimé du stockage, mais erreur SQL");
        return;
      }

      setData((prev) =>
        prev.map((c) =>
          c.id === selectedContrat.id
            ? {
                ...c,
                [column]: null,
              }
            : c
        )
      );

      setSelectedContrat((prev) =>
        prev && prev.id === selectedContrat.id
          ? { ...prev, [column]: null }
          : prev
      );

      toast.success("Document supprimé");
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de la suppression");
    } finally {
      setDocDeleting(null);
    }
  };

  // 🔧 + / crayon -> affiche la dropzone directement dans le dialog principal
  const handleEditDoc = (docType: DocType) => {
    if (!selectedContrat) return;

    setActiveDocType((prev) => (prev === docType ? null : docType));
  };

  const handleDownloadAllDocsZip = async () => {
    if (!selectedContrat) return;

    const baseName = getProjectBaseName(selectedContrat);

    const files: { name: string; path: string }[] = [];

    const devisPath = getDocPath(selectedContrat, "devis");
    if (devisPath)
      files.push({
        name: `devis-${baseName}.pdf`,
        path: devisPath,
      });

    const devisSignePath = getDocPath(selectedContrat, "devis_signe");
    if (devisSignePath)
      files.push({
        name: `devis-signe-${baseName}.pdf`,
        path: devisSignePath,
      });

    const facturePath = getDocPath(selectedContrat, "facture");
    if (facturePath)
      files.push({
        name: `facture-${baseName}.pdf`,
        path: facturePath,
      });

    if (!files.length) {
      toast.error("Aucun document à télécharger pour ce contrat.");
      return;
    }

    setZipLoading(true);
    try {
      const zip = new JSZip();

      for (const file of files) {
        const { data, error } = await supabase.storage
          .from("documents-contrats")
          .download(file.path);

        if (error || !data) {
          console.error(error);
          toast.error(`Erreur lors du téléchargement de ${file.name}`);
          continue;
        }

        zip.file(file.name, data);
      }

      const blob = await zip.generateAsync({ type: "blob" });

      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;

      a.download = `docs_contrat-${baseName}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du ZIP");
    } finally {
      setZipLoading(false);
    }
  };

  const renderDocRow = (label: string, docType: DocType) => {
    if (!selectedContrat) return null;

    const path = getDocPath(selectedContrat, docType);
    const hasFile = !!path;
    const baseName = getProjectBaseName(selectedContrat);

    let logicalFileName: string;
    switch (docType) {
      case "devis":
        logicalFileName = `devis-${baseName}.pdf`;
        break;
      case "devis_signe":
        logicalFileName = `devis-signe-${baseName}.pdf`;
        break;
      case "facture":
        logicalFileName = `facture-${baseName}.pdf`;
        break;
      default:
        logicalFileName = `${label.toLowerCase()}-${baseName}.pdf`;
    }

    const isEditing = activeDocType === docType;

    return (
      <div key={docType} className="rounded-md border px-3 py-2 text-xs">
        {/* Ligne principale : titre + boutons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-medium">{label}</span>
            <span className="font-mono text-[11px] max-w-[220px] truncate">
              {hasFile ? logicalFileName : `(${logicalFileName} non présent)`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {hasFile ? "Fichier attaché" : "Aucun fichier pour ce type"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {hasFile ? (
              <>
                {/* Voir */}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => handlePreviewDoc(docType)}
                  title="Voir le document"
                >
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">Voir le document</span>
                </Button>

                {/* Télécharger */}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => handleDownloadDoc(docType)}
                  title="Télécharger"
                  disabled={zipLoading && docType === "facture"}
                >
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Télécharger</span>
                </Button>

                {/* Crayon = éditer / remplacer via dropzone inline */}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => handleEditDoc(docType)}
                  title="Remplacer le fichier"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Remplacer le fichier</span>
                </Button>

                {/* Supprimer */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteDoc(docType)}
                  disabled={docDeleting === docType}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Supprimer</span>
                </Button>
              </>
            ) : (
              <>
                {/* Aucun fichier -> juste un bouton + qui affiche la dropzone inline */}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => handleEditDoc(docType)}
                  title="Ajouter un fichier"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Ajouter un fichier</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Zone dropzone inline quand + ou crayon est cliqué */}
        {isEditing && (
          <div className="mt-3 rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-4">
            <p className="mb-2 text-xs text-muted-foreground">
              {docType === "devis"
                ? "Mettre à jour le devis. Dépose ton fichier PDF ou clique dans la zone pour le choisir."
                : docType === "devis_signe"
                ? "Mettre à jour le devis signé. Dépose ton fichier PDF ou clique dans la zone pour le choisir."
                : "Ajouter / mettre à jour les factures. Dépose ton ou tes fichiers PDF ou clique dans la zone pour les choisir."}
            </p>

            <ContratDocumentUploader
              contratId={selectedContrat.id}
              docType={docType}
              existingPath={path ?? null}
              zipBaseName={
                selectedContrat.proposition_titre ||
                selectedContrat.titre ||
                selectedContrat.client_nom_affichage ||
                undefined
              }
            />
          </div>
        )}
      </div>
    );
  };

  /* ------------------------------ fetch contrats ----------------------------- */

  useEffect(() => {
    const fetchContrats = async () => {
      setLoading(true);

      try {
        let query = supabase
          .from("contrats_with_paiements")
          .select(
            `
            id,
            slug,
            proposition_id,
            client_id,
            titre,
            description,
            statut,
            montant_ht,
            montant_ht_one_shot,
            montant_ht_mensuel,
            tva_rate,
            montant_ttc,
            billing_model,
            billing_period,
            date_debut,
            date_fin_prevue,
            nb_mois_engagement,
            reference_externe,
            created_at,
            date_signature,
            date_facturation_one_shot,
            date_debut_facturation_recurrente,

            devis_pdf_path,
            devis_signe_pdf_path,
            facture_pdf_path,
            total_paye_ht,
            total_paye_ttc,
            reste_a_payer_ht,
            reste_a_payer_ttc,

            client:client_id (
              slug,
              nom_affichage,
              nom_legal
            ),

            proposition:proposition_id (
              titre,
              url_envoi,
              service_category:service_category_id (
                id,
                slug,
                label
              ),
              proposition_services (
                service_id,
                service:service_id (
                  id,
                  label
                )
              )
            )
          `
          )
          .order("created_at", { ascending: false });

        // On reconstruit les tableaux à partir des keys
        const statutValues: StatutContrat[] = statutInKey
          ? (statutInKey.split("|") as StatutContrat[])
          : [];
        const billingModelValues: BillingModel[] = billingModelInKey
          ? (billingModelInKey.split("|") as BillingModel[])
          : [];
        const billingPeriodValues: BillingPeriod[] = billingPeriodInKey
          ? (billingPeriodInKey.split("|") as BillingPeriod[])
          : [];

        if (statutValues.length > 0) {
          query = query.in("statut", statutValues);
        }

        if (billingModelValues.length > 0) {
          query = query.in("billing_model", billingModelValues);
        }

        if (billingPeriodValues.length > 0) {
          query = query.in("billing_period", billingPeriodValues);
        }

        if (clientId) {
          query = query.eq("client_id", clientId);
        }

        if (serviceCategoryIdIn) {
          query = query.eq("service_category_id", serviceCategoryIdIn);
        }

        const { data, error } = await query;

        if (error) {
          console.error(error);
          toast.error("Erreur lors du chargement des contrats", {
            description: error.message,
          });
          setData([]);
          return;
        }

        const raw = (data ?? []) as DbContratRow[];

        const toNumber = (v: string | number | null): number | null => {
          if (v == null) return null;
          if (typeof v === "number") return v;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };

        const mapped: ContratRow[] = raw.map((row) => {
          const clientJoined: DbClientFromJoin | null = Array.isArray(
            row.client
          )
            ? row.client[0] ?? null
            : row.client;

          const propositionJoined: DbPropositionFromJoin | null = Array.isArray(
            row.proposition
          )
            ? row.proposition[0] ?? null
            : row.proposition;

          const catJoined: DbServiceCategoryFromJoin | null =
            propositionJoined && propositionJoined.service_category
              ? Array.isArray(propositionJoined.service_category)
                ? propositionJoined.service_category[0] ?? null
                : propositionJoined.service_category
              : null;

          // ------------ services issus de proposition_services ------------
          const propositionServicesRaw =
            propositionJoined?.proposition_services ?? null;

          let propositionServices: { id: string; label: string | null }[] = [];
          let propositionServiceIds: string[] = [];

          if (propositionServicesRaw) {
            const arr = Array.isArray(propositionServicesRaw)
              ? propositionServicesRaw
              : [propositionServicesRaw];

            propositionServices = arr.map((ps) => {
              const serviceJoined = ps.service
                ? Array.isArray(ps.service)
                  ? ps.service[0] ?? null
                  : ps.service
                : null;

              const label = serviceJoined?.label ?? null;

              return {
                id: ps.service_id,
                label,
              };
            });

            propositionServiceIds = propositionServices.map((s) => s.id);
          }

          const montantHt = toNumber(row.montant_ht);
          const montantHtOneShot = toNumber(row.montant_ht_one_shot);
          const montantHtMensuel = toNumber(row.montant_ht_mensuel);
          const tvaRate = toNumber(row.tva_rate);
          const montantTtc = toNumber(row.montant_ttc);

          const totalPayeHt = toNumber(row.total_paye_ht);
          const totalPayeTtc = toNumber(row.total_paye_ttc);
          const resteHt = toNumber(row.reste_a_payer_ht);
          const resteTtc = toNumber(row.reste_a_payer_ttc);

          return {
            id: row.id,
            proposition_id: row.proposition_id,
            client_id: row.client_id,

            slug: row.slug,
            client_slug: clientJoined?.slug ?? null,

            titre: row.titre,
            description: row.description ?? null,
            statut: row.statut,

            montant_ht: montantHt,
            montant_ht_one_shot: montantHtOneShot,
            montant_ht_mensuel: montantHtMensuel,
            tva_rate: tvaRate,
            montant_ttc: montantTtc,

            billing_model: row.billing_model ?? "one_shot",
            billing_period: row.billing_period ?? "one_time",
            date_debut: row.date_debut,
            date_fin_prevue: row.date_fin_prevue,
            nb_mois_engagement: row.nb_mois_engagement,
            reference_externe: row.reference_externe,

            created_at: row.created_at,
            date_signature: row.date_signature,

            // temporalité facturation
            date_facturation_one_shot: row.date_facturation_one_shot,
            date_debut_facturation_recurrente:
              row.date_debut_facturation_recurrente,

            client_nom_affichage: clientJoined?.nom_affichage ?? null,
            client_nom_legal: clientJoined?.nom_legal ?? null,

            proposition_titre: propositionJoined?.titre ?? null,
            proposition_url_envoi: propositionJoined?.url_envoi ?? null,

            service_category: catJoined
              ? {
                  id: catJoined.id,
                  slug: catJoined.slug,
                  label: catJoined.label,
                }
              : null,
            service_category_slug: catJoined?.slug ?? null,
            service_category_label: catJoined?.label ?? null,

            devis_pdf_path: row.devis_pdf_path,
            devis_signe_pdf_path: row.devis_signe_pdf_path,
            facture_pdf_path: row.facture_pdf_path,

            total_paye_ht: totalPayeHt,
            total_paye_ttc: totalPayeTtc,
            reste_a_payer_ht: resteHt,
            reste_a_payer_ttc: resteTtc,

            proposition_service_ids: propositionServiceIds,
            proposition_services: propositionServices,
          };
        });

        setData(mapped);
      } finally {
        setLoading(false);
      }
    };

    void fetchContrats();
  }, [
    clientId,
    serviceCategoryIdIn,
    statutInKey,
    billingModelInKey,
    billingPeriodInKey,
  ]);

  // dès qu’on change recherche / filtre / pageSize, on revient à la page 1
  useEffect(() => {
    setPageIndex(0);
  }, [searchValue, statutFilter, categoryFilter, billingModelFilter, pageSize]);

  useEffect(() => {
    // Quand le dialog principal est fermé, on nettoie
    if (!docsDialogOpen) {
      setSelectedContrat(null);
      setActiveDocType(null);
    }
  }, [docsDialogOpen]);

  /* ------------------------------ filtres front ------------------------------ */

  const filteredData = useMemo(() => {
    const search = searchValue.toLowerCase().trim();

    return data.filter((c) => {
      if (statutFilter !== "all" && c.statut !== statutFilter) {
        return false;
      }

      if (
        categoryFilter !== "all" &&
        c.service_category_slug !== categoryFilter
      ) {
        return false;
      }

      if (
        billingModelFilter !== "all" &&
        c.billing_model !== billingModelFilter
      ) {
        return false;
      }

      if (!search) return true;

      const content = [
        c.titre ?? "",
        c.description ?? "",
        c.client_nom_affichage ?? "",
        c.client_nom_legal ?? "",
        c.service_category_label ?? "",
        c.proposition_titre ?? "",
        c.reference_externe ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(search);
    });
  }, [data, searchValue, statutFilter, categoryFilter, billingModelFilter]);

  const totalFiltered = filteredData.length;

  const pageData = useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, pageIndex, pageSize]);

  const handleClearSearch = () => {
    setSearchValue("");
  };

  const fmt = (v: number | null) =>
    v == null
      ? "—"
      : v.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Barre de recherche & filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full max-w-xs items-center gap-2">
          <Input
            placeholder="Rechercher (titre, client, catégorie, réf. externe...)"
            aria-label="Rechercher un contrat"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          {Boolean(searchValue) && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleClearSearch}
            >
              ×
            </Button>
          )}
        </div>

        {/* Filtre statut */}
        <Select
          value={statutFilter}
          onValueChange={(value) =>
            setStatutFilter(value as StatutContrat | "all")
          }
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="brouillon">{STATUT_LABEL.brouillon}</SelectItem>
            <SelectItem value="en_attente_signature">
              {STATUT_LABEL.en_attente_signature}
            </SelectItem>
            <SelectItem value="signe">{STATUT_LABEL.signe}</SelectItem>
            <SelectItem value="en_cours">{STATUT_LABEL.en_cours}</SelectItem>
            <SelectItem value="termine">{STATUT_LABEL.termine}</SelectItem>
            <SelectItem value="annule">{STATUT_LABEL.annule}</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtre catégorie (optionnel) */}
        {showCategoryFilter && (
          <Select
            value={categoryFilter}
            onValueChange={(value) =>
              setCategoryFilter(value as string | "all")
            }
          >
            <SelectTrigger className="h-8 w-[210px] text-xs">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {effectiveCategoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtre modèle de facturation (one shot / RMM / mixte) */}
        <Select
          value={billingModelFilter}
          onValueChange={(value) =>
            setBillingModelFilter(value as BillingModel | "all")
          }
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Tous les modèles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modèles</SelectItem>
            <SelectItem value="one_shot">
              {BILLING_MODEL_LABEL.one_shot}
            </SelectItem>
            <SelectItem value="recurring">
              {BILLING_MODEL_LABEL.recurring}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Shadcn */}
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Contrat
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Catégorie
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Services
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Montant
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Statut
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium">
                Docs
              </TableHead>
              {renderRowActions && (
                <TableHead className="px-3 py-2 text-right text-xs font-medium">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={renderRowActions ? 6 : 5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Chargement des contrats...
                </TableCell>
              </TableRow>
            ) : pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={renderRowActions ? 6 : 5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Aucun contrat pour le moment.
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((c) => {
                const handleRowClick = () => {
                  if (onRowClick) {
                    onRowClick(c);
                  }
                };

                return (
                  <TableRow
                    key={c.id}
                    className={cn(
                      "border-t",
                      onRowClick &&
                        "cursor-pointer hover:bg-muted/40 transition-colors"
                    )}
                    onClick={handleRowClick}
                  >
                    {/* Contrat + client + proposition */}
                    <TableCell className="px-3 py-2 align-middle">
                      <div className="flex flex-col">
                        {/* Titre cliquable -> détail contrat */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (c.client_slug && c.slug) {
                              router.push(
                                `/dashboard/clients/${c.client_slug}/contrats/${c.slug}`
                              );
                            }
                          }}
                          className="w-fit text-left text-sm font-medium text-primary hover:underline"
                        >
                          {c.titre || "Sans titre"}
                        </button>

                        <span className="text-xs text-muted-foreground">
                          {c.client_nom_affichage ||
                            c.client_nom_legal ||
                            "Client inconnu"}
                        </span>

                        {c.proposition_titre && (
                          <span className="text-[11px] text-muted-foreground">
                            Propal : {c.proposition_titre}
                          </span>
                        )}
                        {c.reference_externe && (
                          <span className="text-[11px] text-muted-foreground">
                            Réf. externe : {c.reference_externe}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Service (catégorie) */}
                    <TableCell className="px-3 py-2 align-middle">
                      {c.service_category_label ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                            getCategoryBadgeClasses(c.service_category_slug)
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              getCategoryDotClasses(c.service_category_slug)
                            )}
                          />
                          <span>{c.service_category_label}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Non définie
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-3 py-2 align-middle text-xs">
                      {c.proposition_services.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.proposition_services.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px]"
                            >
                              {s.label ?? s.id}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    {/* Montant : HT + TTC (total contrat, ultra simple) */}
                    <TableCell className="px-3 py-2 align-middle text-xs">
                      {c.montant_ht == null && c.montant_ttc == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col">
                          {c.montant_ht != null && (
                            <span>{fmt(c.montant_ht)} HT</span>
                          )}
                          {c.montant_ttc != null && (
                            <span className="text-[11px] text-muted-foreground">
                              {fmt(c.montant_ttc)} TTC
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Statut (select Shadcn) */}
                    <TableCell
                      className="px-3 py-2 align-middle text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={c.statut}
                        onValueChange={(value) =>
                          handleChangeStatut(c.id, value as StatutContrat)
                        }
                        disabled={updatingStatutId === c.id}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brouillon">
                            {STATUT_LABEL.brouillon}
                          </SelectItem>
                          <SelectItem value="en_attente_signature">
                            {STATUT_LABEL.en_attente_signature}
                          </SelectItem>
                          <SelectItem value="signe">
                            {STATUT_LABEL.signe}
                          </SelectItem>
                          <SelectItem value="en_cours">
                            {STATUT_LABEL.en_cours}
                          </SelectItem>
                          <SelectItem value="termine">
                            {STATUT_LABEL.termine}
                          </SelectItem>
                          <SelectItem value="annule">
                            {STATUT_LABEL.annule}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Docs : un seul bouton qui ouvre le dialog */}
                    <TableCell
                      className="px-3 py-2 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setSelectedContrat(c);
                          setDocsDialogOpen(true);
                        }}
                        title="Gérer les documents"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="sr-only">Gérer les documents</span>
                      </Button>
                    </TableCell>

                    {/* Actions */}
                    {renderRowActions && (
                      <TableCell
                        className="px-3 py-2 align-middle text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderRowActions(c)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog principal : docs du contrat */}
      <Dialog
        open={docsDialogOpen}
        onOpenChange={(open) => {
          setDocsDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              Documents du contrat
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedContrat
                ? `${selectedContrat.titre || "Sans titre"} – ${
                    selectedContrat.client_nom_affichage ||
                    selectedContrat.client_nom_legal ||
                    "Client inconnu"
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedContrat && (
            <div className="flex flex-col gap-3 text-xs">
              {/* Proposition */}
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex flex-col">
                  <span className="font-medium">Proposition commerciale</span>
                  <span className="font-mono text-[11px]">
                    {`propos-${getProjectBaseName(selectedContrat)}`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedContrat.proposition_url_envoi
                      ? "Lien disponible"
                      : "Aucun lien associé"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedContrat.proposition_url_envoi && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={selectedContrat.proposition_url_envoi}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ouvrir
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Devis */}
              {renderDocRow("Devis", "devis")}

              {/* Devis signé */}
              {renderDocRow("Devis signé", "devis_signe")}

              {/* Factures */}
              {renderDocRow("Factures", "facture")}
            </div>
          )}

          <DialogFooter className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDocsDialogOpen(false);
              }}
            >
              Fermer
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownloadAllDocsZip}
              disabled={zipLoading || !selectedContrat}
            >
              {zipLoading ? "Préparation du ZIP..." : "Télécharger tout (ZIP)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog factures multiples */}
      <Dialog open={facturesDialogOpen} onOpenChange={setFacturesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              Factures –{" "}
              {selectedContrat ? getProjectBaseName(selectedContrat) : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Liste des factures associées à ce contrat.
            </DialogDescription>
          </DialogHeader>

          {facturesLoading ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Chargement des factures...
            </p>
          ) : factures.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Aucune facture à afficher.
            </p>
          ) : (
            <div className="space-y-2">
              {factures.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px]">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Voir */}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => openSignedUrlInNewTab(f.path)}
                      title="Voir"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Voir</span>
                    </Button>

                    {/* Télécharger */}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => downloadFileFromStorage(f.path, f.name)}
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Télécharger</span>
                    </Button>

                    {/* Supprimer une seule facture */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await supabase.storage
                            .from("documents-contrats")
                            .remove([f.path]);
                          toast.success("Facture supprimée");
                          if (selectedContrat) {
                            await loadFacturesForContrat(selectedContrat);
                          }
                        } catch (err) {
                          console.error(err);
                          toast.error(
                            "Erreur lors de la suppression de la facture"
                          );
                        }
                      }}
                      title="Supprimer cette facture"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Supprimer</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Résultats par page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={String(size)} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span>
            {totalFiltered === 0
              ? "0–0"
              : `${pageIndex * pageSize + 1}–${Math.min(
                  (pageIndex + 1) * pageSize,
                  totalFiltered
                )}`}{" "}
            sur {totalFiltered}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(0)}
              disabled={pageIndex === 0}
            >
              {"<<"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
            >
              {"<"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setPageIndex((prev) =>
                  (prev + 1) * pageSize >= totalFiltered ? prev : prev + 1
                )
              }
              disabled={(pageIndex + 1) * pageSize >= totalFiltered}
            >
              {">"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setPageIndex(
                  Math.max(Math.ceil(totalFiltered / pageSize) - 1, 0)
                )
              }
              disabled={(pageIndex + 1) * pageSize >= totalFiltered}
            >
              {">>"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContratRowActions({ contrat }: { contrat: ContratRow }) {
  const router = useRouter();

  const goToDetails = () => {
    if (contrat.client_slug && contrat.slug) {
      router.push(
        `/dashboard/clients/${contrat.client_slug}/contrats/${contrat.slug}`
      );
    } else {
      toast.error(
        "Impossible d’ouvrir le détail du contrat (slug client ou contrat manquant)."
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="shadow-none"
            aria-label="Actions sur le contrat"
          >
            <EllipsisVerticalIcon size={16} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={goToDetails}>
          Détails
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}