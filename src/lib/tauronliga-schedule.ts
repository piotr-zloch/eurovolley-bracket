import * as cheerio from "cheerio";

// Parser for the league's published schedule (tauronliga.pl/games.html).
//
// The page holds every regular-season round at once, inside hidden <section data-term="N">
// blocks (the site's "Wszystkie" button only toggles their visibility), each containing one
// <section data-game-id data-team="homeId,awayId"> per game. Later rounds are published with a
// preliminary date only, so the kick-off time is optional.
//
// Games are identified by the site's own game id, which is what matches.source_id stores.

export type ScheduledGame = {
  id: number;
  round: number;
  /** yyyy-mm-dd, Polish local date as published. */
  date: string;
  /** HH:MM Polish local time, or null while only a preliminary date is known. */
  time: string | null;
  homeSourceId: number;
  awaySourceId: number;
};

const DATE = /(\d{2})\.(\d{2})\.(\d{4})(?:,\s*(\d{2}):(\d{2}))?/;

export function parseSchedule(html: string): ScheduledGame[] {
  const $ = cheerio.load(html);
  const games: ScheduledGame[] = [];
  const seen = new Set<number>();

  $("section.filterable-content[data-term]").each((_, roundEl) => {
    const round = Number($(roundEl).attr("data-term"));
    // Only the regular season is mirrored in the database; playoff games arrive in other phases.
    const phase = $(roundEl).attr("data-phase");
    if (phase && phase !== "RS") return;

    $(roundEl)
      .find("section[data-game-id]")
      .each((__, gameEl) => {
        const id = Number($(gameEl).attr("data-game-id"));
        if (!Number.isInteger(id) || seen.has(id)) return;

        const date = DATE.exec($(gameEl).find(".game-date span").first().text());
        const teams = ($(gameEl).attr("data-team") ?? "").split(",").map(Number);
        if (!date || teams.length !== 2 || teams.some((t) => !Number.isInteger(t)) || !Number.isInteger(round)) {
          return;
        }

        seen.add(id);
        const [, day, month, year, hh, mm] = date;
        games.push({
          id,
          round,
          date: `${year}-${month}-${day}`,
          time: hh ? `${hh}:${mm}` : null,
          homeSourceId: teams[0],
          awaySourceId: teams[1],
        });
      });
  });

  return games;
}
