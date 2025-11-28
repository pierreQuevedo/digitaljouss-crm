// // components/contrats-conception-web/contrat-conception-web-actions.tsx
// "use client";

// import { useState } from "react";
// import { EllipsisVerticalIcon } from "lucide-react";

// import { Button } from "@/components/ui/button";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// import type { ContratRow } from "./contrats-conception-web-table";
// import { ContratConceptionWebEditDialog } from "@/components/contrats-propos/contrats-conception-web/contrat-conception-web-edit-dialog";

// type Props = {
//   contrat: ContratRow;
//   onUpdated?: () => void;
// };

// export function ContratConceptionWebActions({ contrat, onUpdated }: Props) {
//   const [openEdit, setOpenEdit] = useState(false);

//   return (
//     <>
//       <DropdownMenu>
//         <DropdownMenuTrigger asChild>
//           <Button
//             size="icon"
//             variant="ghost"
//             className="shadow-none"
//             aria-label="Actions sur le contrat"
//           >
//             <EllipsisVerticalIcon className="h-4 w-4" />
//           </Button>
//         </DropdownMenuTrigger>
//         <DropdownMenuContent align="end">
//           <DropdownMenuLabel>Actions</DropdownMenuLabel>
//           <DropdownMenuSeparator />
//           <DropdownMenuItem onClick={() => setOpenEdit(true)}>
//             Modifier
//           </DropdownMenuItem>
//         </DropdownMenuContent>
//       </DropdownMenu>

//       <ContratConceptionWebEditDialog
//         open={openEdit}
//         onOpenChange={setOpenEdit}
//         contrat={contrat}
//         onUpdated={onUpdated}
//       />
//     </>
//   );
// }