

# Sjednoceni fontu -- odstraneni vizualniho nepoměru

## Problem
Trida `.font-serif` pouziva Cormorant Garamond, ktery ma vyrazne mensi x-height nez Literata. Vsechny texty oznacene `font-serif` (nadpisy kapitol, popisky, titulky panelu) tak pusobi mensi a vizualne nekonzistentni s hlavnim textem.

## Reseni
Zmenit `.font-serif` na Literata. Cormorant Garamond zachovat pouze pro:
- Hlavni titul stranky ("Cteni textu na nedeli") -- inline style v Index.tsx
- Drop cap (iniciala prvniho pismene) -- v prose-reading CSS
- Nadpisy h2 v prose-reading (nazvy cteni) -- v prose-reading CSS

## Zmeny

### 1. `src/index.css`
- `.font-serif`: zmenit z `'Cormorant Garamond'` na `'Literata'`
- `.prose-reading h1-h4` a `.prose-reading h2`: ponechat Cormorant Garamond (knizni estetika nadpisu cteni)
- Drop cap (`::first-letter`): ponechat Cormorant Garamond

### 2. Zadne dalsi soubory
Vsechny komponenty pouzivaji tridu `font-serif`, takze zmena v CSS se propaguje vsude automaticky -- do SectionProgress, ReadingContext, PreachingInspiration, LectorGuide, AmbonMode i Index.tsx.

## Vysledek
Vsechny popisky, tlacitka a titulky panelu budou ve stejnem fontu jako hlavni text (Literata), cimz se sjednotí vizualni hierarchie. Dekorativni prvky (nazvy cteni v textu, iniciala, hlavni titul) zustanou v Cormorant Garamond.
