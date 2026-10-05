import type { Metadata } from "next";
import LegalDocument, { type LegalSection } from "@/components/LegalDocument";
import { getLocale } from "@/lib/i18n-server";
import { LEGAL_DATE, OPERATOR } from "@/lib/legal";

export const metadata: Metadata = { title: "Regulamin serwisu — Typer Szóstego Seta" };

export default async function TermsPage() {
  const locale = await getLocale();

  const sections: LegalSection[] = [
    {
      heading: "§ 1 Postanowienia ogólne",
      body: [
        `1. Regulamin określa zasady korzystania z serwisu internetowego „Typer Szóstego Seta”, dostępnego pod adresem ${OPERATOR.site} („Serwis”).`,
        `2. Usługodawcą i administratorem Serwisu jest ${OPERATOR.name}, osoba fizyczna nieprowadząca w związku z Serwisem działalności gospodarczej („Organizator”)${OPERATOR.address ? `, adres do korespondencji: ${OPERATOR.address}` : ""}. Kontakt: ${OPERATOR.email}.`,
        "3. Serwis jest nieoficjalnym, hobbystycznym serwisem kibiców. Nie jest powiązany z Polską Ligą Siatkówki, organizatorami rozgrywek TAURON Liga ani z żadnym klubem. Nazwy rozgrywek i klubów służą wyłącznie do opisania tego, czego dotyczą typy.",
        "4. Korzystanie z Serwisu jest bezpłatne.",
        "5. Serwis nie jest grą hazardową ani zakładem wzajemnym. Nie przyjmuje wpłat ani stawek, a typowanie nie polega na obstawianiu pieniędzy.",
      ],
    },
    {
      heading: "§ 2 Usługi i wymagania techniczne",
      body: [
        "1. W ramach Serwisu można: typować tabelę sezonu i play-offy rozgrywek oraz wyniki meczów w setach, odpowiadać na pytania o sezon w grze „Jasnowidz”, tworzyć prywatne grupy i dołączać do nich, przeglądać rankingi i statystyki.",
        "2. Bez konta można przeglądać strony informacyjne i przygotować typ sezonu, który do czasu założenia konta jest przechowywany wyłącznie w przeglądarce. Zapis typów, udział w rankingach, typowanie meczów i Jasnowidz wymagają konta.",
        "3. Wymagania techniczne: aktualna przeglądarka internetowa z włączoną obsługą JavaScript i plików cookie oraz dostęp do internetu. Do założenia konta potrzebny jest adres e-mail.",
      ],
    },
    {
      heading: "§ 3 Konto użytkownika",
      body: [
        "1. Konto zakłada się, podając nazwę użytkownika, adres e-mail i hasło. Umowa o prowadzenie konta zostaje zawarta z chwilą założenia konta i zaakceptowania Regulaminu. Organizator może wymagać potwierdzenia adresu e-mail przez kliknięcie w link przesłany wiadomością.",
        "2. Z Serwisu mogą korzystać osoby pełnoletnie oraz osoby niepełnoletnie za zgodą rodzica lub opiekuna prawnego.",
        "3. Każdy użytkownik ma jedno konto. Zabronione jest zakładanie wielu kont, udostępnianie konta innym osobom oraz używanie programów automatycznych (botów).",
        "4. Nazwa użytkownika jest widoczna dla innych zalogowanych użytkowników w rankingach. Nie może zawierać adresu e-mail, treści wulgarnych, obraźliwych ani naruszających prawa osób trzecich i nie może podszywać się pod inną osobę. Organizator może zmienić lub zablokować nazwę niezgodną z Regulaminem.",
        "5. Użytkownik jest odpowiedzialny za zachowanie hasła w tajemnicy.",
      ],
    },
    {
      heading: "§ 4 Typowanie, punktacja i wyniki",
      body: [
        "1. Szczegółowe zasady punktacji i terminy opisuje strona „Zasady” przy danych rozgrywkach, która stanowi integralną część Regulaminu.",
        "2. Typ sezonu i odpowiedzi w Jasnowidzu można zmieniać do pierwszej piłki sezonu, a typy meczowe do pierwszej piłki danego meczu. Po tych terminach zmiany nie są możliwe.",
        "3. Wyniki meczów są pobierane z oficjalnej strony rozgrywek automatycznie albo wprowadzane ręcznie przez Organizatora. Organizator dokłada starań, aby były poprawne, i może je skorygować; po korekcie punkty i rankingi są przeliczane ponownie.",
        "4. Statystyki typów innych użytkowników są udostępniane dopiero po zamknięciu typowania, aby nikt nie typował na podstawie cudzych typów.",
        "5. W sprawach spornych, w tym dotyczących wyniku meczu, rozstrzyga Organizator na podstawie Regulaminu i oficjalnych danych rozgrywek.",
      ],
    },
    {
      heading: "§ 5 Grupy prywatne",
      body: [
        "1. Użytkownik może założyć prywatną grupę i zapraszać do niej innych kodem zaproszenia. Ranking grupy widzą jej członkowie.",
        "2. Właścicielem grupy jest jej założyciel. Po usunięciu konta właściciela grupa przechodzi na jej najdłużej należącego członka, a jeśli nie ma innych członków, jest usuwana.",
      ],
    },
    {
      heading: "§ 6 Zakazane zachowania",
      body: [
        "1. Użytkownikowi zabrania się dostarczania treści o charakterze bezprawnym.",
        "2. Zabronione jest również: zakłócanie działania Serwisu, próby nieautoryzowanego dostępu do danych lub kont, wykorzystywanie błędów Serwisu, manipulowanie rankingami oraz działania sprzeczne z Regulaminem.",
        "3. W razie naruszeń Organizator może ostrzec użytkownika, zmienić jego nazwę, wykluczyć go z rankingów albo zablokować lub usunąć jego konto.",
      ],
    },
    {
      heading: "§ 7 Usunięcie konta i rozwiązanie umowy",
      body: [
        "1. Użytkownik może w każdej chwili usunąć swoje konto w zakładce „Profil”. Usunięcie powoduje usunięcie jego typów, odpowiedzi, członkostw w grupach i danych konta, z wyjątkiem danych, które Organizator musi zachować z mocy prawa. Usunięcie konta rozwiązuje umowę o jego prowadzenie.",
        "2. Konto, z którego nie korzystano przez 12 miesięcy (brak logowania, odświeżenia sesji i zapisu typów lub odpowiedzi), zostaje usunięte automatycznie, bez dodatkowego powiadomienia.",
        "3. Organizator może zablokować lub usunąć konto naruszające Regulamin.",
      ],
    },
    {
      heading: "§ 8 Odpowiedzialność",
      body: [
        "1. Serwis jest udostępniany w stanie, w jakim jest. Organizator nie gwarantuje nieprzerwanego działania i nie odpowiada za przerwy wynikające z awarii dostawców usług, siły wyższej ani za błędy w danych źródłowych — w zakresie, w jakim prawo na to pozwala. Regulamin nie wyłącza uprawnień przysługujących konsumentom z mocy bezwzględnie obowiązujących przepisów.",
      ],
    },
    {
      heading: "§ 9 Reklamacje",
      body: [
        `1. Reklamacje dotyczące działania Serwisu można zgłaszać na adres ${OPERATOR.email}, podając adres e-mail konta i opis problemu.`,
        "2. Organizator rozpatruje reklamację w ciągu 14 dni od jej otrzymania i odpowiada na adres e-mail, z którego została zgłoszona.",
      ],
    },
    {
      heading: "§ 10 Dane osobowe",
      body: ["Zasady przetwarzania danych osobowych, w tym informacje o plikach cookie, opisuje Polityka prywatności."],
    },
    {
      heading: "§ 11 Postanowienia końcowe",
      body: [
        "1. Organizator może zmienić Regulamin z ważnych przyczyn (zmiany przepisów, zmiany w Serwisie). Zmiany są publikowane w Serwisie i obowiązują od chwili publikacji, a w odniesieniu do użytkowników, którzy mają już konto — po upływie 14 dni od publikacji. Użytkownik, który się z nimi nie zgadza, może usunąć konto.",
        "2. W sprawach nieuregulowanych stosuje się prawo polskie. Konsumentom przysługują uprawnienia wynikające z bezwzględnie obowiązujących przepisów.",
        `3. Regulamin obowiązuje od dnia ${LEGAL_DATE}`,
      ],
    },
  ];

  return (
    <LegalDocument
      title="Regulamin serwisu „Typer Szóstego Seta”"
      version={`Wersja z dnia ${LEGAL_DATE}`}
      summary={
        locale === "en"
          ? "The binding text is in Polish. In short: this is a free, unofficial fan site run by a private person. One account per person, no bots, a respectful username. Predictions lock at the first ball; results come from the league's official site. You can delete your account at any time from your Profile, and accounts unused for 12 months are deleted automatically."
          : undefined
      }
      sections={sections}
      otherDocs={[
        { href: "/regulamin-konkursu", label: "Regulamin konkursu" },
        { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
      ]}
    />
  );
}
