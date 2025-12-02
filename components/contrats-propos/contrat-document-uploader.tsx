// components/contrats/contrat-document-uploader.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

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

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés.");
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
        toast.error("Document uploadé mais erreur lors de la mise à jour du contrat");
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

  const handleOpen = async () => {
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

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2">
        <Button variant="outline" type="button" disabled={isUploading}>
          {isUploading ? "Upload…" : currentPath ? "Remplacer" : LABELS[docType]}
        </Button>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>

      {currentPath && (
        <Button
          variant="link"
          type="button"
          className="px-0 text-xs"
          onClick={handleOpen}
        >
          Ouvrir
        </Button>
      )}
    </div>
  );
}