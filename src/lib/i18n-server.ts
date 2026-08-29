import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dict, type Locale } from "./i18n";

// Server-only half of the i18n setup. Kept apart from ./i18n because that module is imported
// by Client Components, and `next/headers` cannot be bundled for the browser.
//
// Locale lives in a cookie rather than the URL: every page is behind a login and rendered per
// request anyway, so /pl/ and /en/ prefixes would buy no SEO or caching benefit, and this keeps
// every existing URL (and the Supabase auth redirect allow-list) unchanged.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" || value === "pl" ? value : DEFAULT_LOCALE;
}

export async function getDict() {
  return dict[await getLocale()];
}
