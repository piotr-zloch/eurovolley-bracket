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

  // A visitor needs a way home and a way in from every page, including the public ones (rules,
  // the prediction form), so the brand is a link and login / sign-up are always at the top.
  if (!user) {
    return (
      <header className="border-b">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">
            {dict.appName}
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle locale={locale} />
            <Link href="/login" className="text-gray-700 hover:text-gray-900">
              {dict.nav.logIn}
            </Link>
            <Link href="/signup" className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
              {dict.nav.signUp}
            </Link>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header className="border-b">
      {/* Tournament links live in t/[slug]/layout.tsx; this nav is only site-wide. */}
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold">
          {dict.appName}
        </Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
          {dict.nav.groups}
        </Link>
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
