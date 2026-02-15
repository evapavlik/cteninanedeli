

# Strukturovaný teologický korpus

## Současný stav

Celý teologický profil CČSH je uložen jako jeden dlouhý textový řetězec (7 184 znaků) v tabulce `theological_profiles`. Edge funkce ho načte celý a vloží do system promptu AI modelu. To má několik nevýhod:

- Nelze přidávat další dokumenty bez ručního skládání textu
- Nelze rozlišit, co je "Základy víry", co je liturgický manuál, co je kázání
- Při dotazu na konkrétní téma se AI modelu posílá vše naráz
- Těžko se spravuje a rozšiřuje

## Navrhované řešení

### 1. Nová tabulka `corpus_documents`

Nahradí stávající jednosloupcový přístup strukturovaným úložištěm:

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | uuid | Primární klíč |
| profile_slug | text | Odkaz na teologický profil (např. "ccsh") |
| title | text | Název dokumentu (např. "Základy víry CČSH") |
| category | text | Kategorie: "věrouka", "liturgika", "homiletika", "pastorace", "dějiny" |
| content | text | Plný text dokumentu |
| summary | text (nullable) | Volitelný krátký souhrn pro AI kontext |
| sort_order | integer | Pořadí důležitosti (1 = nejdůležitější) |
| is_active | boolean | Zda se dokument používá v AI promptu |
| created_at | timestamp | Datum vytvoření |
| updated_at | timestamp | Datum poslední změny |

### 2. Migrace stávajících dat

Stávající obsah z `theological_profiles` se přesune do `corpus_documents` jako první dokument s kategorií "věrouka" a `sort_order = 1`.

### 3. Úprava edge funkce `annotate-reading`

Místo načtení jednoho profilu se načtou všechny aktivní dokumenty pro daný `profile_slug`, seřazené podle `sort_order`, a sestaví se z nich system prompt. Díky tomu:

- Každý nový dokument se automaticky zahrne do AI kontextu
- Lze snadno deaktivovat dokument bez mazání (`is_active = false`)
- Kategorie pomáhají AI lépe rozlišit zdroje

### 4. Workflow pro přidávání dokumentů

Dokumenty budete nahrávat přímo v chatu -- já je zpracuji a uložím do databáze s příslušnou kategorií.

## Dostupné kategorie

- **věrouka** -- vyznání víry, Základy víry, dogmatické texty
- **liturgika** -- bohoslužebné řády, liturgické texty, svátosti
- **homiletika** -- kazatelské příručky, vzorová kázání
- **pastorace** -- pastorační dokumenty, metodiky
- **dějiny** -- historické dokumenty, sněmovní usnesení

---

## Technický souhrn

1. Vytvořit tabulku `corpus_documents` s RLS pro veřejné čtení
2. Migrovat stávající data z `theological_profiles.content` do nové tabulky
3. Upravit edge funkci `annotate-reading` -- načítat dokumenty z `corpus_documents` místo `theological_profiles`
4. Tabulka `theological_profiles` zůstane jako hlavička profilu (název, slug), ale obsah se přesune do `corpus_documents`
5. Odstranit hardkódovaný fallback profil z edge funkce (nahradí ho data z DB)

