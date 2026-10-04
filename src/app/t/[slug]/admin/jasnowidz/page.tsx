import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict, getLocale } from "@/lib/i18n-server";
import { getTournamentBySlug } from "@/lib/tournament";
import { choicesFor } from "@/lib/jasnowidz";
import { loadQuestions, loadRoster } from "@/lib/jasnowidz-data";
import EnableToggle from "./EnableToggle";
import ResolveForm from "./ResolveForm";

export default async function AdminJasnowidzPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const locale = await getLocale();
  const t = dict.admin.jasnowidz;

  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-gray-500">{dict.admin.noAccess}</p>
      </div>
    );
  }

  const tournament = await getTournamentBySlug(supabase, slug);
  const questions = await loadQuestions(supabase, tournament.id);
  const { teams, players } = await loadRoster(supabase, tournament.id, locale);
  const ids = questions.map((q) => q.id);

  const { data: results } = ids.length
    ? await supabase.from("jasnowidz_results").select("question_id, correct").in("question_id", ids)
    : { data: [] };
  // Admins can read every answer (row-level security allows it), which gives a count per question.
  const { data: answers } = ids.length
    ? await supabase.from("jasnowidz_answers").select("question_id").in("question_id", ids)
    : { data: [] };

  const correctOf = new Map((results ?? []).map((r) => [r.question_id as number, r.correct as string[]]));
  const countOf = new Map<number, number>();
  (answers ?? []).forEach((a) => countOf.set(a.question_id as number, (countOf.get(a.question_id as number) ?? 0) + 1));
  const labels = { yes: dict.jasnowidz.yes, no: dict.jasnowidz.no };

  const sections: { key: "teams" | "extended"; title: string }[] = [
    { key: "teams", title: dict.jasnowidz.teamsSection },
    { key: "extended", title: dict.jasnowidz.extendedSection },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/t/${slug}/admin`} className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← {dict.admin.title}
      </Link>
      <h1 className="mb-2 text-2xl font-bold">
        {t.title} — {tournament.name}
      </h1>
      <p className="mb-6 text-sm text-gray-500">{t.intro}</p>

      <EnableToggle tournamentId={tournament.id} enabled={tournament.jasnowidz_enabled} dict={dict} />

      {sections.map(({ key, title }) => (
        <section key={key} className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{title}</h2>
          <ol className="flex flex-col gap-3">
            {questions
              .filter((q) => q.section === key)
              .map((q) => (
                <ResolveForm
                  key={q.id}
                  tournamentId={tournament.id}
                  questionId={q.id}
                  position={q.position}
                  prompt={(locale === "en" && q.prompt_en) || q.prompt_pl}
                  choices={choicesFor(q, teams, players, labels)}
                  initialCorrect={correctOf.get(q.id) ?? []}
                  answerCount={countOf.get(q.id) ?? 0}
                  dict={dict}
                />
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
