"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const supabase = createClient();

type DocType = "devis" | "devis_signe" | "facture";

type Props = {
  contratId: string;
  docType: DocType;
  existingPath: string | null;
};

const LABELS: Record<DocType, string> = {
  devis: "Devis",
  devis_signe: "Devis signé",
  facture: "Facture",
};

export function ContratDocumentUploader({
  contratId,
  docType,
  existingPath,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(existingPath);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isFacture = docType === "facture";

  const triggerFileDialog = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;

    // On vérifie les types (PDF only)
    const fileArray = Array.from(files);
    if (fileArray.some((f) => f.type !== "application/pdf")) {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    setIsUploading(true);

    try {
      // Pour devis / devis signé : un seul fichier
      if (!isFacture) {
        const file = fileArray[0];

        const extension = ".pdf";
        const path = `contrats/${contratId}/${docType}${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("contrat-docs")
          .upload(path, file, {
            upsert: true,
          });

        if (uploadError) {
          console.error(uploadError);
          toast.error("Erreur lors de l’upload du document");
          return;
        }

        const columnName =
          docType === "devis"
            ? "devis_pdf_path"
            : docType === "devis_signe"
            ? "devis_signe_pdf_path"
            : "facture_pdf_path";

        const { error: updateError } = await supabase
          .from("contrats")
          .update({ [columnName]: path })
          .eq("id", contratId);

        if (updateError) {
          console.error(updateError);
          toast.error(
            "Document uploadé mais erreur lors de la mise à jour du contrat",
          );
          return;
        }

        setCurrentPath(path);
        toast.success(`${LABELS[docType]} mis à jour`);
      } else {
        // Factures : on accepte plusieurs fichiers
        // NOTE: ici on garde uniquement le dernier dans facture_pdf_path,
        // les autres restent disponibles dans le bucket.
        let lastPath: string | null = null;

        for (const [index, file] of fileArray.entries()) {
          const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const path = `contrats/${contratId}/factures/${Date.now()}_${index}_${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("contrat-docs")
            .upload(path, file, {
              upsert: true,
            });

          if (uploadError) {
            console.error(uploadError);
            toast.error(
              "Erreur lors de l’upload d’une des factures. Les précédentes ont peut-être été importées.",
            );
            return;
          }

          lastPath = path;
        }

        if (lastPath) {
          const { error: updateError } = await supabase
            .from("contrats")
            .update({ facture_pdf_path: lastPath })
            .eq("id", contratId);

          if (updateError) {
            console.error(updateError);
            toast.error(
              "Factures uploadées mais erreur lors de la mise à jour du contrat",
            );
            return;
          }

          setCurrentPath(lastPath);
          toast.success(
            fileArray.length > 1
              ? `${fileArray.length} factures uploadées`
              : "Facture uploadée",
          );
        }
      }

      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de l’upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files) return;
    await handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isUploading) return;
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    await handleFiles(files);
  };

  const handlePreview = async () => {
    if (!currentPath) return;

    const { data, error } = await supabase.storage
      .from("contrat-docs")
      .createSignedUrl(currentPath, 60 * 5); // 5 minutes

    if (error || !data?.signedUrl) {
      console.error(error);
      toast.error("Impossible de générer le lien du document");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const handleDownload = async () => {
    if (!currentPath) return;

    const { data, error } = await supabase.storage
      .from("contrat-docs")
      .createSignedUrl(currentPath, 60 * 5);

    if (error || !data?.signedUrl) {
      console.error(error);
      toast.error("Impossible de générer le lien de téléchargement");
      return;
    }

    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      {/* input file caché (single ou multi) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple={isFacture}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-1">
        {currentPath ? (
          <>
            {/* Preview */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handlePreview}
              title={`Prévisualiser ${LABELS[docType]}`}
            >
              <Eye className="h-4 w-4" />
            </Button>

            {/* Download */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleDownload}
              title={`Télécharger ${LABELS[docType]}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {/* Bouton + pour ouvrir le dialog d’upload */}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              disabled={isUploading}
              title={`Ajouter ${LABELS[docType]}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Dialog avec "dropzone" */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isUploading) setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">
              Importer {LABELS[docType]}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isFacture
                ? "Glisse-dépose une ou plusieurs factures PDF, ou clique pour les choisir."
                : "Glisse-dépose le PDF, ou clique pour le choisir."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="mt-2 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground"
            onClick={triggerFileDialog}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={handleDrop}
          >
            <div>
              <p className="font-medium">
                {isFacture
                  ? "Dépose ici tes factures PDF"
                  : "Dépose ici ton PDF"}
              </p>
              <p className="mt-1 text-[11px]">
                Seuls les fichiers PDF sont acceptés.
                {isFacture && " Tu peux en sélectionner plusieurs."}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isUploading}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}