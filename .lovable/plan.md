

# Zvetseni citelnosti textu na mobilu

## Analyza
Referencni stranka bible.com pouziva:
- Sans-serif font s velkou x-height (cca 20px)
- Stedy radkovani (~1.8)
- Text pusobi vetsi a vzdusnejsi

Aktualni aplikace pouziva:
- EB Garamond (serif s malou x-height) -- pri 21px pusobi jako 17-18px sans-serifu
- Vychozi velikost 21px, minimum 14px
- CSS `.prose-reading` nastavuje 1.3rem na mobilu (cca 20.8px), ale inline style to prepise na 21px

## Navrzene zmeny

### 1. Zvysit vychozi velikost pisma na mobilu
- Zmenit vychozi `fontSize` z 21 na 24px v `src/pages/Index.tsx`
- Zvysit minimalni velikost z 14px na 18px v `src/components/ReadingToolbar.tsx`
- Zvysit maximalni velikost z 40px na 48px

### 2. Zmenit font textu na lepe citelny serif
Navrhuji zamenit EB Garamond za **Georgia** (systemovy font) nebo **Literata** (Google Font navrzeny primo pro ctecky -- ma velkou x-height a skvele se cte na obrazovkach).

Literata je:
- Navrzena pro e-ctecky a obrazovky
- Ma vyrazne vetsi x-height nez EB Garamond
- Stale pusobi knizne a dustojne
- Zdarma z Google Fonts

Zmeny:
- `index.html` -- pridat Literata do font preload
- `src/index.css` -- zmenit `font-family` v `body` a `.prose-reading` z EB Garamond na Literata
- EB Garamond zustanou jen pro dekorativni prvky (headery, disclaimery)

### 3. Upravit CSS prose-reading pro mobil
- Zvysit zakladni `font-size` z `1.3rem` na `1.5rem` na mobilu
- Zvysit `line-height` z `1.9` na `2.0` na mobilu

## Soubory k uprave

| Soubor | Zmena |
|---|---|
| `index.html` | Pridat font Literata do preload |
| `src/index.css` | Zmenit body a prose-reading font na Literata, zvetsit base font-size |
| `src/pages/Index.tsx` | Vychozi fontSize 24, vychozi lineHeight 2.0 |
| `src/components/ReadingToolbar.tsx` | Min 18px, max 48px |

## Poznamka
Dekorativni prvky (nadpis "Cteni textu na nedeli", iniciala, nadpisy h2) zustanou v Cormorant Garamond pro zachovani "knizni" estetiky. Zmena se tyka pouze hlavniho textu cteni, kde je citelnost klicova.
