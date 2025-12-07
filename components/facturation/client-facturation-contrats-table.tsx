// components/facturation/client-facturation-contrats-table.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Eye,
  Download,
  Pencil,
  Plus,
  EllipsisVertical,
  Trash2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { ContratDocumentUploader } from "@/components/contrats-propos/contrat-document-uploader";

const supabase = createClient();

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ContratPaiementRow = {
  id: string;
  contrat_id: string;
  montant_ht: string | null;
  montant_ttc: string | null;
  date_paiement: string;
  mode_paiement: string | null;
  note: string | null;
  commentaire: string | null;
};

export type ContratFacturationSnapshot = {
  nbMoisTotal: number;
  nbMoisEcoules: number;

  engagementTotalHt: number;
  engagementTotalTtc: number;

  duHt: number;
  duTtc: number;

  paidHt: number;
  paidTtc: number;

  resteDuHt: number;
  resteDuTtc: number;

  engagementFuturHt: number;
  engagementFuturTtc: number;
};

export type ContratFacturationContrat = {
  id: string;
  client_id: string;
  titre: string;
  statut: string;

  montant_ht: string;
  montant_ttc: string | null;
  tva_rate: number | null;
  devise: string;

  billing_model: "one_shot" | "recurrent" | "mixte";
  billing_period: "one_time" | "monthly";

  date_signature: string | null;
  date_debut: string | null;
  date_fin_prevue: string | null;
  nb_mois_engagement: number | null;

  montant_ht_one_shot: string | null;
  montant_ht_mensuel: string | null;

  devis_pdf_path: string | null;
  devis_signe_pdf_path: string | null;
  facture_pdf_path: string | null; // optionnel pour un ZIP global

  contrat_paiements: ContratPaiementRow[];
};

export type ContratFacturationRow = {
  contrat: ContratFacturationContrat;
  snapshot: ContratFacturationSnapshot;
};

type ClientFacturationContratsTableProps = {
    contrats: ContratFacturationRow[];
    devise: string;
    onPaymentAdded: () => void;
  
    /** Affiche ou non le select "statut" dans la barre de filtres */
    showStatusFilter?: boolean;
  };

type DocType = "devis" | "devis_signe" | "facture";

type FactureFile = {
  name: string;
  path: string;
  createdAt?: string | null;
};

/* -------------------------------------------------------------------------- */
/*                              HELPERS COMMUNS                               */
/* -------------------------------------------------------------------------- */

function formatMontant(montant: number, devise: string) {
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise || "EUR",
    maximumFractionDigits: 2,
  });

  return formatter.format(montant || 0);
}

type ContratStatusBadgeProps = {
  statut: string;
};

function ContratStatusBadge({ statut }: ContratStatusBadgeProps) {
  const baseClass =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

  const variantClass =
    statut === "signe"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
      : statut === "brouillon"
      ? "bg-muted text-muted-foreground"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";

  return <span className={`${baseClass} ${variantClass}`}>{statut}</span>;
}

function slugifyForFileName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getProjectBaseName(titre: string | null): string {
  if (!titre) return "contrat";
  return slugifyForFileName(titre);
}

function getDevisStoragePath(contratId: string): string {
  return `contrats/${contratId}/devis.pdf`;
}

function getDevisSigneStoragePath(contratId: string): string {
  return `contrats/${contratId}/devis_signe.pdf`;
}

async function openSignedUrlInNewTab(path: string) {
  const { data, error } = await supabase.storage
    .from("documents-contrats")
    .createSignedUrl(path, 60 * 5);

  if (error || !data?.signedUrl) {
    console.error(error);
    toast.error("Impossible d’ouvrir le document");
    return;
  }

  window.open(data.signedUrl, "_blank");
}

async function downloadFileFromStorage(path: string, filename?: string) {
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
}

/* -------------------------------------------------------------------------- */
/*                     CELLULES DOCS (Devis / Signé)                          */
/* -------------------------------------------------------------------------- */

type DocCellProps = {
  hasFile: boolean;
  path: string | null;
  label: string;
  defaultFileName: string;
  onOpenEdit: () => void;
};

function DocCell({
  hasFile,
  path,
  label,
  defaultFileName,
  onOpenEdit,
}: DocCellProps) {
  const safePath = path && path.trim() !== "" ? path : null;

  if (!hasFile || !safePath) {
    return (
      <div className="flex justify-center">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          title={`Ajouter un fichier ${label.toLowerCase()}`}
          onClick={onOpenEdit}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        title={`Voir ${label}`}
        onClick={() => openSignedUrlInNewTab(safePath)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        title={`Télécharger ${label}`}
        onClick={() => downloadFileFromStorage(safePath, defaultFileName)}
      >
        <Download className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        title={`Modifier le fichier ${label.toLowerCase()}`}
        onClick={onOpenEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          DIALOG EDITION DE DOCUMENT                        */
/* -------------------------------------------------------------------------- */

type EditDocState = {
  docType: DocType;
  contrat: ContratFacturationContrat;
} | null;

function getDocPath(contrat: ContratFacturationContrat, docType: DocType) {
  if (docType === "devis") return contrat.devis_pdf_path;
  if (docType === "devis_signe") return contrat.devis_signe_pdf_path;
  return contrat.facture_pdf_path;
}

type EditDocDialogProps = {
  state: EditDocState;
  onClose: () => void;
  onAfterChange: () => void;
};

function EditDocDialog({ state, onClose, onAfterChange }: EditDocDialogProps) {
  const open = state !== null;

  if (!state) return null;

  const { contrat, docType } = state;
  const existingPath = getDocPath(contrat, docType);
  const label =
    docType === "devis"
      ? "Devis"
      : docType === "devis_signe"
      ? "Devis signé"
      : "Factures";

  const projectLabel = contrat.titre ?? "Contrat";

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      onAfterChange();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gérer le document – {label}</DialogTitle>
          <DialogDescription className="text-xs">
            {projectLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <p className="text-muted-foreground">
            Dépose ton fichier PDF ou clique dans la zone pour le sélectionner.
          </p>

          <ContratDocumentUploader
            contratId={contrat.id}
            docType={docType}
            existingPath={existingPath ?? null}
            zipBaseName={projectLabel}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenChange.bind(null, false)}
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                  FACTURES DIALOG (listing / voir / DL / delete)           */
/* -------------------------------------------------------------------------- */

type FacturesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrat: ContratFacturationContrat;
  onFilesCountChange?: (count: number) => void;
};

type SupabaseFileObject = {
  name: string;
  updated_at?: string;
  created_at?: string;
};

async function listFacturesForContrat(
  contratId: string
): Promise<FactureFile[]> {
  const folder = `contrats/${contratId}/factures`;

  const { data, error } = await supabase.storage
    .from("documents-contrats")
    .list(folder, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    console.error(error);
    toast.error("Impossible de lister les factures");
    return [];
  }

  return (data ?? []).map((f: SupabaseFileObject) => ({
    name: f.name,
    path: `${folder}/${f.name}`,
    createdAt: f.updated_at ?? f.created_at ?? null,
  }));
}

async function deleteFacture(path: string) {
  const { error } = await supabase.storage
    .from("documents-contrats")
    .remove([path]);

  if (error) {
    console.error(error);
    toast.error("Impossible de supprimer la facture");
    return false;
  }

  toast.success("Facture supprimée");
  return true;
}

async function uploadFactureFile(contratId: string, file: File) {
  const folder = `contrats/${contratId}/factures`;
  const uniqueName = `${Date.now()}-${file.name}`;
  const path = `${folder}/${uniqueName}`;

  const { error } = await supabase.storage
    .from("documents-contrats")
    .upload(path, file);

  if (error) {
    console.error(error);
    toast.error("Impossible d’uploader la facture");
    return false;
  }

  toast.success("Facture ajoutée");
  return true;
}

async function downloadFacturesZipForContrat(
    contrat: ContratFacturationContrat
  ) {
    try {
      const files = await listFacturesForContrat(contrat.id);
  
      if (!files.length) {
        toast.error("Aucune facture pour ce contrat.");
        return;
      }
  
      // si une seule facture -> simple download
      const baseName =
        (contrat.titre || "contrat")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "contrat";
  
      if (files.length === 1) {
        await downloadFileFromStorage(
          files[0].path,
          `facture-${baseName}.pdf`
        );
        return;
      }
  
      // plusieurs factures -> ZIP côté front
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
      toast.error("Erreur lors du téléchargement du ZIP de factures");
    }
  }

function FacturesDialog({
  open,
  onOpenChange,
  contrat,
  onFilesCountChange,
}: FacturesDialogProps) {
  const [files, setFiles] = useState<FactureFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fileToDelete, setFileToDelete] = useState<FactureFile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listFacturesForContrat(contrat.id);
      setFiles(list);

      if (typeof onFilesCountChange === "function") {
        onFilesCountChange(list.length);
      }
    } finally {
      setLoading(false);
    }
  }, [contrat.id, onFilesCountChange]);

  useEffect(() => {
    if (open) {
      void loadFiles();
    }
  }, [open, loadFiles]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const pdfFiles = filesArray.filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      toast.error("Merci de déposer uniquement des fichiers PDF.");
      return;
    }

    setUploading(true);
    try {
      for (const file of pdfFiles) {
        const ok = await uploadFactureFile(contrat.id, file);
        if (!ok) {
          console.error("Upload échoué pour", file.name);
        }
      }
      await loadFiles();
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const requestDelete = (file: FactureFile) => {
    setFileToDelete(file);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setDeleteLoading(true);
    try {
      const ok = await deleteFacture(fileToDelete.path);
      if (ok) {
        await loadFiles();
        setFileToDelete(null);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleteLoading) return;
    setFileToDelete(null);
  };

  const confirmDialogOpen = !!fileToDelete;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Factures du contrat</DialogTitle>
            <DialogDescription className="text-xs">
              {contrat.titre ?? "Contrat"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Dépose tes factures PDF ou clique dans la zone pour les
                sélectionner.
              </p>

              <div
                className="border border-dashed rounded-md px-3 py-4 text-xs flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/40 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <p className="font-medium">
                  Glisse-dépose ici ou clique pour choisir des fichiers
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PDF uniquement • plusieurs fichiers autorisés
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleUploadChange}
                  disabled={uploading}
                />
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground">
                Chargement des factures…
              </p>
            ) : files.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucune facture enregistrée pour ce contrat.
              </p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom du fichier</TableHead>
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead className="text-right w-[160px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.path}>
                        <TableCell className="max-w-[220px] truncate">
                          {file.name}
                        </TableCell>
                        <TableCell>
                          {file.createdAt
                            ? format(new Date(file.createdAt), "dd MMM yyyy", {
                                locale: fr,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              title="Voir"
                              onClick={() => openSignedUrlInNewTab(file.path)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              title="Télécharger"
                              onClick={() =>
                                downloadFileFromStorage(file.path, file.name)
                              }
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 text-red-600 hover:text-red-700"
                              title="Supprimer"
                              onClick={() => requestDelete(file)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDialogOpen}
        onOpenChange={(open) => !open && handleCancelDelete()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la facture ?</DialogTitle>
            <DialogDescription className="text-xs">
              Tu es sur le point de supprimer la facture{" "}
              <span className="font-medium">{fileToDelete?.name ?? ""}</span>.
              Cette action est définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleteLoading}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                        DIALOG DÉTAILS CONTRAT + PAIEMENTS                  */
/* -------------------------------------------------------------------------- */

type ContratDetailsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    row: ContratFacturationRow;
    devise: string;
    // 🔹 callback pour refetch après ajout / suppression d’un paiement
    onPaymentChanged: () => void;
    // 🔹 pour déclencher l’ouverture du dialog "Ajouter un paiement"
    onAddPaiementClick: () => void;
  };
  
  function ContratDetailsDialog({
    open,
    onOpenChange,
    row,
    devise,
    onPaymentChanged,
    onAddPaiementClick,
  }: ContratDetailsDialogProps) {
    const { contrat, snapshot } = row;
    const paiements = contrat.contrat_paiements || [];
    const {
      engagementTotalHt,
      engagementTotalTtc,
      paidHt,
      paidTtc,
      resteDuHt,
      resteDuTtc,
      nbMoisTotal,
      nbMoisEcoules,
      engagementFuturTtc,
    } = snapshot;
  
    const tvaRate = Number(contrat.tva_rate ?? 20);
    const [deletingId, setDeletingId] = useState<string | null>(null);
  
    const handleDeletePaiement = async (paiementId: string) => {
      setDeletingId(paiementId);
      try {
        const { error } = await supabase
          .from("contrat_paiements")
          .delete()
          .eq("id", paiementId);
  
        if (error) {
          console.error(error);
          toast.error("Erreur lors de la suppression du paiement");
          return;
        }
  
        toast.success("Paiement supprimé");
        onPaymentChanged();
      } catch (err) {
        console.error(err);
        toast.error("Erreur inattendue lors de la suppression du paiement");
      } finally {
        setDeletingId(null);
      }
    };
  
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            {/* 🔹 Titre mis à jour */}
            <DialogTitle>Paiements</DialogTitle>
            <DialogDescription>
              Synthèse et historique des paiements pour ce contrat.
            </DialogDescription>
          </DialogHeader>
  
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{contrat.titre}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Statut : <ContratStatusBadge statut={contrat.statut} />
              </p>
              {contrat.billing_model !== "one_shot" && nbMoisTotal > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Récurrent : {nbMoisEcoules}/{nbMoisTotal} mois “accrus” à date
                </p>
              )}
            </div>
  
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard
                label="Engagement contrat"
                ttc={engagementTotalTtc}
                ht={engagementTotalHt}
                devise={devise}
              />
              <SummaryCard
                label="Total payé"
                ttc={paidTtc}
                ht={paidHt}
                devise={devise}
              />
              <SummaryCard
                label="Reste dû à date"
                ttc={resteDuTtc}
                ht={resteDuHt}
                devise={devise}
                highlight={resteDuTtc > 0}
              />
            </div>
  
            {engagementFuturTtc > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Engagement futur (non encore exigible) :{" "}
                {formatMontant(engagementFuturTtc, devise)} TTC
              </p>
            )}
  
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paiements
              </p>
              {paiements.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun paiement enregistré pour ce contrat.
                </p>
              ) : (
                <PaiementsSubTable
                  paiements={paiements}
                  devise={devise}
                  tvaRate={tvaRate}
                  onDeletePaiement={handleDeletePaiement}
                  deletingId={deletingId}
                />
              )}
            </div>
  
            {/* 🔹 Bouton en bas pour ajouter un paiement */}
            <div className="pt-2 flex justify-end">
              <Button type="button" size="sm" onClick={onAddPaiementClick}>
                Ajouter un paiement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  type PaiementsSubTableProps = {
    paiements: ContratPaiementRow[];
    devise: string;
    tvaRate: number;
    onDeletePaiement: (id: string) => void;
    deletingId: string | null;
  };
  
  function PaiementsSubTable({
    paiements,
    devise,
    tvaRate,
    onDeletePaiement,
    deletingId,
  }: PaiementsSubTableProps) {
    return (
      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date paiement</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Commentaire</TableHead>
              {/* 🔹 nouvelle colonne Actions */}
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paiements.map((p) => {
              const pTtcRaw =
                p.montant_ttc != null
                  ? Number(p.montant_ttc)
                  : Number(p.montant_ht || 0);
              const pHtRaw = p.montant_ht != null ? Number(p.montant_ht) : 0;
              const montantHt =
                pHtRaw > 0 ? pHtRaw : pTtcRaw / (1 + tvaRate / 100);
  
              const isDeleting = deletingId === p.id;
  
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {format(new Date(p.date_paiement), "dd MMM yyyy", {
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      {formatMontant(pTtcRaw, devise)}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        TTC
                      </span>
                    </div>
                    {montantHt > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {formatMontant(montantHt, devise)} HT
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{p.mode_paiement ?? "—"}</TableCell>
                  <TableCell>{p.note ?? "—"}</TableCell>
                  <TableCell>{p.commentaire ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-600 hover:text-red-700"
                      onClick={() => onDeletePaiement(p.id)}
                      disabled={isDeleting}
                      title="Supprimer le paiement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

/* -------------------------------------------------------------------------- */
/*                        DIALOG AJOUT PAIEMENT (ACTIONS)                     */
/* -------------------------------------------------------------------------- */

type AddPaiementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratId: string;
  devise: string;
  tvaRate: number;
  onPaymentAdded: () => void;
};

function AddPaiementDialog({
  open,
  onOpenChange,
  contratId,
  devise,
  tvaRate,
  onPaymentAdded,
}: AddPaiementDialogProps) {
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [montant, setMontant] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [commentaire, setCommentaire] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setMontant("");
    setMode("");
    setNote("");
    setCommentaire("");
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      resetForm();
    }
    onOpenChange(value);
  };

  const handleSubmit = async () => {
    const montantClean = montant.replace(",", ".");
    const montantTtc = Number(montantClean);

    if (!montant || Number.isNaN(montantTtc) || montantTtc <= 0) {
      toast.error("Merci de saisir un montant valide.");
      return;
    }

    const montantHt = montantTtc / (1 + tvaRate / 100);

    setIsSaving(true);

    try {
      const { error } = await supabase.from("contrat_paiements").insert({
        contrat_id: contratId,
        montant_ttc: montantTtc,
        montant_ht: montantHt,
        date_paiement: date || new Date().toISOString().slice(0, 10),
        mode_paiement: mode || null,
        note: note || null,
        commentaire: commentaire || null,
      });

      if (error) {
        console.error(error);
        toast.error("Erreur lors de l’ajout du paiement");
        return;
      }

      toast.success("Paiement ajouté");
      resetForm();
      onPaymentAdded();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de l’ajout du paiement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actions</DialogTitle>
          <DialogDescription>
            Ajouter un paiement pour ce contrat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Date de paiement
            </label>
            <Input
              type="date"
              className="h-8"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Montant (TTC)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                className="h-8"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0,00"
              />
              <span className="text-xs text-muted-foreground">{devise}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Mode de paiement
            </label>
            <Input
              className="h-8"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              placeholder="Virement, CB, chèque…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Note interne
            </label>
            <Input
              className="h-8"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : acompte, facture n°X…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Commentaire
            </label>
            <Input
              className="h-8"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Champ libre…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleClose(false)}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Enregistrement…" : "Ajouter le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                          LIGNE DE TABLE PAR CONTRAT                        */
/* -------------------------------------------------------------------------- */

type RowProps = {
  row: ContratFacturationRow;
  devise: string;
  onPaymentAdded: () => void;
  onOpenEditDoc: (docType: DocType, contrat: ContratFacturationContrat) => void;
};

function ContratFacturationTableRow({
  row,
  devise,
  onPaymentAdded,
  onOpenEditDoc,
}: RowProps) {
  const { contrat, snapshot } = row;
  const {
    engagementTotalHt,
    engagementTotalTtc,
    paidHt,
    paidTtc,
    resteDuHt,
    resteDuTtc,
  } = snapshot;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [facturesOpen, setFacturesOpen] = useState(false);

  const [hasFactures, setHasFactures] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkFactures = async () => {
      try {
        const files = await listFacturesForContrat(contrat.id);
        if (isMounted) {
          setHasFactures(files.length > 0);
        }
      } catch (e) {
        console.error(e);
      }
    };

    void checkFactures();

    return () => {
      isMounted = false;
    };
  }, [contrat.id]);

  const paiements = contrat.contrat_paiements || [];
  const tvaRate = Number(contrat.tva_rate ?? 20);

  return (
    <>
      <TableRow className="align-middle">
        <TableCell className="space-y-1">
          <div className="font-medium">{contrat.titre}</div>
          <div className="text-xs text-muted-foreground">
            {paiements.length} paiement(s)
          </div>
        </TableCell>

        <TableCell className="align-middle">
          <ContratStatusBadge statut={contrat.statut} />
        </TableCell>

        <TableCell className="align-middle text-right">
          <div>
            {formatMontant(engagementTotalTtc, devise)}{" "}
            <span className="text-xs text-muted-foreground">TTC</span>
          </div>
          {engagementTotalHt > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatMontant(engagementTotalHt, devise)} HT
            </div>
          )}
        </TableCell>

        <TableCell className="align-middle text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="text-right">
              <div>
                {formatMontant(paidTtc, devise)}{" "}
                <span className="text-xs text-muted-foreground">TTC</span>
              </div>
              {paidHt > 0 && (
                <div className="text-xs text-muted-foreground">
                  {formatMontant(paidHt, devise)} HT
                </div>
              )}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setDetailsOpen(true)}
              title="Voir le détail des paiements"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>

        <TableCell className="align-middle text-right">
          <div>
            {formatMontant(resteDuTtc, devise)}{" "}
            <span className="text-xs text-muted-foreground">TTC</span>
          </div>
          {Math.abs(resteDuHt) > 0.01 && (
            <div className="text-xs text-muted-foreground">
              {formatMontant(resteDuHt, devise)} HT
            </div>
          )}
        </TableCell>

        {/* Devis */}
        <TableCell className="align-middle">
          <DocCell
            hasFile={!!contrat.devis_pdf_path}
            path={contrat.devis_pdf_path ?? getDevisStoragePath(contrat.id)}
            label="Devis"
            defaultFileName={`devis-${getProjectBaseName(contrat.titre)}.pdf`}
            onOpenEdit={() => onOpenEditDoc("devis", contrat)}
          />
        </TableCell>

        {/* Devis signé */}
        <TableCell className="align-middle">
          <DocCell
            hasFile={!!contrat.devis_signe_pdf_path}
            path={
              contrat.devis_signe_pdf_path ??
              getDevisSigneStoragePath(contrat.id)
            }
            label="Devis signé"
            defaultFileName={`devis-signe-${getProjectBaseName(
              contrat.titre
            )}.pdf`}
            onOpenEdit={() => onOpenEditDoc("devis_signe", contrat)}
          />
        </TableCell>

        {/* Factures */}
        <TableCell className="align-middle">
          {hasFactures ? (
            <div className="flex items-center justify-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Voir / gérer les factures"
                onClick={() => setFacturesOpen(true)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Télécharger toutes les factures (ZIP)"
                onClick={() => downloadFacturesZipForContrat(contrat)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Ajouter / modifier les factures"
                onClick={() => setFacturesOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Ajouter une facture"
                onClick={() => setFacturesOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TableCell>

        <TableCell className="align-middle text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="shadow-none h-8 w-8"
                  aria-label="Actions sur le contrat"
                >
                  <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAddPaymentOpen(true)}>
                Ajouter un paiement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <ContratDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        row={row}
        devise={devise}
        // 🔹 utilise le callback existant (refetch parent)
        onPaymentChanged={onPaymentAdded}
        // 🔹 ouvre le dialog d’ajout de paiement existant
        onAddPaiementClick={() => setAddPaymentOpen(true)}
      />

      <AddPaiementDialog
        open={addPaymentOpen}
        onOpenChange={setAddPaymentOpen}
        contratId={contrat.id}
        devise={devise}
        tvaRate={tvaRate}
        onPaymentAdded={onPaymentAdded}
      />

      <FacturesDialog
        open={facturesOpen}
        onOpenChange={setFacturesOpen}
        contrat={contrat}
        onFilesCountChange={(count) => setHasFactures(count > 0)}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                            SUMMARY CARD (réutilisé)                         */
/* -------------------------------------------------------------------------- */

type SummaryCardProps = {
  label: string;
  ttc: number;
  ht: number;
  devise: string;
  highlight?: boolean;
};

function SummaryCard({ label, ttc, ht, devise, highlight }: SummaryCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${
        highlight ? "bg-amber-50 dark:bg-amber-950/20" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">
        {formatMontant(ttc, devise)}{" "}
        <span className="text-xs text-muted-foreground">TTC</span>
      </p>
      {ht > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatMontant(ht, devise)} HT
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                      TABLE PRINCIPALE EXPORTÉE + FILTRES (shadcn)          */
/* -------------------------------------------------------------------------- */

export function ClientFacturationContratsTable({
    contrats,
    devise,
    onPaymentAdded,
    showStatusFilter = true, // 👈 par défaut : on affiche le select
  }: ClientFacturationContratsTableProps) {
    const [editDocState, setEditDocState] = useState<EditDocState>(null);
  
    // Filtres
    const [search, setSearch] = useState("");
    const [onlyWithBalance, setOnlyWithBalance] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"all" | "signe" | "brouillon">(
      "all"
    );
  
    const handleOpenEditDoc = (
      docType: DocType,
      contrat: ContratFacturationContrat
    ) => {
      setEditDocState({ docType, contrat });
    };
  
    const handleCloseEditDoc = () => {
      setEditDocState(null);
    };
  
    const handleResetFilters = () => {
      setSearch("");
      setOnlyWithBalance(false);
      setStatusFilter("all");
    };
  
    // 🧮 Application des filtres
    const rows = useMemo(
      () =>
        contrats.filter(({ contrat, snapshot }) => {
          // Filtre texte sur le titre
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            const inTitle = contrat.titre?.toLowerCase().includes(q);
            if (!inTitle) return false;
          }
  
          // Filtre statut UNIQUEMENT si le select est visible
          if (
            showStatusFilter &&
            statusFilter !== "all" &&
            contrat.statut !== statusFilter
          ) {
            return false;
          }
  
          // Filtre "reste dû > 0"
          if (onlyWithBalance && Math.abs(snapshot.resteDuTtc) < 0.01) {
            return false;
          }
  
          return true;
        }),
      [contrats, search, statusFilter, onlyWithBalance, showStatusFilter]
    );
  
    return (
      <div className="overflow-x-auto rounded-md border bg-card">
        {/* 🔹 Barre de filtres (shadcn ui) */}
        <div className="border-b bg-muted/40 px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Recherche texte */}
              <Input
                placeholder="Rechercher un contrat..."
                className="h-8 max-w-xs text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
  
              {/* Select statut – rendu seulement si showStatusFilter === true */}
              {showStatusFilter && (
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as "all" | "signe" | "brouillon")
                  }
                >
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="signe">Signé</SelectItem>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                  </SelectContent>
                </Select>
              )}
  
              {/* Switch "Reste dû > 0" */}
              <div className="flex items-center gap-2">
                <Switch
                  id="reste-du-filter"
                  checked={onlyWithBalance}
                  onCheckedChange={setOnlyWithBalance}
                />
                <label
                  htmlFor="reste-du-filter"
                  className="text-xs text-muted-foreground select-none"
                >
                  Reste dû &gt; 0
                </label>
              </div>
            </div>
  
            {/* Bouton reset */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleResetFilters}
            >
              Réinitialiser
            </Button>
          </div>
        </div>
  
        {/* Tableau */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrat</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Engagement contrat</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste dû à date</TableHead>
              <TableHead className="text-center">Devis</TableHead>
              <TableHead className="text-center">Devis signé</TableHead>
              <TableHead className="text-center">Factures</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ContratFacturationTableRow
                key={row.contrat.id}
                row={row}
                devise={devise}
                onPaymentAdded={onPaymentAdded}
                onOpenEditDoc={handleOpenEditDoc}
              />
            ))}
          </TableBody>
        </Table>
  
        {/* Dialog Devis / Devis signé */}
        <EditDocDialog
          state={editDocState}
          onClose={handleCloseEditDoc}
          onAfterChange={onPaymentAdded}
        />
      </div>
    );
  }