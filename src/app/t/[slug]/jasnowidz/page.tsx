import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import { getTournamentBySlug, isArchived } from "@/lib/tournament";
import { choicesFor, pointsEarned } from "@/lib/jasnowidz";
import { loadQuestions, loadRoster } from "@/lib/jasnowidz-data";
import JasnowidzForm, { type FormQuestion } from "./JasnowidzForm";
import DeadlineBanner from "@/components/DeadlineBanner";

export default async function JasnowidzPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const locale = await getLocale();
  const t = dict.jasnowidz;

  const tournament = await getTournamentBySlug(supabase, slug);
  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const isAdmin = !!adminRow;

  if (!tournament.jasnowidz_enabled && !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold">{t.title}</h1>
        <p className="text-gray-600">{t.notOpen}</p>
      </div>
    );
  }

  const questions = await loadQuestions(supabase, tournament.id);
  const { teams, players } = await loadRoster(supabase, tournament.id, locale);
  const ids = questions.map((q) => q.id);

  const { data: myAnswers } = ids.length
    ? await supabase.from("jasnowidz_answers").select("question_id, answer").eq("user_id", user.id).in("question_id", ids)
    : { data: [] };
  const { data: results } = ids.length
    ? await supabase.from("jasnowidz_results").select("question_id, correct").in("question_id", ids)
    : { data: [] };

  const answerOf = new Map((myAnswers ?? []).map((a) => [a.question_id as number, a.answer as string]));
  const correctOf = new Map((results ?? []).map((r) => [r.question_id as number, r.correct as string[]]));
  const labels = { yes: t.yes, no: t.no };

  const rows: FormQuestion[] = questions.map((q) => {
    const choices = choicesFor(q, teams, players, labels);
    const correct = correctOf.get(q.id) ?? null;
    const answer = answerOf.get(q.id) ?? null;
    return {
      id: q.id,
      section: q.section,
      position: q.position,
      kind: q.kind,
      prompt: (locale === "en" && q.prompt_en) || q.prompt_pl,
      points: q.points,
      choices,
      answer,
      correctLabels: correct ? correct.map((k) => choices.find((c) => c.key === k)?.label ?? k).join(" / ") : null,
      earned: pointsEarned(q.points, answer ?? undefined, correct ?? undefined),
    };
  });

  const sum = (section: string) => rows.filter((r) => r.section === section).reduce((n, r) => n + (r.earned ?? 0), 0);
  const anyResolved = rows.some((r) => r.correctLabels !== null);

  // Closed for answers once the season has started or the competition is archived. A hidden
  // Jasnowidz (admin preview) is also read-only, because the database only accepts answers while
  // it is open to players.
  const deadlineMs = new Date(tournament.prediction_deadline).getTime();
  const locked = isArchived(tournament) || Date.now() >= deadlineMs;
  const preview = !tournament.jasnowidz_enabled;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {!locked && (
        <DeadlineBanner
          template={t.deadlineBanner}
          deadlineIso={tournament.prediction_deadline}
          locale={locale}
          dict={dict}
        />
      )}
      <h1 className="mb-2 text-2xl font-bold">{t.title}</h1>
      <p className="mb-2 text-sm text-gray-600">{t.intro}</p>
      <p className="mb-2 text-sm text-gray-500">{t.rulesHint}</p>
      <p className="mb-6 text-sm">
        <Link href={`/t/${slug}/jasnowidz/ranking`} className="text-blue-600 underline">
          {t.rankingLink}
        </Link>
      </p>

      {preview && (
        <p className="mb-6 rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {dict.admin.jasnowidz.hidden}
        </p>
      )}
      {anyResolved && (
        <p className="mb-6 rounded border bg-gray-50 px-4 py-2 text-sm">
          {fmt(t.yourPoints, { teams: sum("teams"), ext: sum("extended"), total: sum("teams") + sum("extended") })}
        </p>
      )}

      <JasnowidzForm
        tournamentId={tournament.id}
        questions={rows}
        locked={locked || preview}
        lockedNotice={locked}
        dict={dict}
      />
    </div>
  );
}
