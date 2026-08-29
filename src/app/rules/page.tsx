import { getDict } from "@/lib/i18n-server";

function Row({ label, points }: { label: string; points: string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">{label}</td>
      <td className="py-2 text-right font-medium whitespace-nowrap">{points}</td>
    </tr>
  );
}

export default async function RulesPage() {
  const dict = await getDict();
  const t = dict.rules;
  const pts = dict.rules.pts;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{t.title}</h1>
      <p className="mb-8 text-sm text-gray-500">{t.intro}</p>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">{t.compA}</h2>
        <p className="mb-6 text-sm text-gray-500">{t.compAIntro}</p>

        <h3 className="mb-1 font-medium">{t.groupsHeading}</h3>
        <p className="mb-2 text-sm">{t.groupsRule}</p>
        <p className="mb-6 rounded bg-gray-50 p-3 text-sm text-gray-600">{t.groupsExample}</p>

        <h3 className="mb-2 font-medium">{t.bracketHeading}</h3>
        <table className="mb-2 w-full border-collapse text-sm">
          <tbody>
            <Row label={t.bracketR16} points={`4 ${pts}`} />
            <Row label={t.bracketQF} points={`8 ${pts}`} />
            <Row label={t.bracketSF} points={`16 ${pts}`} />
            <Row label={t.bracketBronze} points={`16 ${pts}`} />
            <Row label={t.bracketFinal} points={`32 ${pts}`} />
          </tbody>
        </table>
        <p className="text-sm text-gray-500">{t.bracketWrong}</p>
      </section>

      <section className="mb-10 rounded border border-yellow-300 bg-yellow-50 p-4">
        <h2 className="mb-2 font-semibold text-yellow-900">{t.deadlineHeading}</h2>
        <p className="text-sm text-yellow-900">{t.deadlineRule}</p>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">{t.compB}</h2>
        <p className="mb-6 text-sm text-gray-500">{t.compBIntro}</p>

        <h3 className="mb-2 font-medium">{t.matchTable}</h3>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <Row label={t.matchExact} points={`5 ${pts}`} />
            <Row label={t.matchNear} points={`4 ${pts}`} />
            <Row label={t.matchFive} points={`3 ${pts}`} />
            <Row label={t.matchWrongFive} points={`2 ${pts}`} />
            <Row label={t.matchOther} points={`0 ${pts}`} />
          </tbody>
        </table>
      </section>
    </div>
  );
}
