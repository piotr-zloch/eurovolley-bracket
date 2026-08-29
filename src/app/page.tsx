import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/require-user";
import { getDict } from "@/lib/i18n-server";

export default async function Home() {
  const { user } = await getOptionalUser();
  // Signed-in users have no use for the pitch.
  if (user) redirect("/predictions");

  const dict = await getDict();
  const t = dict.landing;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">{dict.appName}</h1>
      <p className="mt-1 text-gray-500">{t.tagline}</p>

      <p className="mt-6 text-[15px] leading-relaxed">{t.lead}</p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/predictions"
          className="rounded bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
        >
          {t.ctaPrimary}
        </Link>
        <span className="text-sm text-gray-500">{t.ctaNote}</span>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {t.haveAccount}{" "}
        <Link href="/login" className="text-blue-600 underline">
          {t.logIn}
        </Link>
      </p>

      <h2 className="mt-12 text-lg font-semibold">{t.whatTitle}</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded border p-4">
          <h3 className="font-medium">{t.whatA}</h3>
          <p className="mt-1 text-sm text-gray-600">{t.whatADesc}</p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-medium">{t.whatB}</h3>
          <p className="mt-1 text-sm text-gray-600">{t.whatBDesc}</p>
        </div>
      </div>

      <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-4">
        <h3 className="font-medium text-yellow-900">{t.deadlineTitle}</h3>
        <p className="mt-1 text-sm text-yellow-900">{t.deadlineBody}</p>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/rules" className="text-blue-600 underline">
          {t.rulesLink}
        </Link>
      </p>
    </div>
  );
}
