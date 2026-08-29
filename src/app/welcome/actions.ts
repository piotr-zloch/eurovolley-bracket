"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, validateUsername } from "@/lib/username";

/** Shared by the /welcome onboarding screen and the "change username" form on /dashboard. */
export async function saveUsername(formData: FormData, redirectTo: string, errorPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const username = normalizeUsername(formData.get("username") as string);
  const problem = validateUsername(username);
  if (problem) {
    redirect(`${errorPath}?error=${encodeURIComponent(problem)}`);
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username }, { onConflict: "id" });

  if (error) {
    // 23505 = unique_violation on the case-insensitive username index.
    const message =
      error.code === "23505"
        ? "That username is already taken — please pick another."
        : error.message;
    redirect(`${errorPath}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function setUsername(formData: FormData) {
  await saveUsername(formData, "/predictions", "/welcome");
}
