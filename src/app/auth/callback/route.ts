import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logError, logInfo } from "@/lib/logger";

/** Exchange a Supabase auth code and redirect the browser to the requested path. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (e) {
              logError("auth/callback", "Failed to persist auth cookies", e);
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    logInfo("auth/callback", "Supabase exchange completed", {
      error: error?.message,
      user: data?.user?.email,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    logError("auth/callback", "Supabase exchange failed", error);
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
