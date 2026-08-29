import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the one-time `code` from a Supabase email link for a session.
 *
 * Without this, confirmation and password-reset links land on a page that ignores the parameter,
 * the code is never redeemed, and the user appears to click a link that does nothing (or reports
 * an expired token on a second attempt, because the first visit already consumed it).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/predictions";
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Only ever redirect within this site — `next` comes from the URL.
  const target = next.startsWith("/") ? next : "/predictions";
  return NextResponse.redirect(`${origin}${target}`);
}
