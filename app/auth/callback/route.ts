// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isEmailAllowed } from "@/lib/auth/whitelist";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // On récupère le cookieStore de Next
  const cookieStore = await cookies();

  // On crée un client Supabase côté serveur avec le même pattern
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // On échange le code OAuth contre une session (pose les cookies)
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  );

  if (exchangeError) {
    console.error("Error exchanging code for session:", exchangeError);
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`);
  }

  // On récupère l'utilisateur
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`);
  }

  const email = userData.user.email;

  if (!isEmailAllowed(email)) {
    await supabase.auth.signOut();
    const redirectUrl = new URL("/auth/login", origin);
    redirectUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Ici, l'utilisateur est autorisé et la session est bien en cookie
  return NextResponse.redirect(`${origin}/dashboard`);
}
