"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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

  const triggerFileDialog = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
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
          "Document uploadé mais erreur lors de la mise à jour du contrat"
        );
        return;
      }

      setCurrentPath(path);
      toast.success(`${LABELS[docType]} mis à jour`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de l’upload");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
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
    a.download = ""; // laisse le navigateur gérer le nom
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex items-center gap-1">
      {/* input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

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
          {/* Bouton + pour ajouter */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={triggerFileDialog}
            disabled={isUploading}
            title={`Ajouter ${LABELS[docType]}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}