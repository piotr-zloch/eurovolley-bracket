"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveUsername } from "@/app/welcome/actions";

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createGroup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = formData.get("name") as string;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    redirect("/dashboard?error=No tournament configured yet");
  }

  const { error } = await supabase.from("prediction_groups").insert({
    tournament_id: tournament.id,
    name,
    owner_id: user.id,
    invite_code: randomInviteCode(),
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
}

export async function updateUsername(formData: FormData) {
  await saveUsername(formData, "/dashboard", "/dashboard");
}

export async function joinGroup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const inviteCode = (formData.get("invite_code") as string).trim().toUpperCase();

  const { data: group, error: findError } = await supabase
    .from("prediction_groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .single();

  if (findError || !group) {
    redirect("/dashboard?error=Invite code not found");
  }

  const { error } = await supabase
    .from("group_members")
    .insert({ prediction_group_id: group!.id, user_id: user.id });

  if (error && !error.message.includes("duplicate")) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
}
