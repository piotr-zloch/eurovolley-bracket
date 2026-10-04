"use client";

import { useRouter } from "next/navigation";

/**
 * A dropdown of the competitions. Choosing one opens its prediction page, which is open to
 * visitors as well as members (the leaderboard needs an account, so it would bounce a visitor).
 */
export default function CompetitionSwitcher({
  label,
  currentSlug,
  options,
}: {
  label: string;
  currentSlug: string;
  options: { slug: string; label: string }[];
}) {
  const router = useRouter();

  return (
    <label className="ml-auto flex items-center gap-2 text-gray-500">
      {label}:
      <select
        value={currentSlug}
        onChange={(e) => router.push(`/t/${e.target.value}/predictions`)}
        className="rounded border bg-white px-2 py-1 text-gray-900"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
