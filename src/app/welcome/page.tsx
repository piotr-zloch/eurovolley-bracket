import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_HINT, USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { setUsername } from "./actions";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

  // Already sorted — don't trap someone on the onboarding screen.
  if (profile?.username) redirect("/standings");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Choose your username</h1>
      <p className="text-sm text-gray-500">
        This is how you&apos;ll appear on leaderboards. Your email is never shown to anyone.
      </p>

      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      <form action={setUsername} className="flex flex-col gap-3">
        <input
          name="username"
          type="text"
          required
          autoFocus
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          placeholder="e.g. PiotrZ"
          className="rounded border px-3 py-2"
        />
        <p className="text-xs text-gray-400">{USERNAME_HINT}</p>
        <button className="rounded bg-blue-600 px-3 py-2 text-white">Continue</button>
      </form>
    </div>
  );
}
