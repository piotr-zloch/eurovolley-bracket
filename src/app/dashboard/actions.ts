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

  const inviteCode = ((formData.get("invite_code") as string) ?? "").trim().toUpperCase();

  // Via an RPC rather than reading prediction_groups directly: that table's SELECT policy only
  // exposes rows to the owner and existing members, so a would-be joiner could never see the
  // group they were trying to join — every valid code came back "not found". join_group()
  // resolves the code and inserts the membership as a definer, leaving the policy intact.
  const { data: groupId, error } = await supabase.rpc("join_group", { code: inviteCode });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  // An error key rather than English prose, so the page can render it in the user's language.
  if (!groupId) {
    redirect("/dashboard?error=inviteNotFound");
  }

  revalidatePath("/dashboard");
}
