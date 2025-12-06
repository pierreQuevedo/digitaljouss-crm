"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { Loader2, Eye, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const supabase = createClient();

type DocType = "devis" | "devis_signe" | "facture";

type Props = {
  contratId: string;
  docType: DocType;
  existingPath: string | null;
  /**
   * zipBaseName est gardé pour compatibilité mais plus utilisé ici.
   */
  zipBaseName?: string;
};

const LABELS: Record<DocType, string> = {
  devis: "Devis",
  devis_signe: "Devis signé",
  facture: "Facture",
};

type ListedFile = {
  name: string;
  path: string;
};

export function ContratDocumentUploader({
  contratId,
  docType,
  existingPath,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isFacture = docType === "facture";

  // Chemin actuel pour les singles (devis / devis signé)
  const [currentSinglePath, setCurrentSinglePath] = useState<string | null>(
    !isFacture ? existingPath : null
  );

  // Nom du fichier actuel pour les singles
  const singleFileName =
    !isFacture && currentSinglePath
      ? currentSinglePath.split("/").pop() ?? currentSinglePath
      : null;

  const hasExisting = !!singleFileName;

  const [listedFactures, setListedFactures] = useState<ListedFile[]>([]);
  const [facturesLoading, setFacturesLoading] = useState(false);

  /* ---------------------------------------------------------------------- */
  /*                    Helpers preview / delete génériques                 */
  /* ---------------------------------------------------------------------- */

  const handlePreview = async (path: string) => {
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

  const handleDeleteSingle = async () => {
    if (!currentSinglePath) return;

    setIsUploading(true);
    try {
      const columnName =
        docType === "devis" ? "devis_pdf_path" : "devis_signe_pdf_path";

      // Suppr du fichier dans le storage
      const { error: removeError } = await supabase.storage
        .from("documents-contrats")
        .remove([currentSinglePath]);

      if (removeError) {
        console.error(removeError);
        toast.error("Erreur lors de la suppression du fichier");
        return;
      }

      // Mise à jour du contrat
      const { error: updateError } = await supabase
        .from("contrats")
        .update({ [columnName]: null })
        .eq("id", contratId);

      if (updateError) {
        console.error(updateError);
        toast.error(
          "Fichier supprimé du stockage, mais erreur lors de la mise à jour du contrat"
        );
        return;
      }

      setCurrentSinglePath(null);
      toast.success(`${LABELS[docType]} supprimé`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de la suppression");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFacture = async (path: string) => {
    setIsUploading(true);
    try {
      // Supprimer ce fichier
      const { error: removeError } = await supabase.storage
        .from("documents-contrats")
        .remove([path]);

      if (removeError) {
        console.error(removeError);
        toast.error("Erreur lors de la suppression de la facture");
        return;
      }

      // Re-lister les factures pour MAJ UI
      await listFactures();

      // Mettre à jour la colonne facture_pdf_path (dernier fichier ou null)
      const prefix = `contrats/${contratId}/factures`;
      const { data: list, error: listError } = await supabase.storage
        .from("documents-contrats")
        .list(prefix, { limit: 100 });

      if (listError) {
        console.error(listError);
        // On ne bloque pas, la facture est déjà supprimée
      } else {
        let newPath: string | null = null;
        if (list && list.length > 0) {
          const last = list[list.length - 1];
          newPath = `${prefix}/${last.name}`;
        }

        const { error: updateError } = await supabase
          .from("contrats")
          .update({ facture_pdf_path: newPath })
          .eq("id", contratId);

        if (updateError) {
          console.error(updateError);
          toast.error(
            "Facture supprimée, mais erreur lors de la mise à jour du contrat"
          );
          return;
        }
      }

      toast.success("Facture supprimée");
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de la suppression");
    } finally {
      setIsUploading(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                         Listing des factures                           */
  /* ---------------------------------------------------------------------- */

  const listFactures = useCallback(async () => {
    if (!isFacture) return;

    setFacturesLoading(true);
    try {
      const prefix = `contrats/${contratId}/factures`;

      const { data, error } = await supabase.storage
        .from("documents-contrats")
        .list(prefix, { limit: 100 });

      if (error) {
        console.error(error);
        toast.error("Impossible de lister les factures");
        return;
      }

      const files: ListedFile[] =
        data?.map((f) => ({
          name: f.name,
          path: `${prefix}/${f.name}`,
        })) ?? [];

      setListedFactures(files);
    } finally {
      setFacturesLoading(false);
    }
  }, [contratId, isFacture]);

  useEffect(() => {
    if (isFacture) {
      void listFactures();
    }
  }, [isFacture, listFactures]);

  /* ---------------------------------------------------------------------- */
  /*                               Upload                                   */
  /* ---------------------------------------------------------------------- */

  const triggerFileDialog = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;

    const fileArray = Array.from(files);

    // PDF only
    if (fileArray.some((f) => f.type !== "application/pdf")) {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    setIsUploading(true);

    try {
      if (!isFacture) {
        // ---------- DEVIS / DEVIS SIGNÉ : 1 seul fichier ----------
        const file = fileArray[0];

        const extension = ".pdf";
        const path = `contrats/${contratId}/${docType}${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("documents-contrats")
          .upload(path, file, {
            upsert: true,
          });

        if (uploadError) {
          console.error(uploadError);
          toast.error("Erreur lors de l’upload du document");
          return;
        }

        const columnName =
          docType === "devis" ? "devis_pdf_path" : "devis_signe_pdf_path";

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

        setCurrentSinglePath(path);

        toast.success(
          hasExisting
            ? `${LABELS[docType]} mis à jour`
            : `${LABELS[docType]} ajouté`
        );
      } else {
        // ---------- FACTURES : multi fichiers ----------
        let lastPath: string | null = null;

        for (const [index, file] of fileArray.entries()) {
          const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const path = `contrats/${contratId}/factures/${Date.now()}_${index}_${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("documents-contrats")
            .upload(path, file, {
              upsert: true,
            });

          if (uploadError) {
            console.error(uploadError);
            toast.error(
              "Erreur lors de l’upload d’une des factures. Les précédentes ont peut-être été importées."
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
              "Factures uploadées mais erreur lors de la mise à jour du contrat"
            );
            return;
          }

          toast.success(
            fileArray.length > 1
              ? `${fileArray.length} factures uploadées`
              : "Facture uploadée"
          );

          // refresh de la liste en dessous
          await listFactures();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur inattendue lors de l’upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  /* ---------------------------------------------------------------------- */
  /*                                Render                                  */
  /* ---------------------------------------------------------------------- */

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

      {/* Dropzone inline (clic + drag & drop) */}
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground",
          isUploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        )}
        onClick={isUploading ? undefined : triggerFileDialog}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            "flex flex-col items-center gap-2",
            isUploading && "animate-pulse"
          )}
        >
          <p className="font-medium">
            {isFacture
              ? listedFactures.length > 0
                ? "Ajouter de nouvelles factures PDF"
                : "Ajouter des factures PDF"
              : hasExisting
              ? "Remplacer le fichier PDF"
              : "Importer un fichier PDF"}
          </p>
          <p className="mt-1 text-[11px]">
            Dépose ton fichier PDF ici, ou clique pour le choisir.
            {isFacture && " Tu peux en sélectionner plusieurs."}
          </p>

          {isUploading && <Loader2 className="mt-1 h-4 w-4 animate-spin" />}
        </div>
      </div>

      {/* Fichier single (devis / devis signé) */}
      {!isFacture && singleFileName && currentSinglePath && (
        <div className="mt-3 w-full text-left">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Fichier actuellement importé
          </p>
          <div className="flex items-center justify-between rounded border bg-background px-2 py-1 text-[11px]">
            <span className="mr-2 flex-1 truncate font-mono max-w-[220px]">
              {singleFileName}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePreview(currentSinglePath)}
                className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]"
              >
                <Eye className="h-3 w-3" />
                <span>Ouvrir</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteSingle}
                className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[11px]"
                title="Supprimer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des factures existantes sous la dropzone */}
      {isFacture && (
        <div className="mt-3 w-full text-left">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Factures déjà importées
          </p>

          {facturesLoading ? (
            <p className="text-[11px] text-muted-foreground">
              Chargement des factures...
            </p>
          ) : listedFactures.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Aucune facture pour le moment.
            </p>
          ) : (
            <ul className="space-y-1">
              {listedFactures.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center justify-between rounded border bg-background px-2 py-1 text-[11px]"
                >
                  <span className="mr-2 flex-1 truncate font-mono max-w-[220px]">
                    {f.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePreview(f.path)}
                      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Ouvrir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFacture(f.path)}
                      className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[11px]"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}