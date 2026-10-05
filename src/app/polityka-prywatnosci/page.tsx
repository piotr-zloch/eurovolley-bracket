import type { Metadata } from "next";
import LegalDocument, { type LegalSection } from "@/components/LegalDocument";
import { getLocale } from "@/lib/i18n-server";
import { LEGAL_DATE, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Polityka prywatności — Typer Szóstego Seta" };

export default async function PrivacyPage() {
  const locale = await getLocale();

  const sections: LegalSection[] = [
    {
      heading: "1. Administrator danych",
      body: [
        `Administratorem Twoich danych osobowych jest ${OPERATOR.name}, osoba fizyczna prowadząca serwis ${OPERATOR.site}. Kontakt w sprawach danych: ${OPERATOR.email}.`,
      ],
    },
    {
      heading: "2. Jakie dane przetwarzamy i po co",
      body: [
        [
          "Konto: adres e-mail, nazwa użytkownika, hasło (przechowywane wyłącznie w postaci zaszyfrowanej), data założenia konta i ostatniego logowania, wersja zaakceptowanego regulaminu i data akceptacji. Cel: prowadzenie konta i logowanie (art. 6 ust. 1 lit. b RODO — wykonanie umowy).",
          "Typy i odpowiedzi: typy tabeli, play-offów, wyników meczów, odpowiedzi w Jasnowidzu, członkostwo w grupach. Cel: działanie serwisu, punktacja i rankingi (art. 6 ust. 1 lit. b RODO).",
          "Ranking: Twoja nazwa użytkownika i punkty są widoczne dla innych zalogowanych użytkowników. Adres e-mail nie jest nikomu pokazywany.",
          "Odbiór nagrody: jeśli wygrasz, poprosimy o imię, nazwisko i adres do wysyłki. Cel: wydanie nagrody (art. 6 ust. 1 lit. b RODO) oraz ewentualne obowiązki podatkowe i rachunkowe (art. 6 ust. 1 lit. c RODO).",
          "Korespondencja: treść wiadomości, które do nas wyślesz, i adres nadawcy. Cel: odpowiedź na wiadomość i rozpatrzenie reklamacji (art. 6 ust. 1 lit. f RODO — nasz prawnie uzasadniony interes).",
          "Dane techniczne: adres IP i podstawowe dane żądań w dziennikach serwerów, wykorzystywane do bezpieczeństwa i wykrywania nadużyć (art. 6 ust. 1 lit. f RODO).",
          "Statystyka odwiedzin: anonimowe, zagregowane statystyki (Vercel Analytics), bez plików cookie i bez identyfikowania Cię między witrynami.",
        ],
        "Podanie danych jest dobrowolne, ale bez adresu e-mail, nazwy użytkownika i hasła nie można założyć konta.",
      ],
    },
    {
      heading: "3. Pliki cookie i pamięć przeglądarki",
      body: [
        "Używamy wyłącznie plików cookie i pamięci przeglądarki niezbędnych do działania serwisu. Nie używamy cookie reklamowych ani śledzących, dlatego nie wyświetlamy banera ze zgodą.",
        [
          "Sesja logowania (cookie ustawiane przez Supabase, nazwa zaczyna się od „sb-” i kończy na „-auth-token”): utrzymuje Cię zalogowanym. Ważne do 400 dni lub do wylogowania.",
          "Język (cookie „locale”): zapamiętuje wybór języka polskiego lub angielskiego. Ważne 365 dni.",
          "Wersja robocza typu (localStorage „typer-draft-v1”): zapamiętuje typ sezonu przygotowany bez konta, aby nie zginął przy zakładaniu konta. Zostaje w Twojej przeglądarce, dopóki go nie usuniesz lub nie zapiszesz typu na koncie.",
        ],
        "Pliki cookie możesz usunąć lub zablokować w ustawieniach przeglądarki; wtedy nie będzie działało logowanie.",
      ],
    },
    {
      heading: "4. Komu powierzamy dane",
      body: [
        "Dane przetwarzają w naszym imieniu dostawcy usług, z którymi mamy stosowne umowy:",
        [
          "Supabase — baza danych i uwierzytelnianie; dane przechowywane są w regionie UE,",
          "Vercel Inc. — hosting serwisu i anonimowa statystyka odwiedzin; dostawca może przetwarzać dane poza EOG, na podstawie standardowych klauzul umownych lub innego mechanizmu przewidzianego w RODO,",
          "dostawca poczty (do wysyłki wiadomości z potwierdzeniem konta i resetem hasła).",
        ],
        "Nie sprzedajemy danych i nie udostępniamy ich w celach reklamowych.",
      ],
    },
    {
      heading: "5. Jak długo przechowujemy dane",
      body: [
        [
          "Dane konta i typy — do usunięcia konta. Możesz je usunąć w każdej chwili w zakładce „Profil”.",
          "Konto nieużywane przez 12 miesięcy (brak logowania, odświeżenia sesji i zapisu typów) usuwamy automatycznie wraz z jego danymi.",
          "Dane do wydania nagrody i dokumenty z nią związane — tak długo, jak wymagają tego przepisy podatkowe i rachunkowe (zwykle 5 lat od końca roku), a potem je usuwamy.",
          "Korespondencja — do zakończenia sprawy, a następnie do czasu przedawnienia ewentualnych roszczeń.",
          "Dzienniki serwerów — krótko, zgodnie z ustawieniami dostawców hostingu.",
        ],
      ],
    },
    {
      heading: "6. Twoje prawa",
      body: [
        "Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie. Usunięcie konta wykonasz samodzielnie w zakładce „Profil”; w pozostałych sprawach napisz na adres " +
          OPERATOR.email +
          ".",
        "Masz też prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
        "Nie podejmujemy wobec Ciebie decyzji w sposób wyłącznie zautomatyzowany w rozumieniu art. 22 RODO; punkty i rankingi liczone są według jawnych reguł z regulaminu.",
      ],
    },
    {
      heading: "7. Źródła danych o rozgrywkach",
      body: [
        "Terminarz i wyniki meczów oraz listy zawodników i klubów pobieramy ze strony internetowej rozgrywek TAURON Liga. Są to dane o rozgrywkach, nie o użytkownikach serwisu.",
      ],
    },
    {
      heading: "8. Zmiany",
      body: [`Politykę możemy aktualizować. Aktualna wersja obowiązuje od dnia ${LEGAL_DATE}`],
    },
  ];

  return (
    <LegalDocument
      title="Polityka prywatności i cookies"
      version={`Wersja z dnia ${LEGAL_DATE}`}
      summary={
        locale === "en"
          ? "The binding text is in Polish. In short: we store your e-mail, username and your predictions to run the contest; your username and points are visible to other logged-in users, your e-mail never is. Only essential cookies are used (login session, language), so there is no cookie banner. Data is hosted by Supabase (EU) and Vercel. You can delete your account at any time from your Profile; accounts unused for 12 months are deleted automatically. Contact: " +
            OPERATOR.email
          : undefined
      }
      sections={sections}
      otherDocs={[
        { href: "/regulamin", label: "Regulamin serwisu" },
        { href: "/regulamin-konkursu", label: "Regulamin konkursu" },
      ]}
    />
  );
}
