# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt — Čtení textů na neděli

Webová aplikace pro Církev československou husitskou (CČSH). Zobrazuje nedělní biblická čtení s AI anotacemi, teologickým průvodcem a inspirací z postil Karla Farského.

- **Autorka:** Eva Pavlíková
- **Původně vytvořeno v:** [Lovable](https://lovable.dev), prošlo refaktoringem a migrací na vlastní infrastrukturu (Vercel + Supabase)
- **Aktuální workflow:** kombinace Lovable (prototypování UI) + přímá práce s kódem (GitHub + Claude Code). Hlavní vývoj probíhá v kódu.
- **Uživatelé:** lektoři (čtení textů) a kazatelé (inspirace pro kázání). Do budoucna může přibýt další funkcionalita i obsah.
- **Klíčová hodnota:** jednoduchost pro uživatele. Raději aplikace, která dělá málo věcí skvěle, než přeplněná aplikace. Pokud bude funkcí příliš, může se rozdělit do více samostatných aplikací.

## Tech stack

| Oblast | Technologie |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite (port 8080) |
| Styling | Tailwind CSS + shadcn/ui, fonty Literata (serif) + Playfair Display SC (nadpisy) |
| Backend | Supabase — PostgreSQL, Edge Functions (Deno), pg_cron |
| AI | Google Gemini 2.5 Flash, free tier (5 RPM, 250K TPM). API klíč v Supabase secrets (`GEMINI_API_KEY`). Limity ověřuj v [AI Studio → Rate Limit](https://aistudio.google.com/rate-limit). |
| Scraping | Firecrawl |
| Testy | Vitest + Testing Library |
| PWA | vite-plugin-pwa + Workbox |

## Klíčové příkazy

```bash
npm run dev          # Vývojový server (localhost:8080)
npm run build        # Produkční build — spustit po každé změně pro kontrolu TS chyb
npm run build:dev    # Development build (rychlejší, bez minifikace)
npm run test         # Vitest testy (jednorázově)
npm run test:watch   # Vitest ve watch režimu
npm run lint         # ESLint

# Spuštění jednoho testu:
npx vitest run src/test/cache.test.ts
```

- Testy žijí v `src/test/` a `supabase/functions/_shared/` (oba adresáře jsou zahrnuty v `vitest.config.ts`)
- Test environment: jsdom (s `@testing-library/jest-dom` matchers)
- TypeScript: loose mode (`noImplicitAny: false`, `strictNullChecks: false`)
- Path alias: `@/` → `./src/`

## Architektura a datový tok

```
cyklus.ccsh.cz → warm-cache (cron 4:00 UTC) → Supabase DB
                                                    ↓
Frontend → readings_cache → useReadings hook → useAIData hook → UI
                                                    ↓
                                          annotate-reading (edge funkce)
                                          5 režimů: annotate | context | postily | czech_zapas | ccsh_kazani
```

- **Cache:** ai_cache tabulka (server) + localStorage (klient, CACHE_VERSION = 6)
- **Invalidace:** useReadings detekuje změnu nedělního obsahu → zvýší `invalidationEpoch` → useAIData smaže stará AI data

## Konvence kódu

- **UI texty:** česky (to, co vidí uživatel)
- **Kód, komentáře, commit messages:** anglicky
- Komponenty: PascalCase, named exports, props typované interfacem (`*Props` suffix)
- Hooks: `use*` prefix, v `src/hooks/`
- Supabase funkce: Deno runtime, sdílené moduly v `_shared/`
- Styling: Tailwind utility classes, žádné CSS moduly

## Struktura projektu

```
src/
├── pages/
│   ├── Index.tsx                # Hlavní stránka (orchestrace)
│   ├── AdminImport.tsx          # Admin import rozhraní
│   └── NotFound.tsx             # 404 stránka
├── hooks/
│   ├── useReadings.ts           # Fetch čtení + invalidace cache
│   ├── useAIData.ts             # AI data (context, postily, anotace)
│   ├── useVoiceRecorder.ts      # Nahrávání hlasu pro nácvik přednesu
│   ├── use-mobile.tsx           # Detekce mobilního breakpointu (768px)
│   └── use-toast.ts             # Toast notifikace (stav)
├── components/
│   ├── AnnotatedText.tsx        # Text se značkami pro přednes
│   ├── ReadingToolbar.tsx       # Ovládací panel
│   ├── AudioPlayback.tsx        # Mini přehrávač nahrávky
│   ├── ReadingContext.tsx       # Teologický průvodce (bottom sheet)
│   ├── PreachingInspiration.tsx # Farského postily (bottom sheet)
│   ├── NotificationButton.tsx   # Push notifikace (subscribe/unsubscribe)
│   ├── LectorGuide.tsx          # 7 tipů pro lektory
│   ├── SectionProgress.tsx      # Indikátor aktuálního čtení
│   ├── ErrorBoundary.tsx        # React error boundary
│   ├── AmbonMode.tsx            # Auto-scroll režim pro ambon (zatím neintegrován)
│   └── ui/                      # shadcn/ui (používá se jen 5: sheet, sonner, tooltip, toaster, toast)
├── lib/
│   ├── cache.ts                 # Generický localStorage cache helper
│   ├── utils.ts                 # cn() helper (clsx + tailwind-merge)
│   ├── api/firecrawl.ts         # Stahování čtení
│   └── analytics.ts             # Sledování událostí (trackEvent)
├── test/                        # Vitest testy (setup.ts, cache, ai-labels…)
└── integrations/supabase/       # Klient + generované typy

supabase/
├── functions/
│   ├── annotate-reading/        # AI edge funkce (značky + průvodce + postily)
│   ├── warm-cache/              # Cron: předgenerování pro příští neděli
│   ├── import-corpus/           # Import teologických textů
│   ├── import-postily/          # Import Farského postil
│   ├── import-czech-zapas/      # Import článků z Českého zápasu
│   ├── import-ccsh-kazani/ # Import kázání z ccsh.cz/kazani.html
│   ├── send-monday-notifications/ # Push notifikace (pg_cron pondělí 6:00 UTC)
│   └── _shared/
│       ├── prompts.ts           # AI prompt šablony
│       ├── corpus.ts            # Teologický kontext (Základy víry CČSH)
│       ├── biblical-refs.ts     # Normalizace biblických odkazů (SINGLE SOURCE OF TRUTH)
│       ├── postily.ts           # Matching postil + czech_zapas + ccsh_kazani podle bibl. referencí
│       ├── ccsh-kazani-scraper.ts # Scraper kázání z ccsh.cz/kazani.html
│       └── html-parser.ts       # Fallback HTML scraping (direct fetch bez Firecrawl)
└── migrations/                  # 10 SQL migrací

scripts/
└── parse-postily.ts             # OCR parser Farského postil → JSON
```

## Na co dávat pozor

- **Neměnit prompt šablony** v `_shared/prompts.ts` a `_shared/corpus.ts` bez konzultace — jsou citlivě vyladěné pro CČSH teologii
- **Nemazat shadcn/ui komponenty** bez ověření — po refaktoringu zůstalo přesně 5 používaných
- **biblical-refs.ts** je single source of truth pro normalizaci biblických odkazů — netvořit kopie
- **CACHE_VERSION** v `src/lib/cache.ts` — při změně struktury cache zvýšit
- **Lovable** se občas používá na prototypy — může přidat UI komponenty zpět do `src/components/ui/`, je to normální
- Edge funkce běží v **Deno** (ne Node) — importy přes URL, ne npm. Bundle limit ~20 MB (Deno Deploy) — velké npm balíčky (pdfjs-dist, sharp…) způsobí deploy error. Těžká výpočetní zátěž (PDF parsing, zpracování obrázků) patří do prohlížeče, ne do edge funkce.
- **Gemini API problémy** — při 429/400 chybách NEJDŘÍV zkontroluj [AI Studio → Rate Limit](https://aistudio.google.com/rate-limit) dashboard. Ukazuje aktuální RPM limity per model. Free tier modely mají nízké limity (5 RPM) a Google může kdykoli model vypnout (RPM → 0). Nehádej příčinu z kódu — dashboard řekne pravdu za 10 sekund.

## Supabase

- **Project ID:** `uedluysdwvcdrhjiotjc`
- **Klíčové tabulky:** readings_cache, ai_cache, postily, czech_zapas_articles, ccsh_kazani, corpus_documents, theological_profiles, push_subscriptions
- **Postily matching:** GIN index na `biblical_references` + PostgreSQL overlap operator (`&&`)
- **RLS:** všechny tabulky veřejně čitelné, zápis jen přes service role
- **push_subscriptions RLS:** anon může INSERT a DELETE, SELECT jen service_role. Důsledek: pro zápis z frontendu použij prostý INSERT (ne upsert) — upsert potřebuje SELECT pro detekci konfliktu, jinak selže s 42501 → HTTP 401. Chybu 23505 (unique_violation) považuj za úspěch.
- **Diagnostika Supabase 401:** HTTP 401 s `proxy_status: "PostgREST; error=42501"` neznamená špatný JWT — znamená PostgreSQL `insufficient_privilege` (RLS nebo chybějící GRANT). JWT sekce v logu ukáže, jestli je role správně rozpoznaná.

## Infrastruktura (dokončeno únor 2026)

Projekt běží na vlastní infrastruktuře — **Vercel** (frontend) + **vlastní Supabase** (backend). Migrace z Lovable hostingu je kompletní.

- **Hosting:** Vercel (napojeno na GitHub, automatický deploy)
- **Supabase projekt:** `uedluysdwvcdrhjiotjc`
- **Edge funkce:** annotate-reading, warm-cache, import-corpus, import-postily, import-czech-zapas, import-ccsh-kazani, send-monday-notifications
- **Secrets:** GEMINI_API_KEY, FIRECRAWL_API_KEY (v Supabase)
- **pg_cron:** warm-cache běží denně v 4:00 UTC, send-monday-notifications v pondělí 6:00 UTC
- **Data:** migrace schématu (10 migrací), corpus, postily, readings_cache, ai_cache — vše importováno
- **Analytics:** Vercel Web Analytics (`@vercel/analytics/react` v `src/App.tsx`)
- **CI/CD:** GitHub Actions (`.github/workflows/deploy-edge-functions.yml`) — deploy edge funkcí při push do `main` (cesta `supabase/functions/**`), podporuje i ruční spuštění

## Spolupráce s Evou

- **Jazyk:** Eva komunikuje česky, neformálně, na tykačku. Odpovídej stejně — česky, stručně, bez formálností.
- **Lovable + Claude Code = tým:** Eva občas prototypuje UI v Lovable, hlavní vývoj probíhá přes GitHub + Claude Code. Claude pomáhá s implementací, refaktoringem, architekturou a složitějšími úpravami.
- **Diskuse před implementací:** Eva ráda probere možnosti, než se pustí do kódu. Často začíná brainstormingem. Neptej se hned na technické detaily — nejdřív pomoz prozkoumat nápady.
- **Produkt > kód:** Eva přemýšlí z pohledu uživatele (lektoři, kazatelé CČSH), ne z pohledu vývojáře. Při vysvětlování mluv o tom, co uživatel uvidí, ne o implementačních detailech.
- **Ověřuj před odpovědí:** Než odpovíš na technickou otázku, ověř si fakta v kódu. Neodpovídej z paměti — přečti si relevantní soubor. Typické chyby z minulosti: tvrzení o tom, jak funguje cache (plní se cronem, ne on-demand), tvrzení že export nemá smysl (měl), opakované ptaní se na věci, které jsme už vyřešili. Radši řekni „ověřím" než abys střílel od boku.
- **Architektura respektuje deployment kontext:** Před volbou knihovny nebo přístupu zkontroluj, kde kód poběží a jaká jsou tam omezení (bundle size pro edge funkce, API rate limity, runtime rozdíly). Předvídatelná omezení se řeší v návrhu, ne po deploy failuře. Typický příklad: pdfjs-dist v edge funkci → 31 MB bundle → limit překročen → zbytečná iterace.
- **Iterativní přístup:** Pracujeme po krocích — plán → schválení → implementace → ověření. Nedělej velké změny bez odsouhlasení.
- **Testy jsou součást implementace:** Každá nová utilita nebo funkce mimo komponentu musí mít test. Nečekej na review — piš testy souběžně s kódem. Testovatelnost = funkce v samostatném modulu (ne inline v komponentě). jsdom nepodporuje File.arrayBuffer — mocku přes `{ arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File`. Platí i pro nové features jako push notifikace — pokud tam test chybí, je to dluh, ne hotová funkce.
- **Vývojářští kamarádi:** Eva má kolem sebe vývojáře, kteří jí radí s technickými věcmi. Občas přijde s jejich nápady. Beri to jako validní vstup.
- **Kód jako první krok:** Než navrhnu jakýkoliv fix nebo diagnózu, přečtu relevantní soubory. Kód se čte dřív než se spouští SQL dotazy nebo klade otázky Evě. Příklad chyby: NotificationButton.tsx byl otevřen až ve třetím kole — kdybych začal tam, viděl jsem problém hned.
- **Jedna diagnóza, jedno řešení:** Navrhnu jedno finální řešení, ne sérii pokusů ("zkus X, zkus Y, zkus Z"). Pokud si nejsem jistý, nejdřív spustím diagnostický dotaz, pak dám fix — ne obojí jako iteraci.
- **Minimalizovat manuální kroky pro Evu:** Eva není programátor. Každý manuální krok v Supabase dashboardu, Vercelu nebo terminálu musí být nevyhnutelný a musí fungovat na první pokus. "Spusť tento SQL, zkus znovu, pošli log" jako série pokusů je nepřijatelné. Pokud potřebuji informace, ověřím je sám v kódu.
- **Frontend → Supabase:** vždy přes Supabase JS klienta (`supabase.from(...)`) — nikdy přímý `fetch()` s ručním API klíčem. Klient má klíč správně nakonfigurovaný, ruční fetch je křehký a může selhat v produkci.
- **iOS PWA push notifikace:** `Notification.requestPermission()` může vrátit `"default"` (dialog zavřen bez výběru) — to není `"denied"`. Pokud dostaneš `"default"`, nech tlačítko aktivní a umožni opakování.
- **Učení se:** Eva se chce v technologiích neustále zlepšovat. Při vysvětlování přidej krátké „proč" — vysvětli principy, ne jen řešení. Nebuď přednáškový, ale posunuj znalosti krok za krokem.
- **Teologický kontext:** Aplikace slouží CČSH — specifická česká církev s husitskou tradicí. Klíčové texty: Základy víry CČSH, postily Karla Farského. Při práci s teologickým obsahem buď citlivý a přesný.
- **Vize a směr:** Aplikace se rozrůstá — nejen o nový obsah (další autoři z Českého zápasu), ale i o funkce (pomůcky pro kazatele). Eva přemýšlí o tom, jestli to časem bude jedna aplikace nebo více menších. Klíčové pravidlo: jednoduchost pro uživatele je nad vše. Při navrhování nových funkcí vždy zvažuj, jestli to aplikaci nekomplikuje.
