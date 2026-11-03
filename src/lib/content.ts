export type Lang = "pl" | "en";

export const content = {
  pl: {
    nav: { why: "Dlaczego", services: "Usługi", process: "Proces", faq: "FAQ", cta: "Umów konsultację" },
    hero: {
      eyebrow: "Doradztwo w samodzielnym przechowywaniu Bitcoina · Polska",
      title: "Twoje oszczędności. Twoje klucze. Niezależnie od tego, co stanie się za granicą.",
      sub: "Pomagamy Polakom i polskim firmom bezpiecznie przejąć pełną kontrolę nad Bitcoinem — bez giełd, bez pośredników, bez ryzyka zamrożenia konta.",
      cta: "Bezpłatna rozmowa wstępna",
      cta2: "Zobacz usługi",
    },
    why: {
      title: "Polska leży na granicy. Twój majątek nie musi.",
      sub: "Historia naszego regionu uczy jednego: pieniądze w banku są bezpieczne tylko do czasu, aż przestają być.",
      items: [
        { t: "Ryzyko wojny i ewakuacji", d: "Złota nie przewieziesz przez granicę, a nieruchomości nie zabierzesz ze sobą. 12 słów w pamięci pozwala odtworzyć majątek w dowolnym miejscu na świecie." },
        { t: "Zamrożone konta i kontrola kapitału", d: "Banki mogą zablokować przelewy, wprowadzić limity wypłat lub zamrozić środki z dnia na dzień. Bitcoin w samodzielnej custody nie ma przycisku „wyłącz”." },
        { t: "Upadki giełd i pośredników", d: "FTX, Mt. Gox, Celsius. „Nie twoje klucze, nie twoje monety.” Uczymy, jak wypłacić Bitcoina z giełdy i trzymać go samemu." },
        { t: "Inflacja i dewaluacja złotego", d: "Podaż Bitcoina jest ograniczona do 21 milionów. Żaden bank centralny nie może jej zwiększyć." },
      ],
    },
    services: {
      title: "Usługi",
      items: [
        { t: "Konsultacja startowa", p: "od 490 zł", d: "Rozmowa 1:1 (60 min). Ocena ryzyka, dobór portfela sprzętowego, plan działania." },
        { t: "Wdrożenie custody", p: "od 1 900 zł", d: "Konfiguracja portfela sprzętowego krok po kroku, kopia seeda na stali, test odzyskiwania, bezpieczna wypłata z giełdy." },
        { t: "Multisig i plan awaryjny", p: "od 4 900 zł", d: "Portfel wielopodpisowy 2-z-3 z kluczami w różnych lokalizacjach (także za granicą). Plan na wypadek ewakuacji." },
        { t: "Dziedziczenie i firmy", p: "wycena indywidualna", d: "Plan spadkowy dla rodziny, procedury dla zarządów i skarbców firmowych, dokumentacja dla doradcy podatkowego." },
      ],
    },
    process: {
      title: "Jak pracujemy",
      steps: [
        { t: "Rozmowa", d: "Poznajemy Twoją sytuację i model zagrożeń." },
        { t: "Plan", d: "Projektujemy rozwiązanie dopasowane do Ciebie." },
        { t: "Wdrożenie", d: "Konfigurujesz wszystko sam — my prowadzimy. Nigdy nie widzimy Twoich kluczy." },
        { t: "Wsparcie", d: "Testy odzyskiwania i pomoc w kolejnych miesiącach." },
      ],
    },
    trust: {
      title: "Nigdy nie dotykamy Twoich środków.",
      d: "Jesteśmy doradcami, nie powiernikami. Nie prosimy o seed, hasła ani przelewy. Wszystko dzieje się na Twoich urządzeniach, pod Twoją kontrolą.",
    },
    faq: {
      title: "Najczęstsze pytania",
      items: [
        { q: "Czy muszę znać się na technologii?", a: "Nie. Prowadzimy Cię krok po kroku, prostym językiem, po polsku." },
        { q: "Czy samodzielne przechowywanie jest legalne w Polsce?", a: "Tak. Posiadanie Bitcoina i trzymanie go we własnym portfelu jest w pełni legalne. Pamiętaj o rozliczeniu PIT-38 przy sprzedaży." },
        { q: "Co jeśli muszę nagle wyjechać z kraju?", a: "Projektujemy plan tak, abyś mógł odzyskać środki za granicą — nawet bez portfela sprzętowego przy sobie." },
        { q: "Czy pracujecie zdalnie?", a: "Tak — online w całej Polsce i dla Polonii, a także spotkania osobiste w Warszawie i Krakowie." },
      ],
    },
    contact: {
      title: "Zacznij od bezpłatnej rozmowy.",
      sub: "15 minut, bez zobowiązań. Odpowiadamy w ciągu 24 godzin.",
      name: "Imię", email: "E-mail", msg: "Czego chcesz się dowiedzieć?", send: "Wyślij", sent: "Podgląd formularza — wiadomość nie została wysłana.",
    },
    footer: "Treści mają charakter edukacyjny i nie stanowią porady inwestycyjnej.",
  },
  en: {
    nav: { why: "Why", services: "Services", process: "Process", faq: "FAQ", cta: "Book a call" },
    hero: {
      eyebrow: "Bitcoin self-custody consulting · Poland",
      title: "Your savings. Your keys. Whatever happens across the border.",
      sub: "We help individuals and businesses in Poland take full, secure control of their Bitcoin — no exchanges, no middlemen, no risk of frozen accounts.",
      cta: "Free intro call",
      cta2: "See services",
    },
    why: {
      title: "Poland sits on the frontier. Your wealth doesn't have to.",
      sub: "Our region's history teaches one lesson: money in the bank is safe only until it isn't.",
      items: [
        { t: "War and evacuation risk", d: "You can't carry gold across a border or take property with you. 12 words in your memory can restore your wealth anywhere in the world." },
        { t: "Frozen accounts and capital controls", d: "Banks can block transfers, cap withdrawals or freeze funds overnight. Self-custodied Bitcoin has no off switch." },
        { t: "Exchange and custodian failures", d: "FTX, Mt. Gox, Celsius. Not your keys, not your coins. We show you how to withdraw and hold it yourself." },
        { t: "Inflation and złoty devaluation", d: "Bitcoin's supply is capped at 21 million. No central bank can print more." },
      ],
    },
    services: {
      title: "Services",
      items: [
        { t: "Starter consultation", p: "from 490 PLN", d: "1:1 call (60 min). Risk assessment, hardware wallet selection, action plan." },
        { t: "Custody setup", p: "from 1,900 PLN", d: "Step-by-step hardware wallet setup, steel seed backup, recovery test, safe exchange withdrawal." },
        { t: "Multisig & contingency plan", p: "from 4,900 PLN", d: "2-of-3 multisig with keys in separate locations (including abroad). An evacuation-ready plan." },
        { t: "Inheritance & business", p: "custom quote", d: "Family inheritance plans, board and treasury procedures, documentation for your tax advisor." },
      ],
    },
    process: {
      title: "How we work",
      steps: [
        { t: "Talk", d: "We learn your situation and threat model." },
        { t: "Plan", d: "We design a setup tailored to you." },
        { t: "Set up", d: "You configure everything yourself — we guide. We never see your keys." },
        { t: "Support", d: "Recovery drills and help in the months after." },
      ],
    },
    trust: {
      title: "We never touch your funds.",
      d: "We are advisors, not custodians. We never ask for your seed, passwords or transfers. Everything happens on your devices, under your control.",
    },
    faq: {
      title: "FAQ",
      items: [
        { q: "Do I need to be technical?", a: "No. We guide you step by step in plain language, in Polish or English." },
        { q: "Is self-custody legal in Poland?", a: "Yes. Owning Bitcoin and holding it in your own wallet is fully legal. Remember to report sales on PIT-38." },
        { q: "What if I have to leave the country suddenly?", a: "We design your plan so you can recover funds abroad — even without your hardware wallet on you." },
        { q: "Do you work remotely?", a: "Yes — online across Poland and for Poles abroad, plus in-person meetings in Warsaw and Kraków." },
      ],
    },
    contact: {
      title: "Start with a free call.",
      sub: "15 minutes, no obligation. We reply within 24 hours.",
      name: "Name", email: "Email", msg: "What would you like to learn?", send: "Send", sent: "Form preview — your message has not been sent.",
    },
    footer: "Content is educational and does not constitute investment advice.",
  },
} as const;
