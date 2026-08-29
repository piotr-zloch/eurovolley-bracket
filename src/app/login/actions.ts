"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n-server";
import { normalizeUsername, validateUsername } from "@/lib/username";

/**
 * Errors are returned rather than thrown or redirected to.
 *
 * A redirect on failure is a fresh GET, which wipes every field — so a user who mistypes their
 * password, or picks a username that's taken, has to retype the whole form. Returning state keeps
 * what they entered.
 */
export type AuthState = { error?: string; values?: { email?: string; username?: string } };

/** Supabase reports errors in English; surface them in the user's language where we recognise them. */
async function translateAuthError(message: string): Promise<string> {
  const dict = await getDict();
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return dict.auth.errInvalidCredentials;
  if (m.includes("email not confirmed")) return dict.auth.errNotConfirmed;
  if (m.includes("user already registered") || m.includes("already been registered"))
    return dict.auth.errAlreadyRegistered;
  if (m.includes("rate limit")) return dict.auth.errRateLimit;
  if (m.includes("password should be at least")) return dict.auth.errPasswordShort;
  if (m.includes("is invalid")) return dict.auth.errInvalidEmail;
  return message;
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = ((formData.get("email") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: await translateAuthError(error.message), values: { email } };
  }

  revalidatePath("/", "layout");
  redirect("/predictions");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = ((formData.get("email") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const username = normalizeUsername(formData.get("username") as string);
  const keep = { email, username };

  const dict = await getDict();

  // Enforced server-side, not just via the form's `required`: the username is the only public
  // identity in the app and must never fall back to the email.
  const problem = validateUsername(username);
  if (problem) return { error: problem, values: keep };

  const supabase = await createClient();

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (taken) return { error: dict.auth.errUsernameTaken, values: keep };

  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: origin ? `${origin}/auth/callback?next=/predictions` : undefined,
    },
  });

  if (error) return { error: await translateAuthError(error.message), values: keep };

  // With email confirmation disabled, signUp returns a live session — log them straight in
  // rather than telling them to check an email that will never arrive.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/predictions");
  }

  redirect(`/login?message=${encodeURIComponent(dict.auth.checkEmail)}`);
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = ((formData.get("email") as string) ?? "").trim();
  const dict = await getDict();
  if (!email) return { error: dict.auth.errInvalidEmail };

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/auth/callback?next=/reset-password` : undefined,
  });

  // Deliberately reports success even when the address isn't registered: saying otherwise would
  // let anyone test which emails have accounts here.
  if (error && !error.message.toLowerCase().includes("rate limit")) {
    return { error: await translateAuthError(error.message), values: { email } };
  }
  if (error) return { error: await translateAuthError(error.message), values: { email } };

  redirect(`/login?message=${encodeURIComponent(dict.auth.resetSent)}`);
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = (formData.get("password") as string) ?? "";
  const dict = await getDict();

  if (password.length < 8) return { error: dict.auth.errPasswordShort };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The recovery link must have established a session first, via /auth/callback.
  if (!user) return { error: dict.auth.errResetExpired };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: await translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/predictions");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
