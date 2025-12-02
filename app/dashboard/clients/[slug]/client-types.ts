// app/dashboard/clients/[slug]/client-types.ts
export type ClientRow = {
    id: string;
    nom_legal: string;
    nom_affichage: string;
    statut_client: string;
    type_client: string | null;
    secteur_activite: string | null;
    site_web_principal: string | null;
    email_general: string | null;
    telephone_general: string | null;
    contact_principal_nom: string | null;
    contact_principal_prenom: string | null;
    contact_principal_role: string | null;
    contact_principal_email: string | null;
    contact_principal_telephone: string | null;
    notes_internes: string | null;
    logo_url: string | null;
    slug: string | null;
  };