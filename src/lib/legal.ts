// Facts used by the legal pages (terms, contest rules, privacy policy). Edit them here; the pages
// read from this file, so a change appears everywhere at once.

export const OPERATOR = {
  name: "Piotr Złoch",
  email: "6tyset@gmail.com",
  /**
   * Postal address for correspondence, shown in the documents when set. null = not published: the
   * organizer is a private person and the e-mail is then the only contact.
   */
  address: null as string | null,
  site: "typer.szostyset.pl",
  facebook: "https://www.facebook.com/6tyset",
  x: "https://twitter.com/SzostySet",
};

/** Bump when a document changes materially; stored with each signup as the version accepted. */
export const LEGAL_VERSION = "2026-10-05";
export const LEGAL_DATE = "5 października 2026 r.";

export const CONTEST = {
  season: "2026/27",
  /** The moment season predictions and Jasnowidz answers close (Polish time). */
  firstBall: "16 października 2026 r., godz. 17:30",
  /**
   * TO BE FILLED IN BY THE ORGANIZER before the rules are published: what is awarded for places 1-3
   * in each ranking. Left visibly marked so it cannot go live unnoticed.
   */
  prizes: "[DO UZUPEŁNIENIA PRZEZ ORGANIZATORA: rodzaj nagród za miejsca 1, 2 i 3 w każdym z rankingów]",
};
