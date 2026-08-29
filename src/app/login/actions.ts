"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, validateUsername } from "@/lib/username";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/predictions");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const username = normalizeUsername(formData.get("username") as string);

  // Enforced server-side, not just via the form's `required` attribute: usernames are the only
  // public identity in the app, and must never fall back to the email.
  const problem = validateUsername(username);
  if (problem) {
    redirect(`/signup?error=${encodeURIComponent(problem)}`);
  }

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (taken) {
    redirect(`/signup?error=${encodeURIComponent("That username is already taken — please pick another.")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Read by the handle_new_user() trigger to create the public profiles row.
    options: { data: { username } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is disabled (project setting), signUp returns a live session
  // immediately — log the user straight in instead of telling them to check an email
  // that will never arrive.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/predictions");
  }

  redirect("/login?message=Check your email to confirm your account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
