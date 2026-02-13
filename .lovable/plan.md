

# Nedělní čtení – Kazatelský cyklus CČSH

Jednoduchá aplikace pro klidnou sobotní přípravu na nedělní bohoslužbu. Černobílý, čistý design zaměřený výhradně na čitelnost textu.

## Jak to bude fungovat

Aplikace bude využívat **Firecrawl** (webový scraper) přes **Supabase Edge Function** k automatickému stažení aktuálního textu kazatelského cyklu ze stránky `ccsh.cz/cyklus.html`.

## Hlavní obrazovka

- **Minimalistická úvodní stránka** s názvem aktuální neděle (např. „Poslední neděle po Zjevení Páně") a datem
- **Tlačítko „Načíst nedělní čtení"** – po kliknutí se stáhne a zobrazí aktuální text
- Zobrazení plného textu kazatelského cyklu v přehledně formátovaném markdown:
  - Úvodní verš
  - První čtení z Písma
  - Tužby
  - Modlitba před čtením
  - Druhé čtení (epištola)
  - Evangelium
  - Případné další části (zpěv, slovo k požehnání)

## Design

- **Čistě černobílý** – černý text na bílém pozadí, žádné barvy
- **Velké, dobře čitelné písmo** (serif font pro duchovní text)
- **Dostatek prostoru** mezi jednotlivými čteními
- Jasně oddělené sekce (První čtení, Epištola, Evangelium…)
- Responzivní – pohodlné čtení na mobilu i tabletu
- Žádné rušivé prvky – jen text a čtení

## Backend (Firecrawl + Supabase Edge Function)

- Edge funkce, která pomocí Firecrawl stáhne obsah stránky `ccsh.cz/cyklus.html` ve formátu markdown
- Frontend zavolá tuto funkci a výsledný text přehledně zobrazí

