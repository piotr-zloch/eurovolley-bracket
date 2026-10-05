import Link from "next/link";
import { getDict } from "@/lib/i18n-server";
import { OPERATOR } from "@/lib/legal";

/** Legal links on every page, and a plain statement that this is a fan site. */
export default async function SiteFooter() {
  const dict = await getDict();
  const t = dict.footer;

  return (
    <footer className="mt-12 border-t bg-gray-50 text-xs text-gray-500">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-6">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/regulamin" className="text-gray-700 hover:underline">
            {t.terms}
          </Link>
          <Link href="/regulamin-konkursu" className="text-gray-700 hover:underline">
            {t.contest}
          </Link>
          <Link href="/polityka-prywatnosci" className="text-gray-700 hover:underline">
            {t.privacy}
          </Link>
          <a href={`mailto:${OPERATOR.email}`} className="text-gray-700 hover:underline">
            {OPERATOR.email}
          </a>
        </nav>
        <p>{t.unofficial}</p>
      </div>
    </footer>
  );
}
