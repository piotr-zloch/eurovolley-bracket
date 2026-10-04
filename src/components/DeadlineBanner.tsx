import { fmt, type Dict } from "@/lib/i18n";
import { formatTimeLeft } from "@/lib/deadline";

/**
 * A notice at the top of a page saying when entries close and how long is left. Renders nothing
 * once the deadline has passed (the pages have their own "closed" notices for that).
 *
 * `template` has {deadline} and {left} placeholders. The deadline is shown in Polish time.
 */
export default function DeadlineBanner({
  template,
  deadlineIso,
  locale,
  dict,
}: {
  template: string;
  deadlineIso: string;
  locale: string;
  dict: Dict;
}) {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  const left = formatTimeLeft(ms, {
    day: dict.common.unitDay,
    days: dict.common.unitDays,
    hours: dict.common.unitHours,
    minutes: dict.common.unitMinutes,
  });
  if (!left) return null;

  const deadline = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(deadlineIso));

  return (
    <p className="mb-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {fmt(template, { deadline, left: fmt(dict.common.timeLeft, { time: left }) })}
    </p>
  );
}
