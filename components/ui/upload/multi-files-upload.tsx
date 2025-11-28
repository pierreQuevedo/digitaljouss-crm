// components/ui/upload/multi-files-upload.tsx
"use client";

import { useEffect } from "react";
import {
  AlertCircleIcon,
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileUpIcon,
  HeadphonesIcon,
  ImageIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { formatBytes, useFileUpload } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";

type MultiFilesUploadProps = {
  label?: string;
  maxSize?: number;
  maxFiles?: number;
  onFilesChange?: (files: File[]) => void;
};

/**
 * Représente le type réel contenu dans FileMetadata.file
 * (soit un vrai File, soit un objet "métadonnées" avec name/size/type)
 */
type UploadFile = File | { name: string; size: number; type: string };

type FileMetaLike = {
  file: UploadFile;
};

const getFileIcon = (meta: FileMetaLike) => {
  const fileObj = meta.file;
  const fileType = fileObj.type;
  const fileName = fileObj.name;

  if (
    fileType.includes("pdf") ||
    fileName.endsWith(".pdf") ||
    fileType.includes("word") ||
    fileName.endsWith(".doc") ||
    fileName.endsWith(".docx")
  ) {
    return <FileTextIcon className="size-4 opacity-60" />;
  }
  if (
    fileType.includes("zip") ||
    fileType.includes("archive") ||
    fileName.endsWith(".zip") ||
    fileName.endsWith(".rar")
  ) {
    return <FileArchiveIcon className="size-4 opacity-60" />;
  }
  if (
    fileType.includes("excel") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx")
  ) {
    return <FileSpreadsheetIcon className="size-4 opacity-60" />;
  }
  if (fileType.includes("video/")) {
    return <VideoIcon className="size-4 opacity-60" />;
  }
  if (fileType.includes("audio/")) {
    return <HeadphonesIcon className="size-4 opacity-60" />;
  }
  if (fileType.startsWith("image/")) {
    return <ImageIcon className="size-4 opacity-60" />;
  }
  return <FileIcon className="size-4 opacity-60" />;
};

export function MultiFilesUpload({
  label = "Upload files",
  maxSize = 100 * 1024 * 1024,
  maxFiles = 10,
  onFilesChange,
}: MultiFilesUploadProps) {
  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    initialFiles: [],
    maxFiles,
    maxSize,
    multiple: true,
  });

  // 🔁 on remonte un tableau de File (pas FileMetadata) au parent
  useEffect(() => {
    if (!onFilesChange) return;
    const onlyFiles = files
      .map((f) => f.file)
      .filter((f): f is File => f instanceof File);
    onFilesChange(onlyFiles);
  }, [files, onFilesChange]);

  return (
    <div className="flex flex-col gap-2">
      {/* Drop area */}
      <div
        className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-input border-dashed p-4 transition-colors hover:bg-accent/50 has-disabled:pointer-events-none has-[input:focus]:border-ring has-disabled:opacity-50 has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
        data-dragging={isDragging || undefined}
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={-1}
      >
        <input
          {...getInputProps()}
          aria-label={label}
          className="sr-only"
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div
            aria-hidden="true"
            className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
          >
            <FileUpIcon className="size-4 opacity-60" />
          </div>
          <p className="mb-1.5 font-medium text-sm">{label}</p>
          <p className="mb-2 text-muted-foreground text-xs">
            Drag & drop or click to browse
          </p>
          <div className="flex flex-wrap justify-center gap-1 text-muted-foreground/70 text-xs">
            <span>All files</span>
            <span>∙</span>
            <span>Max {maxFiles} files</span>
            <span>∙</span>
            <span>Up to {formatBytes(maxSize)}</span>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          className="flex items-center gap-1 text-destructive text-xs"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((meta) => {
            const fileObj = meta.file as UploadFile;
            const fileName = fileObj.name;
            const fileSize = fileObj.size;

            return (
              <div
                className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2 pe-3"
                key={meta.id}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex aspect-square size-10 shrink-0 items-center justify-center rounded border">
                    {getFileIcon({ file: fileObj })}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate font-medium text-[13px]">
                      {fileName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatBytes(fileSize)}
                    </p>
                  </div>
                </div>

                <Button
                  aria-label="Remove file"
                  className="-me-2 size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
                  onClick={() => removeFile(meta.id)}
                  size="icon"
                  variant="ghost"
                >
                  <XIcon aria-hidden="true" className="size-4" />
                </Button>
              </div>
            );
          })}

          {/* Remove all files button */}
          {files.length > 1 && (
            <div>
              <Button onClick={clearFiles} size="sm" variant="outline">
                Remove all files
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}