// // components/contrats-conception-web/contrat-conception-web-edit-dialog.tsx
// "use client";

// import { useEffect, useState } from "react";
// import { createClient } from "@/lib/supabase/client";
// import { toast } from "sonner";

// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";

// import type { ContratRow } from "./contrats-conception-web-table";
// import { SinglePdfUpload } from "@/components/ui/upload/single-pdf-upload";
// import { cn } from "@/lib/utils";

// const supabase = createClient(); // 👈 instance stable (évite les loops)

// type StatutContrat =
//   | "brouillon"
//   | "en_attente_signature"
//   | "signe"
//   | "en_cours"
//   | "termine"
//   | "annule";

// const STATUT_LABEL: Record<StatutContrat, string> = {
//   brouillon: "Brouillon",
//   en_attente_signature: "En attente signature",
//   signe: "Signé",
//   en_cours: "En cours",
//   termine: "Terminé",
//   annule: "Annulé",
// };

// const STORAGE_BUCKET = "contrats";

// type FullContratFromDb = ContratRow & {
//   tva_rate?: number | null;
//   montant_ttc?: number | null;
//   devis_pdf_path?: string | null;
//   devis_signe_pdf_path?: string | null;
//   facture_pdf_path?: string | null;
// };

// type Service = {
//   id: string;
//   label: string;
// };

// type Props = {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   contrat: ContratRow;
//   onUpdated?: () => void;
// };

// type UploadKind = "devis" | "devis_signe" | "facture";

// // --------- Helpers ---------

// function getPublicUrlFromStorage(path: string | null | undefined) {
//   if (!path) return null;
//   const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
//   return data.publicUrl ?? null;
// }

// function getFileNameFromPath(path: string | null | undefined): string | null {
//   if (!path) return null;
//   const parts = path.split("/");
//   return parts[parts.length - 1] || path;
// }

// export function ContratConceptionWebEditDialog({
//   open,
//   onOpenChange,
//   contrat,
//   onUpdated,
// }: Props) {
//   const [loading, setLoading] = useState(false);
//   const [initialLoading, setInitialLoading] = useState(false);

//   const [fullContrat, setFullContrat] = useState<FullContratFromDb | null>(
//     null,
//   );

//   // formulaire
//   const [titre, setTitre] = useState("");
//   const [statut, setStatut] = useState<StatutContrat>(contrat.statut);
//   const [montantHt, setMontantHt] = useState("");
//   const [tvaRate, setTvaRate] = useState<number>(20);
//   const [devise, setDevise] = useState("EUR");

//   // services
//   const [availableServices, setAvailableServices] = useState<Service[]>([]);
//   const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

//   // fichiers (non uploadés tant qu’on n’envoie pas)
//   const [devisUpload, setDevisUpload] = useState<File | null>(null);
//   const [devisSigneUpload, setDevisSigneUpload] = useState<File | null>(null);
//   const [factureUpload, setFactureUpload] = useState<File | null>(null);

//   // urls publiques pour les liens "Voir le fichier"
//   const [devisUrl, setDevisUrl] = useState<string | null>(null);
//   const [devisSigneUrl, setDevisSigneUrl] = useState<string | null>(null);
//   const [factureUrl, setFactureUrl] = useState<string | null>(null);

//   // --------- Chargement initial quand le dialog s’ouvre ---------

//   useEffect(() => {
//     if (!open) return;

//     const fetchFullContratAndServices = async () => {
//       setInitialLoading(true);

//       // 1) Charger le contrat complet
//       const { data, error } = await supabase
//         .from("contrats_conception_web")
//         .select("*")
//         .eq("id", contrat.id)
//         .single<FullContratFromDb>();

//       if (error) {
//         console.error(error);
//         toast.error("Erreur lors du chargement du contrat", {
//           description: error.message,
//         });
//         setInitialLoading(false);
//         return;
//       }

//       setFullContrat(data);

//       setTitre(data.titre ?? "");
//       setStatut(data.statut);
//       setMontantHt(
//         data.montant_ht != null ? String(data.montant_ht) : "",
//       );
//       setTvaRate(typeof data.tva_rate === "number" ? data.tva_rate : 20);
//       setDevise(data.devise ?? "EUR");

//       // ✅ on n’envoie plus supabase dans le helper
//       setDevisUrl(getPublicUrlFromStorage(data.devis_pdf_path));
//       setDevisSigneUrl(getPublicUrlFromStorage(data.devis_signe_pdf_path));
//       setFactureUrl(getPublicUrlFromStorage(data.facture_pdf_path));

//       // reset des fichiers sélectionnés
//       setDevisUpload(null);
//       setDevisSigneUpload(null);
//       setFactureUpload(null);

//       // 2) Charger la liste des services (sans filtre par catégorie pour l’instant)
//       const { data: servicesData, error: servicesError } = await supabase
//         .from("services")
//         .select("id, label")
//         .order("label", { ascending: true });

//       if (servicesError) {
//         console.error(servicesError);
//         toast.error("Erreur lors du chargement des services", {
//           description: servicesError.message,
//         });
//       } else {
//         setAvailableServices(
//           (servicesData ?? []).map((s) => ({
//             id: s.id as string,
//             label: (s as { label?: string }).label ?? "Service sans nom",
//           })),
//         );
//       }

//       // 3) Charger les services déjà liés au contrat
//       const { data: contratServices, error: contratServicesError } =
//         await supabase
//           .from("contrats_conception_web_services")
//           .select("service_id")
//           .eq("contrat_id", contrat.id);

//       if (contratServicesError) {
//         console.error(contratServicesError);
//         toast.error("Erreur lors du chargement des services du contrat", {
//           description: contratServicesError.message,
//         });
//       } else {
//         setSelectedServiceIds(
//           (contratServices ?? []).map((row) => row.service_id as string),
//         );
//       }

//       setInitialLoading(false);
//     };

//     void fetchFullContratAndServices();
//   }, [open, contrat.id]);

//   // --------- Helpers montant ---------

//   const montantHtNumber =
//     montantHt.trim() === ""
//       ? null
//       : Number(montantHt.replace(",", "."));

//   const montantTtcNumber =
//     montantHtNumber == null
//       ? null
//       : montantHtNumber * (1 + (tvaRate || 0) / 100);

//   // --------- Toggle services ---------

//   const toggleService = (serviceId: string) => {
//     setSelectedServiceIds((prev) =>
//       prev.includes(serviceId)
//         ? prev.filter((id) => id !== serviceId)
//         : [...prev, serviceId],
//     );
//   };

//   // --------- Upload fichier unique ---------

//   const uploadIfNeeded = async (
//     file: File | null,
//     kind: UploadKind,
//     contratId: string,
//   ): Promise<string | null> => {
//     if (!file) return null;

//     if (file.type !== "application/pdf") {
//       toast.error("Format invalide", {
//         description: "Seuls les fichiers PDF sont acceptés.",
//       });
//       return null;
//     }

//     const ext = file.name.split(".").pop() || "pdf";
//     const filename =
//       kind === "devis"
//         ? `devis.${ext}`
//         : kind === "devis_signe"
//           ? `devis-signe.${ext}`
//           : `facture.${ext}`;

//     const path = `contrats_conception_web/${contratId}/${filename}`;

//     const { error: uploadError } = await supabase.storage
//       .from(STORAGE_BUCKET)
//       .upload(path, file, { upsert: true });

//     if (uploadError) {
//       console.error(uploadError);
//       toast.error("Erreur lors de l'upload du fichier", {
//         description: uploadError.message,
//       });
//       return null;
//     }

//     return path;
//   };

//   // --------- Submit ---------

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!fullContrat) return;

//     const titreTrimmed = titre.trim();
//     if (!titreTrimmed) {
//       toast.error("Titre requis", {
//         description: "Le contrat doit avoir un titre.",
//       });
//       return;
//     }

//     const montantNumber = montantHtNumber;

//     try {
//       setLoading(true);

//       // 1) upload des PDFs si besoin
//       const [newDevisPath, newDevisSignePath, newFacturePath] =
//         await Promise.all([
//           uploadIfNeeded(devisUpload, "devis", fullContrat.id),
//           uploadIfNeeded(devisSigneUpload, "devis_signe", fullContrat.id),
//           uploadIfNeeded(factureUpload, "facture", fullContrat.id),
//         ]);

//       // 2) build l’objet d’update
//       const updates: Partial<FullContratFromDb> = {
//         titre: titreTrimmed,
//         statut,
//         montant_ht: montantNumber,
//         tva_rate: tvaRate,
//         devise: devise.trim() || "EUR",
//       };

//       if (newDevisPath) {
//         updates.devis_pdf_path = newDevisPath;
//       }
//       if (newDevisSignePath) {
//         updates.devis_signe_pdf_path = newDevisSignePath;
//       }
//       if (newFacturePath) {
//         updates.facture_pdf_path = newFacturePath;
//       }

//       const { error } = await supabase
//         .from("contrats_conception_web")
//         .update(updates)
//         .eq("id", fullContrat.id);

//       if (error) {
//         console.error(error);
//         toast.error("Erreur lors de la mise à jour du contrat", {
//           description: error.message,
//         });
//         return;
//       }

//       // 3) MAJ des services liés
//       const { error: delError } = await supabase
//         .from("contrats_conception_web_services")
//         .delete()
//         .eq("contrat_id", fullContrat.id);

//       if (delError) {
//         console.error(delError);
//         toast.error("Erreur lors de la mise à jour des services", {
//           description: delError.message,
//         });
//       }

//       if (selectedServiceIds.length > 0) {
//         const rowsToInsert = selectedServiceIds.map((serviceId) => ({
//           contrat_id: fullContrat.id,
//           service_id: serviceId,
//         }));

//         const { error: insertError } = await supabase
//           .from("contrats_conception_web_services")
//           .insert(rowsToInsert);

//         if (insertError) {
//           console.error(insertError);
//           toast.error("Erreur lors de l’enregistrement des services", {
//             description: insertError.message,
//           });
//         }
//       }

//       toast.success("Contrat mis à jour", {
//         description: titreTrimmed,
//       });

//       onOpenChange(false);
//       onUpdated?.();
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --------- Rendu ---------

//   return (
//     <Dialog
//       open={open}
//       onOpenChange={(openValue) => !loading && onOpenChange(openValue)}
//     >
//       <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Modifier le contrat</DialogTitle>
//           <DialogDescription>
//             Mets à jour les informations du contrat, les services et les
//             documents associés (devis, devis signé, facture).
//           </DialogDescription>
//         </DialogHeader>

//         {initialLoading || !fullContrat ? (
//           <div className="py-8 text-center text-sm text-muted-foreground">
//             Chargement du contrat…
//           </div>
//         ) : (
//           <form onSubmit={handleSubmit} className="space-y-6">
//             {/* Titre + client */}
//             <div className="grid gap-3">
//               <div className="grid gap-1.5">
//                 <Label htmlFor={`titre_${fullContrat.id}`}>Titre *</Label>
//                 <Input
//                   id={`titre_${fullContrat.id}`}
//                   value={titre}
//                   onChange={(e) => setTitre(e.target.value)}
//                   required
//                 />
//               </div>

//               <div className="grid gap-1.5">
//                 <Label>Client</Label>
//                 <p className="text-xs text-muted-foreground">
//                   {fullContrat.client_nom_affichage ||
//                     fullContrat.client_nom_legal ||
//                     "Client inconnu"}
//                 </p>
//               </div>
//             </div>

//             {/* Statut + Catégorie */}
//             <div className="grid gap-3 md:grid-cols-2">
//               <div className="grid gap-1.5">
//                 <Label htmlFor={`statut_${fullContrat.id}`}>Statut</Label>
//                 <Select
//                   value={statut}
//                   onValueChange={(value) =>
//                     setStatut(value as StatutContrat)
//                   }
//                 >
//                   <SelectTrigger id={`statut_${fullContrat.id}`}>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="brouillon">
//                       {STATUT_LABEL.brouillon}
//                     </SelectItem>
//                     <SelectItem value="en_attente_signature">
//                       {STATUT_LABEL.en_attente_signature}
//                     </SelectItem>
//                     <SelectItem value="signe">
//                       {STATUT_LABEL.signe}
//                     </SelectItem>
//                     <SelectItem value="en_cours">
//                       {STATUT_LABEL.en_cours}
//                     </SelectItem>
//                     <SelectItem value="termine">
//                       {STATUT_LABEL.termine}
//                     </SelectItem>
//                     <SelectItem value="annule">
//                       {STATUT_LABEL.annule}
//                     </SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="grid gap-1.5">
//                 <Label>Catégorie</Label>
//                 {contrat.service_category ? (
//                   <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] bg-emerald-50 text-emerald-800 border-emerald-200">
//                     <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
//                     <span>{contrat.service_category.label}</span>
//                   </span>
//                 ) : (
//                   <span className="text-xs text-muted-foreground">
//                     Non définie
//                   </span>
//                 )}
//               </div>
//             </div>

//             {/* Services liés */}
//             <div className="space-y-2">
//               <Label>Services liés</Label>
//               {availableServices.length === 0 ? (
//                 <p className="text-[11px] text-muted-foreground">
//                   Aucun service disponible pour cette catégorie, ou catégorie
//                   non définie.
//                 </p>
//               ) : (
//                 <div className="flex flex-wrap gap-2">
//                   {availableServices.map((service) => {
//                     const selected = selectedServiceIds.includes(service.id);
//                     return (
//                       <button
//                         key={service.id}
//                         type="button"
//                         onClick={() => toggleService(service.id)}
//                         className={cn(
//                           "rounded-full border px-3 py-1 text-[11px] transition-colors",
//                           selected
//                             ? "border-primary bg-primary text-primary-foreground"
//                             : "border-muted bg-background text-foreground hover:bg-muted/50",
//                         )}
//                       >
//                         {service.label}
//                       </button>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>

//             {/* Montants & TVA */}
//             <div className="grid grid-cols-3 gap-3">
//               <div className="col-span-2 grid gap-1.5">
//                 <Label htmlFor={`montant_ht_${fullContrat.id}`}>
//                   Montant HT
//                 </Label>
//                 <Input
//                   id={`montant_ht_${fullContrat.id}`}
//                   type="number"
//                   step="0.01"
//                   value={montantHt}
//                   onChange={(e) => setMontantHt(e.target.value)}
//                   placeholder="0.00"
//                 />
//               </div>

//               <div className="grid gap-1.5">
//                 <Label htmlFor={`tva_${fullContrat.id}`}>TVA (%)</Label>
//                 <Input
//                   id={`tva_${fullContrat.id}`}
//                   type="number"
//                   step="0.1"
//                   value={tvaRate}
//                   onChange={(e) =>
//                     setTvaRate(
//                       e.target.value === ""
//                         ? 0
//                         : Number(e.target.value.replace(",", ".")),
//                     )
//                   }
//                 />
//               </div>
//             </div>

//             {/* Montant TTC (calculé) + Devise */}
//             <div className="grid grid-cols-3 gap-3">
//               <div className="col-span-2 grid gap-1.5">
//                 <Label>Montant TTC (calculé)</Label>
//                 <div className="flex h-9 items-center rounded-md border px-3 text-xs text-muted-foreground">
//                   {montantTtcNumber == null
//                     ? "—"
//                     : `${montantTtcNumber.toLocaleString("fr-FR", {
//                         minimumFractionDigits: 2,
//                         maximumFractionDigits: 2,
//                       })} ${devise || "EUR"}`}
//                 </div>
//               </div>

//               <div className="grid gap-1.5">
//                 <Label htmlFor={`devise_${fullContrat.id}`}>Devise</Label>
//                 <Input
//                   id={`devise_${fullContrat.id}`}
//                   value={devise}
//                   onChange={(e) => setDevise(e.target.value)}
//                 />
//               </div>
//             </div>

//             {/* Documents */}
//             <div className="space-y-4">
//               <Label>Documents</Label>

//               {/* Devis */}
//               <div className="space-y-1.5 rounded-md border px-3 py-2">
//                 <div className="flex flex-col gap-0.5">
//                   <span className="text-xs font-medium">Devis</span>
//                   <span className="text-[11px] text-muted-foreground">
//                     PDF du devis (généré ou importé).
//                   </span>
//                   {devisUrl && (
//                     <a
//                       href={devisUrl}
//                       target="_blank"
//                       rel="noreferrer"
//                       className="mt-1 text-[11px] text-primary underline"
//                     >
//                       Voir le devis
//                     </a>
//                   )}
//                 </div>

//                 <SinglePdfUpload
//                   label="Uploader le devis"
//                   initialFileName={getFileNameFromPath(
//                     fullContrat.devis_pdf_path,
//                   )}
//                   onFileChange={(file) => setDevisUpload(file)}
//                 />
//               </div>

//               {/* Devis signé */}
//               <div className="space-y-1.5 rounded-md border px-3 py-2">
//                 <div className="flex flex-col gap-0.5">
//                   <span className="text-xs font-medium">Devis signé</span>
//                   <span className="text-[11px] text-muted-foreground">
//                     PDF signé par le client (scan / signature électronique).
//                   </span>
//                   {devisSigneUrl && (
//                     <a
//                       href={devisSigneUrl}
//                       target="_blank"
//                       rel="noreferrer"
//                       className="mt-1 text-[11px] text-primary underline"
//                     >
//                       Voir le devis signé
//                     </a>
//                   )}
//                 </div>

//                 <SinglePdfUpload
//                   label="Uploader le devis signé"
//                   initialFileName={getFileNameFromPath(
//                     fullContrat.devis_signe_pdf_path,
//                   )}
//                   onFileChange={(file) => setDevisSigneUpload(file)}
//                 />
//               </div>

//               {/* Facture */}
//               <div className="space-y-1.5 rounded-md border px-3 py-2">
//                 <div className="flex flex-col gap-0.5">
//                   <span className="text-xs font-medium">Facture</span>
//                   <span className="text-[11px] text-muted-foreground">
//                     PDF de la facture associée au contrat.
//                   </span>
//                   {factureUrl && (
//                     <a
//                       href={factureUrl}
//                       target="_blank"
//                       rel="noreferrer"
//                       className="mt-1 text-[11px] text-primary underline"
//                     >
//                       Voir la facture
//                     </a>
//                   )}
//                 </div>

//                 <SinglePdfUpload
//                   label="Uploader la facture"
//                   initialFileName={getFileNameFromPath(
//                     fullContrat.facture_pdf_path,
//                   )}
//                   onFileChange={(file) => setFactureUpload(file)}
//                 />
//               </div>
//             </div>

//             <DialogFooter className="mt-2 flex justify-end gap-2">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={() => onOpenChange(false)}
//                 disabled={loading}
//               >
//                 Annuler
//               </Button>
//               <Button type="submit" disabled={loading}>
//                 {loading ? "Enregistrement..." : "Enregistrer"}
//               </Button>
//             </DialogFooter>
//           </form>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }