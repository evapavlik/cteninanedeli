-- Commentary table for exegetical notes on biblical pericopes
-- Used by kazaninanedeli to show structured commentary in Výklad step

create table if not exists public.commentary (
  id uuid default gen_random_uuid() primary key,
  -- Reference: book_number:chapter (e.g. "26:37" for Ezekiel 37)
  book_chapter text not null unique,
  -- Human-readable reference (e.g. "Ez 37,12-14")
  reference text not null,
  -- Title of the commentary
  title text not null,
  -- Historical/literary context paragraph
  context text not null,
  -- Key words with original language and explanation (JSONB array)
  -- Each: { word: string, explanation: string }
  key_words jsonb not null default '[]'::jsonb,
  -- Text structure analysis
  structure text not null default '',
  -- Theological themes (text array)
  theological_themes text[] not null default '{}',
  -- Application hints for sermon preparation (text array)
  application_hints text[] not null default '{}',
  -- Verse-by-verse notes (JSONB array)
  -- Each: { verse: number, note: string }
  verse_notes jsonb not null default '[]'::jsonb,
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.commentary enable row level security;

-- Allow anonymous read access
create policy "Commentary is publicly readable"
  on public.commentary for select
  using (true);

-- Index for quick lookup
create index if not exists idx_commentary_book_chapter
  on public.commentary (book_chapter);

-- Insert Ez 37 commentary
insert into public.commentary (
  book_chapter, reference, title, context, key_words, structure,
  theological_themes, application_hints, verse_notes
) values (
  '26:37',
  'Ez 37,12-14',
  'Otevření hrobů — příslib obnovy',
  'Text je součástí vidění o údolí suchých kostí (Ez 37,1-14). Ezechiel prorokuje v babylonském exilu (po r. 587 př. Kr.), kdy Jeruzalém leží v troskách a lid ztratil naději. Vše 36-37 tvoří zlom v knize: po soudech (kap. 1-24) a proroctvích proti národům (kap. 25-32) přichází naděje a obnova.',
  '[
    {"word": "hroby (קְבוּרוֹת, qeburot)", "explanation": "Metafora pro exil a beznaděj — lid se cítí jako mrtvý. Není to primárně o tělesném vzkříšení, ale o národní obnově."},
    {"word": "můj lide (עַמִּי, ammi)", "explanation": "Trojnásobné oslovení „můj lide" zdůrazňuje vztah smlouvy — Hospodin se ke svému lidu stále přiznává, i když lid cítí opak."},
    {"word": "duch/Duch (רוּחִי, rûachí)", "explanation": "Hebrejské „rûach" znamená vítr, dech i Ducha. V kontextu suchých kostí (v. 9-10) je to životodárný dech, který oživuje — odkaz na stvoření (Gn 2,7)."},
    {"word": "poznáte (יָדַע, jada')", "explanation": "„Poznání Hospodina" je klíčový motiv Ezechiela (přes 70× v knize). Není to intelektuální vědění, ale existenciální zkušenost."}
  ]'::jsonb,
  'Vše 12-14 mají jasnou strukturu: příslib (otevřu hroby) → čin (vyvedu, přivedu, vložím ducha) → poznání (poznáte, že já jsem Hospodin). Každý verš končí formulí poznání — opakování zdůrazňuje jistotu.',
  array[
    'Boží moc nad smrtí — i to, co vypadá mrtvé a beznadějné, může Bůh oživit',
    'Exil jako smrt, návrat jako vzkříšení — metafora pro každé „údolí suchých kostí" v životě',
    'Duch jako zdroj života — člověk nemůže ožít sám, potřebuje Boží dech',
    'Smlouva trvá — trojnásobné „můj lide" i v beznaději'
  ],
  array[
    'Kde ve svém sboru / okolí vidíte „údolí suchých kostí"?',
    'Co znamená „otevřít hroby" pro lidi, kteří se cítí uzavření, bez výhledu?',
    'Jak souvisejí „duch" a „život" v každodenní zkušenosti vašich posluchačů?',
    'Liturgický kontext: 5. neděle postní (Judica) — cesta k Velikonocům, motiv smrti a vzkříšení se prohlubuje'
  ],
  '[
    {"verse": 12, "note": "„Otevřu vaše hroby" — Bůh je subjektem, člověk je příjemcem. Hroby symbolizují exil, ne skutečnou smrt. Boží iniciativa je absolutní: já otevřu, já vyvedu, já přivedu."},
    {"verse": 13, "note": "Opakování formule „poznáte, že já jsem Hospodin" — cílem není jen záchrana, ale poznání. Lid má v události rozpoznat Boží jednání."},
    {"verse": 14, "note": "„Vložím do vás svého ducha" — vrchol textu. Duch (rûach) je Boží dech, který tvoří život (srov. Gn 2,7). „Odpočinutí ve vaší zemi" — šalom, naplnění smlouvy. Závěrečná formule „já Hospodin jsem to vyhlásil i vykonal" potvrzuje, že Boží slovo se stává skutečností."}
  ]'::jsonb
)
on conflict (book_chapter) do update set
  reference = excluded.reference,
  title = excluded.title,
  context = excluded.context,
  key_words = excluded.key_words,
  structure = excluded.structure,
  theological_themes = excluded.theological_themes,
  application_hints = excluded.application_hints,
  verse_notes = excluded.verse_notes,
  updated_at = now();
