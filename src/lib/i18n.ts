export type Locale = "pl" | "en";
export const LOCALES: Locale[] = ["pl", "en"];
export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_COOKIE = "locale";

// This module is imported by Client Components too, so it must stay free of `next/headers`.
// Cookie reading lives in ./i18n-server.

// `pl` is deliberately not `as const`: its string literals widen to `string`, so it can serve
// as the shared shape. Typing `en` as Dict then makes a missing or misspelled key a build error.
const pl = {
    appName: "Typer ME 2026",
    tournamentLong: "Mistrzostwa Europy 2026",
    groupLabel: "Grupa {code}",

    nav: {
      predictions: "Twoje typy",
      leaderboard: "Ranking",
      groups: "Moje grupy",
      admin: "Admin",
      signOut: "Wyloguj",
    },

    auth: {
      signInTitle: "Zaloguj się, aby typować.",
      signUpTitle: "Załóż konto, aby typować.",
      email: "E-mail",
      password: "Hasło",
      username: "Nazwa użytkownika",
      logIn: "Zaloguj się",
      signUp: "Załóż konto",
      noAccount: "Nie masz konta?",
      haveAccount: "Masz już konto?",
      usernameHelp: "Widoczna w rankingu. Twój e-mail nie jest nigdzie pokazywany.",
    },

    welcome: {
      title: "Wybierz nazwę użytkownika",
      intro: "Tak będziesz widoczny w rankingu. Twój adres e-mail nie jest pokazywany nikomu.",
      continue: "Dalej",
    },

    predictions: {
      title: "Twoje typy",
      intro:
        "Ustaw kolejność w każdej grupie, a drabinka pucharowa ułoży się automatycznie na podstawie Twoich typów.",
      groupStage: "Faza grupowa",
      groupStageHint: "Przeciągnij uchwyt ⠿, aby ustawić przewidywaną kolejność (1. miejsce na górze).",
      knockout: "Faza pucharowa",
      knockoutHint:
        "Drabinka jest tworzona z Twoich typów grupowych według oficjalnego klucza CEV (A1–C4, C2–A3, D1–B4, B2–D3, C1–A4, A2–C3, B1–D4, D2–B3). Kliknij zwycięzcę każdego meczu.",
      knockoutIncomplete: "Uzupełnij typy dla {groups}, aby wypełnić brakujące miejsca w drabince.",
      roundOf16: "1/8 finału",
      quarterfinals: "Ćwierćfinały",
      semifinals: "Półfinały",
      final: "Finał",
      bronze: "Mecz o 3. miejsce",
      tbd: "—",
      save: "Zapisz typy",
      saving: "Zapisywanie…",
      saved: "Zapisano!",
      saveError: "Nie udało się zapisać.",
      unsaved: "Masz niezapisane zmiany.",
      groupsLink: "Grasz ze znajomymi?",
      groupsLinkCta: "Załóż lub dołącz do grupy",
      groupsLinkTail: "aby porównać typy w rankingu.",
    },

    leaderboard: {
      globalTitle: "Ranking ogólny",
      globalIntro: "Wszyscy gracze, według liczby punktów.",
      privateGroupsLink: "Twoje prywatne grupy",
      privateGroupsTail: "mają własne rankingi.",
      noResults:
        "Nie ma jeszcze wyników — ranking wypełni się po rozpoczęciu turnieju (9 września 2026).",
      rank: "#",
      player: "Gracz",
      groupsCol: "Grupy",
      bracketCol: "Drabinka",
      total: "Razem",
      you: "(Ty)",
      owner: "właściciel",
      noPlayers: "Brak graczy.",
      rules:
        "Za każdą drużynę w grupie: 10 punktów minus 4 za każde miejsce różnicy względem Twojego typu (możliwe wyniki ujemne). Trafiony typ w drabince: 4 punkty za 1/8 finału, 8 za ćwierćfinał, 16 za półfinał, 16 za mecz o 3. miejsce i 32 za finał.",
      playersOne: "1 gracz",
      playersFew: "{n} gracze",
      playersMany: "{n} graczy",
      inviteCode: "Kod zaproszenia",
      shareInvite: "podaj znajomym kod",
      backToGroups: "← Moje grupy",
      myPredictions: "Moje typy",
      notFound: "Nie znaleziono grupy lub nie masz do niej dostępu.",
    },

    groups: {
      title: "Twoje grupy typerskie",
      intro: "Opcjonalne — załóż lub dołącz do grupy, aby porównać typy ze znajomymi w rankingu.",
      introLinkText: "Twoje typy",
      introTail: "są zapisywane niezależnie.",
      yourUsername: "Twoja nazwa użytkownika",
      usernameHelp: "Tak jesteś widoczny w rankingu. Twój e-mail nie jest pokazywany.",
      save: "Zapisz",
      none: "Nie masz jeszcze żadnej grupy — załóż lub dołącz poniżej.",
      leaderboardLink: "ranking",
      createTitle: "Załóż grupę",
      createPlaceholder: "Nazwa grupy",
      create: "Załóż",
      joinTitle: "Dołącz do grupy",
      joinPlaceholder: "Kod zaproszenia",
      join: "Dołącz",
      back: "← Wróć do typów",
    },

    admin: {
      title: "Panel administratora",
      intro:
        "Wprowadzaj tutaj prawdziwe wyniki w trakcie turnieju. Nadpisuje to dane pobrane przez scraper — oba zapisują do tych samych tabel.",
      recompute: "Przelicz punkty",
      recomputing: "Przeliczanie…",
      recomputed: "Punkty zaktualizowane.",
      recomputeError: "Błąd — sprawdź, czy masz uprawnienia administratora.",
      groupFinal: "Faza grupowa — końcowa kolejność",
      knockoutResults: "Wyniki fazy pucharowej",
      winner: "— zwycięzca —",
      position: "poz.",
      save: "Zapisz",
      noAccess: "Nie masz uprawnień administratora.",
    },

    common: {
      noTournament: "Nie skonfigurowano jeszcze turnieju.",
      language: "Język",
    },
};

export type Dict = typeof pl;

const en: Dict = {
    appName: "Typer ME 2026",
    tournamentLong: "European Championship 2026",
    groupLabel: "Group {code}",

    nav: {
      predictions: "Your predictions",
      leaderboard: "Leaderboard",
      groups: "My groups",
      admin: "Admin",
      signOut: "Sign out",
    },

    auth: {
      signInTitle: "Sign in to start predicting.",
      signUpTitle: "Create an account to start predicting.",
      email: "Email",
      password: "Password",
      username: "Username",
      logIn: "Log in",
      signUp: "Sign up",
      noAccount: "Don't have an account?",
      haveAccount: "Already have an account?",
      usernameHelp: "Shown on leaderboards. Your email is never displayed.",
    },

    welcome: {
      title: "Choose your username",
      intro: "This is how you'll appear on leaderboards. Your email is never shown to anyone.",
      continue: "Continue",
    },

    predictions: {
      title: "Your tournament prediction",
      intro:
        "Set the finishing order in each group and the knockout bracket builds itself from your picks.",
      groupStage: "Group stage",
      groupStageHint: "Drag the ⠿ handle to set your predicted finishing order (1st at top).",
      knockout: "Knockout bracket",
      knockoutHint:
        "Built from your group predictions using the official CEV crossover (A1–C4, C2–A3, D1–B4, B2–D3, C1–A4, A2–C3, B1–D4, D2–B3). Click the winner of each match.",
      knockoutIncomplete: "Finish predicting {groups} to fill the remaining bracket slots.",
      roundOf16: "Round of 16",
      quarterfinals: "Quarterfinals",
      semifinals: "Semifinals",
      final: "Final",
      bronze: "Bronze medal match",
      tbd: "—",
      save: "Save predictions",
      saving: "Saving…",
      saved: "Saved!",
      saveError: "Could not save.",
      unsaved: "You have unsaved changes.",
      groupsLink: "Playing with friends?",
      groupsLinkCta: "Create or join a group",
      groupsLinkTail: "to compare predictions on a leaderboard.",
    },

    leaderboard: {
      globalTitle: "Global leaderboard",
      globalIntro: "Every player, ranked by total points.",
      privateGroupsLink: "Your private groups",
      privateGroupsTail: "have their own leaderboards.",
      noResults: "No results yet — the leaderboard fills in once the tournament starts (9 Sep 2026).",
      rank: "#",
      player: "Player",
      groupsCol: "Groups",
      bracketCol: "Bracket",
      total: "Total",
      you: "(you)",
      owner: "owner",
      noPlayers: "No players yet.",
      rules:
        "Each team in a group scores 10 points minus 4 for every place it finishes away from your prediction (negatives possible). A correct bracket pick scores 4 for the round of 16, 8 for a quarterfinal, 16 for a semifinal, 16 for the bronze medal match and 32 for the final.",
      playersOne: "1 player",
      playersFew: "{n} players",
      playersMany: "{n} players",
      inviteCode: "Invite code",
      shareInvite: "share the invite code",
      backToGroups: "← My groups",
      myPredictions: "My predictions",
      notFound: "Group not found, or you don't have access.",
    },

    groups: {
      title: "Your prediction groups",
      intro:
        "Optional — create or join a group to compare your predictions with friends on a leaderboard.",
      introLinkText: "Your predictions",
      introTail: "are saved either way.",
      yourUsername: "Your username",
      usernameHelp: "How you appear on leaderboards. Your email is never shown.",
      save: "Save",
      none: "No groups yet — create or join one below.",
      leaderboardLink: "leaderboard",
      createTitle: "Create a group",
      createPlaceholder: "Group name",
      create: "Create",
      joinTitle: "Join a group",
      joinPlaceholder: "Invite code",
      join: "Join",
      back: "← Back to my predictions",
    },

    admin: {
      title: "Admin panel",
      intro:
        "Enter real results here as the tournament plays out. This overrides whatever the scraper picked up — both write to the same tables.",
      recompute: "Recompute all scores",
      recomputing: "Recomputing…",
      recomputed: "Scores updated.",
      recomputeError: "Failed — check you have admin access.",
      groupFinal: "Group stage — final standings",
      knockoutResults: "Knockout results",
      winner: "— winner —",
      position: "pos",
      save: "Save",
      noAccess: "You don't have admin access.",
    },

    common: {
      noTournament: "No tournament configured yet.",
      language: "Language",
    },
};

export const dict: Record<Locale, Dict> = { pl, en };

/**
 * Substitutes {name} placeholders. Dictionary entries are plain strings rather than functions
 * because the whole dict is passed into Client Components, and React can only serialize data —
 * a single function anywhere in the object makes the entire prop unserializable.
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

/** Polish needs three plural forms (1 / 2-4 / 5+); English collapses to two. */
export function plural(d: Dict, n: number): string {
  if (n === 1) return d.leaderboard.playersOne;
  const lastTwo = n % 100;
  const last = n % 10;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return fmt(few ? d.leaderboard.playersFew : d.leaderboard.playersMany, { n });
}
