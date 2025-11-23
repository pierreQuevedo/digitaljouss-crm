// components/home-auth-debug.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isEmailAllowed, ALLOWED_EMAILS } from "@/lib/auth/whitelist";
import { LogoutButton } from "@/components/auth/logout-button";

type SupabaseUser = {
  id: string;
  email?: string;
  created_at?: string;
};

export function HomeAuthDebug() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        // Pas de user -> on renvoie vers le login
        router.replace("/auth/login");
        return;
      }

      const u = data.user as SupabaseUser;
      const email = u.email ?? "";
      const ok = isEmailAllowed(email);

      if (!ok) {
        // User pas whitelisté -> déconnexion + redirect
        await supabase.auth.signOut();
        router.replace("/auth/login?error=unauthorized");
        return;
      }

      if (!cancelled) {
        setUser(u);
        setAuthorized(true);
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Petit état de chargement pendant qu'on check la session
  if (!user || !authorized) {
    return (
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Vérification de ta session…
        </p>
      </div>
    );
  }

  const email = user.email ?? "";

  return (
    <div className="w-full max-w-lg space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            CRM DJ – Auth OK ✅
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu es bien connecté avec un compte autorisé.
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="rounded-lg border bg-background p-4 text-sm space-y-2">
        <p className="font-medium">Utilisateur connecté</p>
        <p>
          <span className="text-muted-foreground">Email :</span>{" "}
          <span className="font-mono">{email}</span>
        </p>
        <p>
          <span className="text-muted-foreground">ID :</span>{" "}
          <span className="font-mono text-xs">{user.id}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Créé le :</span>{" "}
          {user.created_at
            ? new Date(user.created_at).toLocaleString("fr-FR")
            : "N/A"}
        </p>
        <p className="mt-2">
          <span className="text-muted-foreground">Statut :</span>{" "}
          <span className="inline-flex items-center rounded-full border bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Autorisé
          </span>
        </p>
      </div>

      <div className="rounded-lg border bg-background p-4 text-sm space-y-2">
        <p className="font-medium">Emails autorisés (whitelist)</p>
        <ul className="list-inside list-disc text-muted-foreground">
          {Array.from(ALLOWED_EMAILS).map((e) => (
            <li
              key={e}
              className={e === email ? "font-semibold text-foreground" : ""}
            >
              {e}
              {e === email && " ← toi"}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Si tu arrives ici, c&apos;est que : Google OAuth fonctionne ✅, la
        whitelist fonctionne ✅, la session Supabase fonctionne ✅.
      </p>
    </div>
  );
}
