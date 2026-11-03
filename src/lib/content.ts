export type Lang = "pl" | "en";

export const content = {
  pl: {
    meta: {
      title: "Custody Consulting — Twój bitcoin. Twoje klucze. Jasny plan.",
      description: "Indywidualne wsparcie w samodzielnym przechowywaniu bitcoina. Portfele sprzętowe, kopie zapasowe i plan odzyskiwania. Po polsku i angielsku, dla klientów w Europie.",
    },
    nav: { why: "Po co plan", services: "Usługi", process: "Jak pracujemy", faq: "FAQ", blog: "Baza wiedzy", cta: "Porozmawiajmy", label: "Nawigacja główna", language: "Wybierz język" },
    hero: {
      eyebrow: "Samodzielne przechowywanie bitcoina · Europa",
      title: "Twój bitcoin. Twoje klucze. Jasny plan.",
      sub: "Pomagamy osobom prywatnym, rodzinom i firmom wybrać portfel, przygotować kopie zapasowe i przećwiczyć odzyskiwanie dostępu. Krok po kroku, po polsku lub angielsku.",
      cta: "Znajdź wsparcie dla siebie",
      cta2: "Zobacz, jak pracujemy",
      signals: ["Klucze pozostają u Ciebie", "Wsparcie po polsku i angielsku", "Plan dopasowany do Twojej sytuacji"],
    },
    why: {
      label: "ZACZNIJ OD PODSTAW",
      title: "Sam portfel to dopiero początek.",
      sub: "Dobry plan obejmuje codzienną obsługę, utratę urządzenia i sytuacje, w których potrzebna będzie pomoc bliskich.",
      items: [
        { t: "Kontrola nad dostępem", d: "Trzymając bitcoin na giełdzie, polegasz na jej zasadach i dostępności. We własnym portfelu zarządzasz kluczami — i odpowiadasz za ich ochronę." },
        { t: "Kopie, które potrafisz odtworzyć", d: "Kopia zapasowa pomaga tylko wtedy, gdy jest kompletna, chroniona i zrozumiała. Zaplanuj sposób jej przechowywania i sprawdź procedurę odzyskiwania." },
        { t: "Rozwiązanie do codziennego użytku", d: "Więcej urządzeń i podpisów nie zawsze oznacza lepszy wybór. System powinien odpowiadać Twoim potrzebom i być możliwy do samodzielnej obsługi." },
        { t: "Ciągłość dla Ciebie i bliskich", d: "Przeprowadzka, utrata urządzenia lub nagła nieobecność nie powinny zostawiać rodziny bez instrukcji. Uwzględnij dostęp awaryjny już na etapie planowania." },
      ],
    },
    services: {
      title: "Wsparcie na Twoim etapie",
      sub: "Zacznij od konsultacji lub wybierz konkretny zakres pomocy. Nie musisz z góry wiedzieć, jaki portfel będzie odpowiedni.",
      note: "Cena zależy od zakresu pomocy. Całkowity koszt ustalamy przed rozpoczęciem współpracy.",
      items: [
        { t: "Konsultacja startowa", p: "od 490 zł", d: "Rozmowa 1:1 (60 min) o obecnym sposobie przechowywania, obawach i priorytetach.", outcome: "Efekt: lista decyzji i kolejnych kroków." },
        { t: "Portfel i kopie zapasowe", p: "od 1 900 zł", d: "Wsparcie przy konfiguracji portfela sprzętowego, przygotowaniu kopii i wykonaniu testowej transakcji.", outcome: "Efekt: przećwiczona obsługa i odzyskiwanie dostępu." },
        { t: "Multisig i plan awaryjny", p: "od 4 900 zł", d: "Ocena, czy wiele podpisów ma sens w Twojej sytuacji. Jeśli tak: plan podziału kluczy, lokalizacji i odzyskiwania.", outcome: "Efekt: udokumentowane zasady dostępu i działania w razie problemów." },
        { t: "Rodzina i firma", p: "wycena indywidualna", d: "Instrukcje dla bliskich lub zespołu, podział odpowiedzialności oraz procedury dostępu awaryjnego.", outcome: "Efekt: dokumentacja do omówienia z rodziną, zespołem i doradcą prawnym." },
      ],
    },
    process: {
      title: "Od pytań do przećwiczonego planu",
      steps: [
        { t: "Poznajemy potrzeby", d: "Omawiamy Twoje doświadczenie, sposób korzystania z bitcoina i to, czego chcesz uniknąć." },
        { t: "Wybieramy podejście", d: "Porównujemy możliwości, koszty i kompromisy. Ustalamy zakres pracy oraz kolejne kroki." },
        { t: "Konfigurujesz i ćwiczysz", d: "Pracujesz na własnych urządzeniach. Pomagamy zrozumieć procedury i przeprowadzić kontrolowany test odzyskiwania." },
        { t: "Ustalasz plan przeglądów", d: "Zapisujesz instrukcje i momenty, w których warto do nich wrócić. Dalsze wsparcie ustalamy osobno." },
      ],
    },
    trust: {
      title: "Twoje klucze pozostają prywatne.",
      d: "Nie przyjmujemy bitcoina do przechowywania. Nie udostępniaj konsultantowi frazy odzyskiwania, kluczy prywatnych ani haseł. Pomagamy Ci obsługiwać własny system, zachowując te dane dla siebie.",
      note: "Samodzielne przechowywanie wiąże się z odpowiedzialnością. Żaden portfel ani proces nie usuwa wszystkich ryzyk.",
    },
    faq: {
      title: "Pytania przed pierwszą rozmową",
      items: [
        { q: "Czy muszę mieć wiedzę techniczną?", a: "Nie musisz znać się na kryptografii ani umieć programować. Zaczynamy od Twojego poziomu wiedzy i wyjaśniamy każdą decyzję. Potrzebna jest gotowość do nauki i przećwiczenia procedur." },
        { q: "Czy przechowujecie moje bitcoiny lub klucze?", a: "Nie. Usługa obejmuje edukację i wsparcie we wdrożeniu. Zachowujesz kontrolę nad środkami i poufnymi danymi portfela. Nie wysyłaj nam kopii zapasowych ani frazy odzyskiwania." },
        { q: "Czy potrzebuję portfela multisig?", a: "Niekoniecznie. Wiele podpisów może ograniczać niektóre ryzyka, ale zwiększa liczbę elementów do obsługi i odtworzenia. Najpierw oceniamy potrzeby oraz to, kto będzie korzystał z systemu." },
        { q: "Czy mogę pracować z Wami spoza Polski?", a: "Oferta jest skierowana do klientów w Europie, po polsku i angielsku. Formę spotkań oraz dostępność ustalamy przed rozpoczęciem współpracy." },
        { q: "Czy doradzacie w sprawie inwestycji, podatków lub dziedziczenia?", a: "Zakres obejmuje przechowywanie i procedury dostępu. Nie obejmuje rekomendacji inwestycyjnych ani porad prawnych czy podatkowych. Dokumentację dotyczącą dziedziczenia warto omówić z odpowiednio wykwalifikowanym doradcą w swoim kraju." },
      ],
    },
    contact: {
      title: "Zacznij od swoich pytań.",
      sub: "Nie musisz wybierać portfela przed rozmową. Warto najpierw zastanowić się, czego potrzebujesz od swojego systemu.",
      panelTitle: "Co warto przygotować",
      prompts: ["Czy dopiero zaczynasz, czy masz już własny portfel?", "Co najbardziej Cię niepokoi: obsługa, kopie czy dostęp dla bliskich?", "Kto będzie korzystał z portfela i utrzymywał plan?"],
      status: "Rezerwacja konsultacji wkrótce",
      availability: "Możliwość kontaktu pojawi się tutaj po uruchomieniu rezerwacji.",
      privacy: "Do pierwszej rozmowy nie potrzebujemy salda, adresów portfela ani frazy odzyskiwania.",
    },
    footer: "Edukacja i wsparcie w samodzielnym przechowywaniu bitcoina. Bez przejmowania środków lub kluczy. Bez porad inwestycyjnych, prawnych i podatkowych.",
  },
  en: {
    meta: {
      title: "Custody Consulting — Your bitcoin. Your keys. A clear plan.",
      description: "Personal guidance for Bitcoin self-custody. Hardware wallets, backups and recovery planning for individuals, families and businesses across Europe. English and Polish.",
    },
    nav: { why: "Why a plan", services: "Services", process: "Our approach", faq: "FAQ", blog: "Knowledge base", cta: "Let’s talk", label: "Main navigation", language: "Choose language" },
    hero: {
      eyebrow: "Bitcoin self-custody consulting · Europe",
      title: "Your bitcoin. Your keys. A clear plan.",
      sub: "We help individuals, families and businesses choose a wallet, prepare backups and practise recovery. Step by step, in English or Polish.",
      cta: "Find the support you need",
      cta2: "See how we work",
      signals: ["You keep your keys", "English and Polish", "A plan for your situation"],
    },
    why: {
      label: "START WITH THE FOUNDATIONS",
      title: "A wallet is only the beginning.",
      sub: "A useful plan covers everyday transactions, a lost device and the times when someone close to you may need to help.",
      items: [
        { t: "Control over access", d: "Keeping bitcoin on an exchange means relying on its rules and availability. With your own wallet, you manage the keys — and take responsibility for protecting them." },
        { t: "Backups you can recover", d: "A backup helps only if it is complete, protected and understood. Plan where it belongs and test the steps needed to restore access." },
        { t: "A setup you can operate", d: "More devices and signatures do not always make a better choice. Your setup should match your needs and be manageable without ongoing help." },
        { t: "Continuity for you and your family", d: "Moving home, losing a device or becoming unexpectedly unavailable should not leave your family without instructions. Include emergency access from the start." },
      ],
    },
    services: {
      title: "Support for where you are now",
      sub: "Start with a consultation or choose a specific area of help. You do not need to know which wallet is right for you before we talk.",
      note: "Prices depend on the scope of support. We agree the total cost before work begins.",
      items: [
        { t: "Starter consultation", p: "from 490 PLN", d: "A 1:1 conversation (60 minutes) about your current approach, concerns and priorities.", outcome: "You leave with decisions to consider and practical next steps." },
        { t: "Wallets and backups", p: "from 1,900 PLN", d: "Guidance through hardware wallet setup, backup preparation and a test transaction.", outcome: "You practise operating your wallet and restoring access." },
        { t: "Multisig and contingency planning", p: "from 4,900 PLN", d: "Assess whether multiple signatures suit your situation. If they do, plan key distribution, locations and recovery.", outcome: "You document access rules and what to do if something goes wrong." },
        { t: "Family and business continuity", p: "custom quote", d: "Instructions for family or team members, clear responsibilities and emergency access procedures.", outcome: "You prepare documentation to discuss with family, colleagues and legal advisers." },
      ],
    },
    process: {
      title: "From open questions to a practised plan",
      steps: [
        { t: "Understand your needs", d: "We discuss your experience, how you use bitcoin and the situations you want to prepare for." },
        { t: "Choose an approach", d: "We compare options, costs and trade-offs, then agree on the scope and next steps." },
        { t: "Set up and practise", d: "You work on your own devices. We help you understand the procedures and carry out a controlled recovery test." },
        { t: "Plan your reviews", d: "You document instructions and decide when to revisit them. Any further support is agreed separately." },
      ],
    },
    trust: {
      title: "Your keys stay private.",
      d: "We do not hold bitcoin for clients. Do not share recovery words, private keys or passwords with a consultant. We help you operate your own setup while keeping those details to yourself.",
      note: "Self-custody comes with responsibility. No wallet or process removes every risk.",
    },
    faq: {
      title: "Before our first conversation",
      items: [
        { q: "Do I need technical experience?", a: "You do not need to understand cryptography or write code. We start with what you know and explain each decision. You do need to be willing to learn and practise the procedures." },
        { q: "Will you hold my bitcoin or keys?", a: "No. The service covers education and implementation guidance. You retain control of your funds and wallet secrets. Do not send us backups or recovery words." },
        { q: "Do I need multisig?", a: "Not necessarily. Multiple signatures can reduce some risks while adding more elements to operate and recover. We first consider your needs and who will use the setup." },
        { q: "Can I work with you from outside Poland?", a: "The service is intended for clients across Europe, in English and Polish. Meeting arrangements and availability are agreed before work begins." },
        { q: "Do you advise on investments, tax or inheritance law?", a: "The scope covers custody and access procedures. It does not include investment recommendations, legal advice or tax advice. Inheritance documentation should be reviewed with appropriately qualified advisers in your jurisdiction." },
      ],
    },
    contact: {
      title: "Start with your questions.",
      sub: "You do not need to choose a wallet before we talk. First, consider what you need your setup to do.",
      panelTitle: "What to think about",
      prompts: ["Are you getting started, or do you already have a wallet?", "What concerns you most: daily use, backups or family access?", "Who will operate the wallet and maintain the plan?"],
      status: "Consultation booking coming soon",
      availability: "Contact options will appear here when booking opens.",
      privacy: "We do not need balances, wallet addresses or recovery words for an introductory conversation.",
    },
    footer: "Education and guidance for Bitcoin self-custody. We do not take custody of funds or keys, or provide investment, legal or tax advice.",
  },
} as const;
