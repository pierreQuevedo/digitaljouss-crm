// // components/ui/upload/single-pdf-upload.tsx
// "use client";

// import { useEffect, useRef } from "react";
// import {
//   AlertCircleIcon,
//   PaperclipIcon,
//   UploadIcon,
//   XIcon,
// } from "lucide-react";

// import { formatBytes, useFileUpload } from "@/hooks/use-file-upload";
// import { Button } from "@/components/ui/button";

// type SinglePdfUploadProps = {
//   label?: string;
//   maxSize?: number;
//   /**
//    * Appelé quand le fichier change (File ou null)
//    */
//   onFileChange?: (file: File | null) => void;
//   /**
//    * Fichier déjà présent (ex: depuis Supabase) – juste pour afficher le nom
//    */
//   initialFileName?: string | null;
// };

// export function SinglePdfUpload({
//   label = "Upload file",
//   maxSize = 10 * 1024 * 1024, // 10 MB
//   onFileChange,
//   initialFileName,
// }: SinglePdfUploadProps) {
//   // ⚠️ pas d’initialFiles par défaut, on part à vide
//   const [
//     { files, isDragging, errors },
//     {
//       handleDragEnter,
//       handleDragLeave,
//       handleDragOver,
//       handleDrop,
//       openFileDialog,
//       removeFile,
//       getInputProps,
//     },
//   ] = useFileUpload({
//     initialFiles: [],
//     maxSize,
//     // si ton hook supporte "accept", tu peux filtrer ici :
//     // accept: ["application/pdf"],
//   });

//   const fileMeta = files[0];

//   // 🔥 on mémorise le dernier File notifié pour éviter les boucles infinies
//   const lastNotifiedRef = useRef<File | null>(null);

//   useEffect(() => {
//     if (!onFileChange) return;

//     let current: File | null = null;

//     if (fileMeta && fileMeta.file instanceof File) {
//       current = fileMeta.file;
//     }

//     // On ne notifie que si ça change vraiment
//     if (current === lastNotifiedRef.current) return;

//     lastNotifiedRef.current = current;
//     onFileChange(current);
//   }, [fileMeta, onFileChange]);

//   return (
//     <div className="flex flex-col gap-2">
//       {/* Drop area */}
//       <div
//         className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-input border-dashed p-4 transition-colors hover:bg-accent/50 has-disabled:pointer-events-none has-[input:focus]:border-ring has-disabled:opacity-50 has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
//         data-dragging={isDragging || undefined}
//         onClick={openFileDialog}
//         onDragEnter={handleDragEnter}
//         onDragLeave={handleDragLeave}
//         onDragOver={handleDragOver}
//         onDrop={handleDrop}
//         role="button"
//         tabIndex={-1}
//       >
//         <input
//           {...getInputProps()}
//           aria-label={label}
//           className="sr-only"
//           disabled={Boolean(fileMeta)}
//         />

//         <div className="flex flex-col items-center justify-center text-center">
//           <div
//             aria-hidden="true"
//             className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
//           >
//             <UploadIcon className="size-4 opacity-60" />
//           </div>
//           <p className="mb-1.5 font-medium text-sm">{label}</p>
//           <p className="text-muted-foreground text-xs">
//             Drag & drop ou clique pour choisir un PDF (max.{" "}
//             {formatBytes(maxSize)})
//           </p>
//         </div>
//       </div>

//       {errors.length > 0 && (
//         <div
//           className="flex items-center gap-1 text-destructive text-xs"
//           role="alert"
//         >
//           <AlertCircleIcon className="size-3 shrink-0" />
//           <span>{errors[0]}</span>
//         </div>
//       )}

//       {/* File list */}
//       {fileMeta && fileMeta.file instanceof File && (
//         <div className="space-y-2">
//           <div className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2">
//             <div className="flex items-center gap-3 overflow-hidden">
//               <PaperclipIcon
//                 aria-hidden="true"
//                 className="size-4 shrink-0 opacity-60"
//               />
//               <div className="min-w-0">
//                 <p className="truncate font-medium text-[13px]">
//                   {fileMeta.file.name}
//                 </p>
//               </div>
//             </div>

//             <Button
//               aria-label="Retirer le fichier"
//               className="-me-2 size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
//               onClick={() => removeFile(fileMeta.id)}
//               size="icon"
//               variant="ghost"
//             >
//               <XIcon aria-hidden="true" className="size-4" />
//             </Button>
//           </div>
//         </div>
//       )}

//       {!fileMeta && initialFileName && (
//         <div className="space-y-2">
//           <div className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2">
//             <div className="flex items-center gap-3 overflow-hidden">
//               <PaperclipIcon
//                 aria-hidden="true"
//                 className="size-4 shrink-0 opacity-60"
//               />
//               <div className="min-w-0">
//                 <p className="truncate font-medium text-[13px]">
//                   {initialFileName}
//                 </p>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }