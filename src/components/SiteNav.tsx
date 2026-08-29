import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { getDict, getLocale } from "@/lib/i18n-server";
import LanguageToggle from "./LanguageToggle";

export default async function SiteNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dict = await getDict();
  const locale = await getLocale();

  // Logged-out pages (login/signup) render their own standalone layout, but the language
  // toggle still needs to be reachable there so someone can switch before signing up.
  if (!user) {
    return (
      <header className="border-b">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 text-sm">
          <span className="font-semibold">{dict.appName}</span>
          <LanguageToggle locale={locale} />
        </nav>
      </header>
    );
  }

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
        <Link href="/predictions" className="font-semibold">
          {dict.appName}
        </Link>
        <Link href="/predictions" className="text-gray-600 hover:text-gray-900">
          {dict.nav.predictions}
        </Link>
        <Link href="/leaderboard" className="text-gray-600 hover:text-gray-900">
          {dict.nav.leaderboard}
        </Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
          {dict.nav.groups}
        </Link>
        {adminRow && (
          <Link href="/admin" className="text-gray-600 hover:text-gray-900">
            {dict.nav.admin}
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3">
          <LanguageToggle locale={locale} />
          <form action={signOut}>
            <button className="text-gray-500 underline">{dict.nav.signOut}</button>
          </form>
        </div>
      </nav>
    </header>
  );
}
