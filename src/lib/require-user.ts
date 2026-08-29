import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Gate for every logged-in page: requires a session AND a chosen username.
 *
 * Usernames are mandatory (they're the only identity shown publicly — emails are never
 * displayed), so an account whose profile has no username yet is sent to /welcome to pick one
 * before it can reach any other page. This catches accounts created before usernames were
 * required, as well as any signup where the trigger couldn't store the requested name
 * (e.g. it was already taken).
 */
export async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.username) redirect("/welcome");

  return { supabase, user, username: profile.username as string };
}
