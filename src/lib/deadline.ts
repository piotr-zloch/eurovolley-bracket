// Formatting for the "time left until the first ball" banner. Pure, so it can be tested on its own.

export type TimeUnits = { day: string; days: string; hours: string; minutes: string };

/**
 * "11 days 5 h", "5 h 20 min" or "20 min": the two largest units that are not zero, rounded
 * down. Returns null once the deadline has passed.
 */
export function formatTimeLeft(ms: number, u: TimeUnits): string | null {
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} ${days === 1 ? u.day : u.days}${hours > 0 ? ` ${hours} ${u.hours}` : ""}`;
  if (hours > 0) return `${hours} ${u.hours}${minutes > 0 ? ` ${minutes} ${u.minutes}` : ""}`;
  return `${Math.max(minutes, 1)} ${u.minutes}`;
}
