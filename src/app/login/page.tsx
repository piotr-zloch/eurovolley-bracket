import Link from "next/link";
import { getDict } from "@/lib/i18n-server";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const dict = await getDict();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">{dict.appName}</h1>
      <p className="text-sm text-gray-500">{dict.auth.signInTitle}</p>

      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded bg-green-100 p-2 text-sm text-green-700">{message}</p>}

      <form action={login} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          {dict.auth.email}
        </label>
        <input id="email" name="email" type="email" required className="rounded border px-3 py-2" />

        <label htmlFor="password" className="text-sm font-medium">
          {dict.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="rounded border px-3 py-2"
        />

        <button className="rounded bg-blue-600 px-3 py-2 text-white">{dict.auth.logIn}</button>
      </form>

      <p className="text-center text-sm text-gray-500">
        {dict.auth.noAccount}{" "}
        <Link href="/signup" className="text-blue-600 underline">
          {dict.auth.signUp}
        </Link>
      </p>
    </div>
  );
}
