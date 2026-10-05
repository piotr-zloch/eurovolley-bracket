import Link from "next/link";

export type LegalSection = {
  heading: string;
  /** A string is a paragraph, a string[] is a bulleted list. */
  body: (string | string[])[];
};

/** Common layout for the terms, contest rules and privacy policy. */
export default function LegalDocument({
  title,
  version,
  summary,
  sections,
  otherDocs,
}: {
  title: string;
  version: string;
  /** Shown above the Polish text to English readers: the Polish text is the binding one. */
  summary?: string;
  sections: LegalSection[];
  otherDocs: { href: string; label: string }[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <p className="mb-6 text-sm text-gray-500">{version}</p>

      {summary && (
        <p className="mb-8 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{summary}</p>
      )}

      <div className="flex flex-col gap-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-2 text-lg font-semibold">{s.heading}</h2>
            <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
              {s.body.map((b, i) =>
                Array.isArray(b) ? (
                  <ul key={i} className="ml-5 list-disc">
                    {b.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{b}</p>
                )
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm">
        {otherDocs.map((d) => (
          <Link key={d.href} href={d.href} className="text-blue-600 underline">
            {d.label}
          </Link>
        ))}
      </p>
    </div>
  );
}
