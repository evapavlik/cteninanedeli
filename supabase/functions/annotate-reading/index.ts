import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Kondenzovaný teologický profil CČSH na základě dokumentu "Základy víry CČSH" (sněm 1971)
// a "Stručného komentáře k Základům víry" (sněm 2014)
const CCSH_THEOLOGICAL_PROFILE = `
TEOLOGICKÝ PROFIL CÍRKVE ČESKOSLOVENSKÉ HUSITSKÉ (CČSH):
Vycházej z oficiálního věroučného dokumentu "Základy víry CČSH" a "Stručného komentáře" (2014).

1. DUCH KRISTŮV (Základy víry ot. 47): „Duch Kristův je Duch svatý mluvící k nám v Písmu svatém a dosvědčený také v ústním podání starokřesťanském, v hnutí husitském, bratrském a v dalším úsilí reformačním." Svrchovanou autoritou ve věcech nauky a praxe je vzkříšený Pán Ježíš Kristus, v Duchu svatém přítomný a jednající ve své církvi. Duch Kristův oživuje literu Písma a probouzí víru v srdci člověka.

2. SVOBODA SVĚDOMÍ (ot. 49): „Svoboda věřících k plné osobní poslušnosti milosti a pravdy, která se stala v Ježíši Kristu, a svoboda od lidských nálezků církevních dějin." Ne libovůle, ale svobodná poslušnost Kristu. „Kde je Duch Páně, tam je svoboda" (2 K 3,17).

3. PÍSMO A TRADICE: Písmo svaté je „norma normans" – nejvyšší norma, pramen učení a praxe církve. Slovo Boží jakožto událost dějinná není totožné s Písmem jakožto písemným svědectvím (ot. 82). Tradice je „norma normata" – norma podřízená Bibli. Na věrném uchovávání a aktualizaci biblické zvěsti záleží apoštolskost církve.

4. BOŽÍ CÍRKEV A OBECENSTVÍ (ot. 6): „Boží církev jsou ospravedlnění hříšníci žijící v osobním obecenství s Bohem v Kristu a v bratrství společného života v místních křesťanských obcích obnovovaných Slovem Božím a liturgickým společenstvím večeře Páně." Obecenství znamená vzájemnou účast a sdílení, jednotu v lásce. Církev je tělem Kristovým (1 K 12,27).

5. ZPŘÍTOMNĚNÍ: Centrálním bodem liturgie je zpřítomnění Ježíše Krista. Vzkříšený Kristus se svým spásným dílem se na základě svého příslibu mocí Ducha svatého stává v liturgickém jednání církve osobně a jedinečně přítomným. „Dává se Otci i lidem a jedná ke spáse všech" (Stručný komentář IV.9).

6. KALICH A VEČEŘE PÁNĚ (ot. 330-332): Kristus je při večeři Páně přítomen v moci Ducha svatého. Kalich vyjadřuje Kristovu lásku obětující se na kříži za všechny. Přijímání pod obojí způsobou – dědictví husitské reformace a Čtyř pražských artikulů.

7. REFORMAČNÍ DĚDICTVÍ: CČSH navazuje na husitství, Jednotu bratrskou a katolický modernismus. Pojmové určení CČSH: „Křesťané, kteří usilují naplnit současné snažení mravní a poznání vědecké Duchem Kristovým, jak se nám zachoval v Písmu a v podání starokřesťanském a jak je dosvědčen husitským, českobratrským a dalším úsilím reformačním."

8. VÍRA A VĚDA (Stručný komentář): „Vědecké poznání světa a jeho vývoje víru v Boha Stvořitele neruší, nýbrž naopak této víře odpovídá." CČSH respektuje autonomii vědeckého bádání a formuluje svou nauku v dialogu s vědou.

9. EKUMENICKÁ OTEVŘENOST (ot. 29-30): Panství Pána nad celou Boží církví vede k modlitbě a úsilí o ekumenickou jednotu. Každá církev přispívá k duchovnímu bohatství jedné Boží církve svým zvláštním důrazem. Respektujeme praxi a formy zbožnosti jiných církví.

10. SLUŽBA A KNĚŽSTVÍ: Obecné kněžství všech pokřtěných i svátostné kněžství mají základ v kněžství Kristově. Od roku 1947 přijímají kněžské svěcení i ženy. Oddělení ke službě Bohu neznamená odloučení od lidí, nýbrž zvýšenou odpovědnost a lásku vůči nim (ot. 40).

TERMINOLOGIE: Používej pojmy CČSH – „zpřítomnění" (ne „transsubstanciace"), „obecenství" (ne pouze „společenství"), „Duch Kristův", „Boží království", „ospravedlnění hříšníci". Výklady formuluj s důrazem na praktický dopad evangelia do života, v duchu reformační otevřenosti, naděje a svobody svědomí.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Two modes: "annotate" (default) and "context"
    const isContext = mode === "context";

    const systemPrompt = isContext
      ? `${CCSH_THEOLOGICAL_PROFILE}

Tvým úkolem je pro zadaný biblický text (jedno nebo více čtení) vytvořit stručný kontextový průvodce v duchu teologie CČSH.

Vrať JSON objekt s polem "readings", kde každý prvek odpovídá jednomu čtení a má tyto klíče:
- "title": název čtení (např. "První čtení – Iz 58,7-10")
- "intro": 1-2 věty, které může lektor říct shromáždění PŘED čtením, aby zasadil text do kontextu. Formuluj v duchu husitské teologie – zdůrazni Kristův odkaz, reformační tradici, obecenství a aktuálnost poselství pro dnešek.
- "characters": pole klíčových postav [{name, description}] – kdo je kdo v textu (max 4)
- "historical_context": 2-3 věty o historickém pozadí – kdy, kde, proč text vznikl, komu byl určen
- "main_message": 1 věta shrnující jádro/poselství textu z perspektivy CČSH – zdůrazni Ducha Kristova, obecenství, zpřítomnění Božího slova a praktický dopad do života věřícího
- "tone": jaký emocionální charakter má mít přednes (např. "slavnostní a povzbudivý", "naléhavý a varovný")

Vrať POUZE validní JSON, žádný markdown ani komentáře.`
      : `${CCSH_THEOLOGICAL_PROFILE}

Jsi expert na liturgické předčítání (lektorování) v Církvi československé husitské.
Tvým úkolem je anotovat biblický text značkami pro přednes:

Pravidla:
- **tučně** označ slova, která mají být zdůrazněna (klíčová slova, jména, důležité pojmy)
- Vlož značku [pauza] tam, kde má být krátká pauza (cca 1 sekunda) — typicky před důležitou myšlenkou nebo po čárce
- Vlož značku [dlouhá pauza] tam, kde má být delší pauza (2-3 sekundy) — typicky mezi odstavci, před závěrečným veršem
- Vlož značku [pomalu] před pasáže, které mají být čteny pomaleji (slavnostní momenty, klíčové výroky)
- Vlož značku [normálně] pro návrat k normálnímu tempu
- Zachovej celý původní text — nic neodstraňuj, nic nepřidávej kromě značek
- Neměň formátování nadpisů (## zůstane ##)
- Nevkládej žádné komentáře ani vysvětlení — vrať POUZE anotovaný text

Příklad:
Vstup: "Hospodin řekl Mojžíšovi: Jdi k faraónovi a řekni mu: Propusť můj lid."
Výstup: "**Hospodin** řekl **Mojžíšovi**: [pauza] Jdi k **faraónovi** a řekni mu: [pauza] [pomalu] **Propusť můj lid.** [normálně]"`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    const body: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages,
    };

    if (isContext) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Chyba AI služby" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (isContext) {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({ context: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        console.error("Failed to parse context JSON:", content);
        return new Response(
          JSON.stringify({ error: "Nepodařilo se zpracovat kontext" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ annotated: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("annotate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
