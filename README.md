# Čtení textů na neděli — CČSH

Webová aplikace pro čtení textů pro aktuální neděli v jednoduchém knižním designu s důrazem na čitelnost. Texty jsou pro bohoslužby v Církvi československé husitské.

## Co aplikace umí

**Nedělní čtení** — Automaticky stahuje texty aktuální neděle z [cyklus.ccsh.cz](https://cyklus.ccsh.cz). Zobrazí 1. čtení, 2. čtení a evangelium v přehledném formátu.

**Značky pro přednes** — AI vygeneruje značky přímo do textu: pauzy (‖ krátká, ‖‖ dlouhá), změny tempa (▼ pomalu, ▲ normálně) a tučný text pro důraz. Lektor tak vidí na první pohled, kde zpomalit, kde se zastavit.

**Teologický průvodce** — Ke každému čtení dostanete úvod pro shromáždění, klíčové postavy, historický kontext, hlavní poselství a doporučený tón přednesu. Kde je to relevantní, průvodce cituje Základy víry CČSH.

**Inspirace z Farského postil** — Aplikace obsahuje postily Karla Farského (Český zápas, 1921–1924). K aktuálním čtením najde odpovídající kázání podle biblických odkazů a nabídne citáty, Farského pohled a podněty pro dnešní kázání.

**Tipy pro lektory** — 7 praktických rad pro přípravu a přednes (číst nahlas 3×, porozumět textu, pracovat s tichem, nahrát se…).

**Nastavení zobrazení** — Velikost písma (14–40 px), řádkování (1,4–3,0), tmavý / světlý režim.

**PWA** — Funguje jako mobilní aplikace. Lze nainstalovat na domovskou obrazovku, funguje i offline.

## Jak to funguje

```
cyklus.ccsh.cz
      │
      ▼
 warm-cache          ← cron job, každý den v 4:00 UTC
 (edge funkce)
      │
      ▼
  Supabase DB        ← readings_cache + ai_cache
      │
      ▼
   Frontend          ← načte data z DB, zobrazí z localStorage cache
      │
      ▼
 annotate-reading    ← AI edge funkce (3 režimy: značky, průvodce, postily)
 (on demand)
```

1. **warm-cache** — denně v 4:00 stáhne texty z cyklus.ccsh.cz a předgeneruje AI výstupy (značky, průvodce, postily)
2. **Frontend** — při otevření načte data z Supabase, cachuje v localStorage pro rychlé zobrazení
3. **annotate-reading** — pokud AI výstupy ještě nejsou v cache, vygenerují se na požádání

## Technologie

| Oblast | Technologie |
|--------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Literata + Playfair Display SC |
| Backend | Supabase (PostgreSQL, Edge Functions, pg_cron) |
| AI | Google Gemini 3 Flash (přes Lovable AI gateway) |
| Scraping | Firecrawl |
| PWA | vite-plugin-pwa + Workbox |
| Testy | Vitest, Testing Library |

## Struktura projektu

```
src/
├── pages/Index.tsx              # Hlavní stránka (state management, cache, lazy loading)
├── components/
│   ├── AnnotatedText.tsx        # Vykreslení textu se značkami pro přednes
│   ├── ReadingToolbar.tsx       # Ovládací panel (značky, zobrazení, průvodce, inspirace)
│   ├── ReadingContext.tsx       # Teologický průvodce (bottom sheet)
│   ├── PreachingInspiration.tsx # Farského postily (bottom sheet)
│   ├── LectorGuide.tsx         # 7 tipů pro lektory
│   ├── SectionProgress.tsx     # Indikátor aktuálního čtení (1./2./evangelium)
│   ├── AmbonMode.tsx           # Režim pro čtení z ambonu (auto-scroll)
│   └── ui/                     # shadcn/ui komponenty
├── lib/
│   ├── api/firecrawl.ts        # Stahování a cachování čtení
│   ├── analytics.ts            # Sledování událostí
│   └── utils.ts                # Pomocné funkce
└── integrations/supabase/      # Supabase klient a typy

supabase/
├── functions/
│   ├── annotate-reading/       # AI edge funkce (značky + průvodce + postily)
│   ├── warm-cache/             # Cron: předgenerování dat pro příští neděli
│   ├── import-corpus/          # Import teologických textů
│   ├── import-postily/         # Import Farského postil
│   └── _shared/                # Sdílené moduly (corpus, biblical-refs, postily)
└── migrations/                 # SQL migrace (tabulky, indexy, RLS)

scripts/
└── parse-postily.ts            # Parser OCR textu Farského postil → JSON
```

## Jak spustit lokálně

```bash
# 1. Naklonovat repozitář
git clone https://github.com/evapavlik/cteninanedeli.git
cd cteninanedeli

# 2. Nainstalovat závislosti
npm install

# 3. Vytvořit .env s klíči (Supabase URL, anon key)
#    viz .env.example nebo Lovable dashboard

# 4. Spustit vývojový server
npm run dev
```

Aplikace poběží na `http://localhost:8080`.

## Skripty

| Příkaz | Popis |
|--------|-------|
| `npm run dev` | Vývojový server s HMR |
| `npm run build` | Produkční build |
| `npm run preview` | Náhled produkčního buildu |
| `npm run test` | Spustit testy (jednorázově) |
| `npm run test:watch` | Testy ve watch režimu |
| `npm run lint` | ESLint kontrola |

## Vytvořeno s

Aplikace byla vytvořena pomocí [Lovable](https://lovable.dev) s láskou k poznání.

Autorka: **Eva Pavlíková**
