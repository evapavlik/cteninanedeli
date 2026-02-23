

# Vizualni zmeny pro lepsi citelnost na mobilu

## Problem
Aplikace ma na mobilnich zarizenich problemy s citelnosti:
1. **Nizky kontrast** -- texty pouzivaji `text-foreground/60`, `text-muted-foreground` a dalsi oslabene barvy, ktere jsou na mobilech spatne citelne
2. **Male texty u tlacitek** -- toolbar tlacitka (Pruvodce, Inspirace, Znacky pro prednes) pouzivaji `text-sm` (14px), coz je na mobilu malo
3. **Male popisky v panelech** -- kategorie jako "Uvod pro shromazdeni", "Klicove postavy" pouzivaji `text-xs` (12px) s `text-foreground/60`
4. **SectionProgress prehled** -- navigacni pilulky maji `text-xs` a slaby kontrast u neaktivnich polozek

## Navrzene zmeny

### 1. Toolbar tlacitka -- vetsi dotyková plocha a text
- Zvetsit `text-sm` na `text-base` na mobilu (16px)
- Zvetsit padding z `px-4 py-2.5` na `px-5 py-3` na mobilu
- Zvetsit ikony z `h-4 w-4` na `h-5 w-5` na mobilu

### 2. SectionProgress -- vetsi text a lepsi kontrast
- Zvetsit `text-xs` na `text-sm` na mobilu
- Neaktivni polozky: zmenit `text-muted-foreground` na `text-foreground/70` pro lepsi kontrast
- Zvetsit padding pilulek z `px-3 py-1.5` na `px-4 py-2`

### 3. Panely Pruvodce a Inspirace -- lepsi kontrast popisku
- Kategorie (napr. "Klicove postavy"): zmenit `text-foreground/60` na `text-foreground/80`
- Zvetsit z `text-xs` na `text-sm` (14px)
- Disclaimer texty: zmenit z `text-xs` na `text-sm`

### 4. Lector Guide -- lepsi kontrast
- Podtitulek "7 praktickych tipu": zmenit `text-foreground/60` na `text-foreground/70`

### 5. Globalni kontrast v CSS
- `--muted-foreground` v light modu: zmenit z `0 0% 45%` na `0 0% 35%` (tmavsi seda = lepsi kontrast)
- `--border` v light modu: zmenit z `0 0% 85%` na `0 0% 78%` (viditelnejsi ramecky)

## Technicke detaily

Zmeny se tykaji techto souboru:

| Soubor | Zmena |
|---|---|
| `src/index.css` | Uprava CSS promennych pro vyssi kontrast |
| `src/components/ReadingToolbar.tsx` | Vetsi tlacitka a text na mobilu |
| `src/components/SectionProgress.tsx` | Vetsi pilulky, lepsi kontrast |
| `src/components/ReadingContext.tsx` | Vetsi a kontrastnejsi popisky |
| `src/components/PreachingInspiration.tsx` | Vetsi a kontrastnejsi popisky |
| `src/components/LectorGuide.tsx` | Lepsi kontrast podtitulku |

Vsechny zmeny zachovavaji stavajici "knizni" estetiku -- jen zesilaji kontrast a zvetsují dotykove plochy pro mobilni pouziti.

