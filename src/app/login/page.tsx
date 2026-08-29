import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Eurovolley 2026 Predictor</h1>
      <p className="text-sm text-gray-500">Sign in to start predicting.</p>

      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded bg-green-100 p-2 text-sm text-green-700">{message}</p>}

      <form action={login} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" required className="rounded border px-3 py-2" />

        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="rounded border px-3 py-2"
        />

        <button className="rounded bg-blue-600 px-3 py-2 text-white">Log in</button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-blue-600 underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
