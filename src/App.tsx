import { useEffect, useState } from "react";
import logoUrl from "@/assets/custody-logo-white.png";
import hero from "@/assets/hero-vault.jpg";
import { content, type Lang } from "@/lib/content";

export default function App() {
  const [lang, setLang] = useState<Lang>("pl");
  const t = content[lang];
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  }, [lang, t]);

  return (
    <div lang={lang} className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top"><img src={logoUrl} alt="Custody Consulting" className="h-9 w-auto" /></a>
          <nav aria-label={t.nav.label} className="hidden gap-6 text-sm text-muted-foreground lg:flex">
            <a href="#why" className="hover:text-foreground">{t.nav.why}</a>
            <a href="#services" className="hover:text-foreground">{t.nav.services}</a>
            <a href="#process" className="hover:text-foreground">{t.nav.process}</a>
            <a href="#faq" className="hover:text-foreground">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-3">
            <div role="group" aria-label={t.nav.language} className="flex rounded border text-xs font-medium">
              {(["pl", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-label={l === "pl" ? "Polski" : "English"} aria-pressed={lang === l}
                  className={`min-h-11 min-w-11 px-2.5 py-1.5 uppercase ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
            <a href="#contact" className="hidden rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:inline-block">{t.nav.cta}</a>
          </div>
        </div>
      </header>

      <main>
      <section id="top" className="relative overflow-hidden">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-32">
          <p className="mb-6 flex items-center gap-3 text-sm uppercase tracking-widest text-primary"><span className="dot" />{t.hero.eyebrow}</p>
          <h1 className="max-w-3xl text-balance text-4xl font-black leading-[1.12] md:text-6xl">{t.hero.title}</h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">{t.hero.sub}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#services" className="rounded bg-primary px-6 py-3 font-semibold text-primary-foreground">{t.hero.cta}</a>
            <a href="#process" className="rounded border px-6 py-3 font-semibold hover:border-primary">{t.hero.cta2}</a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-sm text-muted-foreground">
            {t.hero.signals.map((signal) => <li key={signal} className="flex items-center gap-2"><span className="dot text-primary" aria-hidden="true" />{signal}</li>)}
          </ul>
        </div>
      </section>

      <section id="why" className="mx-auto max-w-6xl px-6 py-24">
        <p className="mb-4 text-xs font-bold tracking-widest text-primary">{t.why.label}</p>
        <h2 className="max-w-3xl text-balance text-3xl font-black md:text-5xl">{t.why.title}</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t.why.sub}</p>
        <div className="mt-14 grid gap-px overflow-hidden rounded border bg-border md:grid-cols-2">
          {t.why.items.map((i, n) => (
            <div key={i.t} className="bg-background p-8">
              <span className="font-display text-sm text-primary">0{n + 1}</span>
              <h3 className="mt-3 text-xl font-bold">{i.t}</h3>
              <p className="mt-3 text-muted-foreground">{i.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="bg-paper py-24 text-paper-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-black md:text-5xl">{t.services.title}<span className="text-primary">.</span></h2>
          <p className="mt-5 max-w-2xl text-paper-foreground/75">{t.services.sub}</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {t.services.items.map((s) => (
              <article key={s.t} className="flex flex-col rounded border border-paper-foreground/15 p-7 md:p-8">
                <h3 className="text-lg font-bold">{s.t}</h3>
                <p className="mt-3 flex-1 text-sm opacity-75">{s.d}</p>
                <p className="mt-5 border-t border-paper-foreground/15 pt-4 text-sm font-medium">{s.outcome}</p>
                <p className="mt-5 font-display text-lg font-bold text-paper-foreground">{s.p}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-paper-foreground/75">{t.services.note}</p>
        </div>
      </section>

      <section id="process" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl font-black md:text-5xl">{t.process.title}</h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-4">
          {t.process.steps.map((s, n) => (
            <li key={s.t} className="border-t-2 border-primary pt-5">
              <span className="font-display text-4xl font-black text-primary">{n + 1}</span>
              <h3 className="mt-2 text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-20 rounded bg-card p-10 md:p-14">
          <h3 className="text-2xl font-black md:text-4xl"><span className="dot mr-3" />{t.trust.title}</h3>
          <p className="mt-4 max-w-2xl text-muted-foreground">{t.trust.d}</p>
          <p className="mt-5 max-w-2xl border-t pt-5 text-sm text-muted-foreground">{t.trust.note}</p>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-3xl font-black md:text-5xl">{t.faq.title}</h2>
        <div className="mt-10 divide-y border-y">
          {t.faq.items.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none justify-between font-semibold">
                {f.q}<span className="text-primary group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="contact" className="bg-primary py-24 text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black md:text-5xl">{t.contact.title}</h2>
            <p className="mt-4 text-lg opacity-80">{t.contact.sub}</p>
            <p className="mt-8 max-w-md border-t border-primary-foreground/25 pt-5 text-sm">{t.contact.privacy}</p>
          </div>
          <div className="rounded border border-primary-foreground/20 bg-background p-7 text-foreground md:p-9">
            <h3 className="text-xl font-bold">{t.contact.panelTitle}</h3>
            <ul className="mt-5 space-y-4 text-sm text-muted-foreground">
              {t.contact.prompts.map((prompt) => <li key={prompt} className="flex gap-3"><span className="mt-1 text-primary" aria-hidden="true">→</span><span>{prompt}</span></li>)}
            </ul>
            <div className="mt-7 border-t pt-6">
              <p className="font-semibold text-primary">{t.contact.status}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t.contact.availability}</p>
            </div>
          </div>
        </div>
      </section>

      </main>
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row">
        <img src={logoUrl} alt="Custody Consulting" className="h-7 w-auto" />
        <p className="max-w-xl text-center text-xs leading-relaxed md:text-left">{t.footer}</p>
        <p>© {new Date().getFullYear()} Custody Consulting</p>
      </footer>
    </div>
  );
}
