// lib/auth/whitelist.ts
export const ALLOWED_EMAILS = new Set([
    "pierre@digitaljouss.com",
    "jules@digitaljouss.com",
    "sarah@digitaljouss.com",
    "digitaljouss@gmail.com",
  ]);
  
  export function isEmailAllowed(email: string | null | undefined) {
    if (!email) return false;
    return ALLOWED_EMAILS.has(email.toLowerCase());
  }