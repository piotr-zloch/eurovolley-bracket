import Link from "next/link";
import { signup } from "@/app/login/actions";
import { USERNAME_HINT, USERNAME_MAX, USERNAME_MIN } from "@/lib/username";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Eurovolley 2026 Predictor</h1>
      <p className="text-sm text-gray-500">Create an account to start predicting.</p>

      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      <form action={signup} className="flex flex-col gap-3">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          placeholder="e.g. PiotrZ"
          className="rounded border px-3 py-2"
        />
        <p className="-mt-1 text-xs text-gray-400">
          Shown on leaderboards. {USERNAME_HINT} Your email stays private.
        </p>

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

        <button className="rounded bg-blue-600 px-3 py-2 text-white">Sign up</button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
