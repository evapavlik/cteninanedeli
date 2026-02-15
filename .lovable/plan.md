
# Zjednodušení Průvodce ke čtení

Aktuálně má každé čtení v průvodci 6 samostatných sekcí s ikonami a nadpisy. Cílem je zredukovat obsah na 3 kompaktnější bloky, aby byl průvodce přehlednější a méně zahlcující.

## Nová struktura průvodce

Místo 6 sekcí budou **3 bloky**:

1. **Úvod pro shromáždění** -- zůstane samostatně, protože ho lektor přímo předčítá
2. **Kontext** -- sloučení Klíčových postav + Historický kontext + Hlavní poselství do jednoho plynulého odstavce
3. **Přednes** -- Tón přednesu + Citace ze Základů víry v jednom bloku

## Co se změní

### 1. AI prompt (Edge funkce `annotate-reading`)
- Místo 5 samostatných polí (`characters`, `historical_context`, `main_message`, `tone`, `citations`) se prompt upraví na 3 pole:
  - `intro` -- beze změny
  - `context` -- jeden odstavec (3-4 věty) zahrnující postavy, historické pozadí i poselství
  - `delivery` -- tón přednesu + citace v jednom bloku
- Celkově kratší výstupy -- AI dostane instrukci být stručnější

### 2. Datový model (`ReadingContextEntry`)
- Zjednoduší se na: `title`, `intro`, `context`, `delivery_tone`, `citations`
- Odstraní se: `characters`, `historical_context`, `main_message`, `tone`

### 3. UI komponenta (`ReadingContext.tsx`)
- Místo 6 sekcí s ikonami se zobrazí 3 kompaktní bloky
- Méně vizuálního šumu, méně scrollování

### 4. Cache
- Po nasazení bude nutné smazat existující cache (`DELETE FROM ai_cache WHERE mode = 'context'`), aby se vygenerovaly nové kratší výstupy

## Technické detaily

Soubory k úpravě:
- `supabase/functions/annotate-reading/index.ts` -- nový prompt
- `src/components/ReadingContext.tsx` -- nový interface + jednodušší UI
