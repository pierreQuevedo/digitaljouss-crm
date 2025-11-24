// // app/dashboard/prospects/page.tsx
// "use client";

// import * as React from "react";

// import { ProspectsTable } from "@/components/clients/prospects/prospects-table";
// import { ProspectAddSheet } from "@/components/clients/prospects/prospects-add-sheet";
// // import { Button } from "@/components/ui/button";

// export default function ProspectsPage() {
//   const [refreshToken, setRefreshToken] = React.useState(0);

//   const handleCreated = () => {
//     setRefreshToken((prev) => prev + 1);
//   };

//   return (
//     <div className="flex flex-col gap-4 p-4">
//       {/* Header page */}
//       <div className="flex flex-wrap items-center justify-between gap-3">
//         <div>
//           <h1 className="text-xl font-semibold tracking-tight">Prospects</h1>
//         </div>

//         {/* CTA ajouter un prospect (via le sheet générique client, par défaut statut = prospect) */}
//         <ProspectAddSheet
//           onCreated={handleCreated}
//           className="ml-auto"
//           title="Ajouter un prospect"
//         />
//       </div>

//       {/* Table prospects */}
//       <ProspectsTable refreshToken={refreshToken} className="mt-2" />
//     </div>
//   );
// }

// app/dashboard/clients/prospects/page.tsx
import { ProspectsPageContent } from "@/components/clients/prospects/prospects-page-content";

export default function ProspectsPage() {
  return <ProspectsPageContent />;
}