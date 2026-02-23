

# Odstraneni Cormorant Garamond -- sjednoceni na Literata

## Problem
Cormorant Garamond ma malou x-height, tenke tahy a spatne citelne cislice a interpunkcni znaky (pomlcky, uvozovky). V nadpisech cteni pusobi nekonzistentne s hlavnim textem v Literata.

## Reseni
Kompletne nahradit Cormorant Garamond fontem Literata. Literata ma elegantni knizni estetiku a soucasne vybornou citelnost -- neni duvod mit dva ruzne serifove fonty.

## Zmeny

### 1. `index.html`
- Z Google Fonts URL odstranit `Cormorant+Garamond` (a jeho vahy/italiky)
- Ponechat pouze Literata a Playfair Display SC
- Totez v noscript fallbacku
- Skeleton title: zmenit font-family z `'Cormorant Garamond'` na `'Literata'`

### 2. `src/index.css`
- `.prose-reading h1-h4`: zmenit `'Cormorant Garamond'` na `'Literata'`
- `.prose-reading p:first-of-type::first-letter` (drop cap): zmenit na `'Literata'`

### 3. `src/pages/Index.tsx`
- Hlavni titulek `<h1>`: zmenit inline style `fontFamily` z `'Cormorant Garamond'` na `'Literata'`

## Vysledek
Cela aplikace bude pouzivat jediny serifovy font (Literata), cimz se:
- Sjednotí vizualni hierarchie
- Zlepsi citelnost cislic a interpunkce v nadpisech
- Zmensi objem stahovanych fontu (o cca 30-50 KB)
- Playfair Display SC zustava pro dekorativni ucely (pokud se pouziva)

