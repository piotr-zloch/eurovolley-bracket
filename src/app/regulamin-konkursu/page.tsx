import type { Metadata } from "next";
import LegalDocument, { type LegalSection } from "@/components/LegalDocument";
import { getLocale } from "@/lib/i18n-server";
import { CONTEST, LEGAL_DATE, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Regulamin konkursu — Typer Szóstego Seta" };

export default async function ContestRulesPage() {
  const locale = await getLocale();

  const sections: LegalSection[] = [
    {
      heading: "§ 1 Postanowienia ogólne",
      body: [
        `1. Konkurs „Typer Szóstego Seta — TAURON Liga ${CONTEST.season}”, w skład którego wchodzą rankingi „Ranking Typer” i „Ranking Jasnowidz” („Konkurs”), organizuje ${OPERATOR.name} („Organizator”), kontakt: ${OPERATOR.email}.`,
        "2. Konkurs jest konkursem opartym na wiedzy i umiejętności przewidywania wyników rozgrywek, a nie grą losową, zakładem wzajemnym ani loterią. O wyniku decyduje trafność typów, nie przypadek. Udział jest bezpłatny i nie wymaga żadnych wpłat ani zakupów.",
        "3. Konkurs nie jest organizowany, sponsorowany ani popierany przez Polską Ligę Siatkówki, organizatorów rozgrywek TAURON Liga ani żadne kluby.",
        "4. Konkurs odbywa się w serwisie typer.szostyset.pl i podlega Regulaminowi serwisu, z którym Regulamin konkursu stanowi całość.",
      ],
    },
    {
      heading: "§ 2 Uczestnicy",
      body: [
        "1. W Konkursie może wziąć udział każda osoba fizyczna posiadająca konto w serwisie, która w dniu zgłoszenia ukończyła 18 lat (albo osoba niepełnoletnia za pisemną zgodą rodzica lub opiekuna, okazaną na żądanie Organizatora).",
        "2. Uczestnik ma jedno konto. Wiele kont tej samej osoby prowadzi do wykluczenia ze wszystkich z nich.",
        "3. Udział w Konkursie jest dobrowolny i następuje przez zapisanie typów lub odpowiedzi na swoim koncie.",
      ],
    },
    {
      heading: "§ 3 Czas trwania",
      body: [
        `1. Konkurs obejmuje sezon TAURON Liga ${CONTEST.season}, od dnia opublikowania Regulaminu do zakończenia sezonu i ogłoszenia wyników.`,
        `2. Typ sezonu (tabela i play-offy) oraz odpowiedzi w grze „Jasnowidz” można zapisywać i zmieniać do pierwszej piłki sezonu: ${CONTEST.firstBall} (czas polski). Po tym terminie są zablokowane. Typy meczowe można zapisywać i zmieniać do rozpoczęcia danego meczu.`,
      ],
    },
    {
      heading: "§ 4 Zasady Konkursu",
      body: [
        "1. Ranking Typer powstaje z punktów za: trafne ułożenie tabeli sezonu zasadniczego, trafne typy par i zwycięzców play-offów oraz trafne wyniki meczów w setach. Szczegółowa punktacja znajduje się na stronie „Zasady” przy rozgrywkach i jest częścią Regulaminu.",
        "2. Ranking Jasnowidz powstaje z punktów za poprawne odpowiedzi na pytania o sezon (łącznie 36 pytań). Za każde pytanie przysługuje liczba punktów podana przy tym pytaniu. W przypadku pytań liczbowych punkty mogą być przyznawane za odpowiedź dokładną albo zbliżoną, zgodnie z opisem pytania.",
        "3. Poprawną odpowiedź na pytanie ustala Organizator na podstawie oficjalnych danych rozgrywek (wyniki, tabele i statystyki publikowane przez organizatora ligi) po zakończeniu sezonu lub odpowiedniego etapu. Organizator może uznać kilka odpowiedzi za poprawne, np. przy remisie.",
        "4. Jeśli pytanie stanie się nierozstrzygalne lub bezprzedmiotowe (np. z powodu zmiany formatu rozgrywek), Organizator może je unieważnić; punkty za nie nie są wtedy przyznawane nikomu.",
        "5. Przy równej liczbie punktów o wyższym miejscu decyduje: w Rankingu Typer — większa liczba punktów za typy meczowe; w Rankingu Jasnowidz — większa liczba poprawnych odpowiedzi. Jeśli remis nadal trwa, uczestnicy dzielą miejsce, a o przyznaniu nagrody rozstrzyga losowanie przeprowadzone przez Organizatora.",
        "6. Wyniki są dostępne w serwisie na bieżąco. Wyniki ostateczne ogłasza Organizator po zakończeniu sezonu w serwisie oraz w swoich kanałach w mediach społecznościowych.",
      ],
    },
    {
      heading: "§ 5 Nagrody",
      body: [
        `1. Nagrody otrzymują uczestnicy, którzy zajmą miejsca 1–3 w każdym z rankingów Konkursu. Nagrody: ${CONTEST.prizes}`,
        "2. Nagrody nie podlegają wymianie na ekwiwalent pieniężny. Prawo do nagrody nie może być przeniesione na inną osobę.",
        "3. Organizator skontaktuje się ze zwycięzcami przez adres e-mail konta w ciągu 14 dni od ogłoszenia wyników. Jeśli zwycięzca nie odpowie w ciągu 14 dni od wysłania wiadomości, jego prawo do nagrody wygasa, a nagroda przechodzi na kolejną osobę w rankingu.",
        "4. Koszty wysyłki nagród na terenie Polski ponosi Organizator. Do odbioru nagrody niezbędne jest podanie danych potrzebnych do jej wydania (imię i nazwisko, adres do wysyłki); dane te służą wyłącznie do tego celu.",
        "5. Organizator nie pobiera podatku od nagród w imieniu uczestnika i nie odpowiada za jego zobowiązania podatkowe, jeśli takie wynikają z przepisów.",
      ],
    },
    {
      heading: "§ 6 Wykluczenie",
      body: [
        "1. Organizator może wykluczyć uczestnika, który naruszył Regulamin, w szczególności prowadził wiele kont, korzystał z programów automatycznych, manipulował rankingami albo używał nazwy naruszającej Regulamin serwisu.",
        "2. Wykluczony uczestnik traci prawo do nagrody; nagroda przechodzi na kolejną osobę w rankingu.",
      ],
    },
    {
      heading: "§ 7 Reklamacje",
      body: [
        `1. Reklamacje dotyczące przebiegu Konkursu i przyznania punktów można składać na adres ${OPERATOR.email} w terminie 14 dni od ogłoszenia wyników, podając adres e-mail konta i opis zastrzeżeń.`,
        "2. Organizator rozpatruje reklamację w ciągu 14 dni od jej otrzymania i odpowiada na adres e-mail, z którego została zgłoszona. Decyzja Organizatora jest ostateczna w zakresie Konkursu, co nie wyłącza prawa do dochodzenia roszczeń na drodze sądowej.",
      ],
    },
    {
      heading: "§ 8 Dane osobowe",
      body: [
        "Administratorem danych osobowych uczestników jest Organizator. Zasady przetwarzania danych, w tym danych podawanych w związku z odbiorem nagrody, opisuje Polityka prywatności.",
      ],
    },
    {
      heading: "§ 9 Postanowienia końcowe",
      body: [
        "1. Organizator może zmienić Regulamin Konkursu tylko w zakresie niepogarszającym sytuacji uczestników albo gdy wymaga tego przepis prawa lub zmiana formatu rozgrywek; o zmianie informuje w serwisie.",
        "2. Organizator może zakończyć lub przerwać Konkurs z ważnych przyczyn (np. odwołanie rozgrywek), informując o tym w serwisie.",
        "3. W sprawach nieuregulowanych stosuje się Regulamin serwisu oraz prawo polskie.",
      ],
    },
  ];

  return (
    <LegalDocument
      title={`Regulamin konkursu „Typer Szóstego Seta — TAURON Liga ${CONTEST.season}”`}
      version={`Wersja z dnia ${LEGAL_DATE}`}
      summary={
        locale === "en"
          ? `The binding text is in Polish. In short: a free skill-based prediction contest for the ${CONTEST.season} TAURON Liga season, two rankings (Typer and Jasnowidz). Season picks and Jasnowidz answers lock at the first ball (${CONTEST.firstBall}). The top 3 in each ranking win prizes; winners are contacted by e-mail.`
          : undefined
      }
      sections={sections}
      otherDocs={[
        { href: "/regulamin", label: "Regulamin serwisu" },
        { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
      ]}
    />
  );
}
