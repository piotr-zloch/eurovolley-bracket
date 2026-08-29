import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function SiteNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-out pages (login/signup) render their own standalone layout.
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <header className="border-b">
      {/* flex-wrap: at ~375px these links otherwise overflow and make the whole page
          scroll sideways. */}
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
        <Link href="/standings" className="font-semibold">
          EuroVolley 2026
        </Link>
        <Link href="/standings" className="text-gray-600 hover:text-gray-900">
          Group predictions
        </Link>
        <Link href="/bracket" className="text-gray-600 hover:text-gray-900">
          Bracket
        </Link>
        <Link href="/leaderboard" className="text-gray-600 hover:text-gray-900">
          Leaderboard
        </Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
          My groups
        </Link>
        {adminRow && (
          <Link href="/admin" className="text-gray-600 hover:text-gray-900">
            Admin
          </Link>
        )}
        <form action={signOut} className="ml-auto">
          <button className="text-gray-500 underline">Sign out</button>
        </form>
      </nav>
    </header>
  );
}
