import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

async function setLocale(formData: FormData) {
  "use server";
  const next = formData.get("locale") === "en" ? "en" : "pl";
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export default function LanguageToggle({ locale }: { locale: Locale }) {
  const other: Locale = locale === "pl" ? "en" : "pl";

  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={other} />
      <button
        className="text-gray-500 uppercase hover:text-gray-900"
        title={other === "pl" ? "Zmień język na polski" : "Switch language to English"}
      >
        {other}
      </button>
    </form>
  );
}
