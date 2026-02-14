import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Komplexní teologický profil CČSH na základě:
// - "Základy víry CČSH" (VI. řádný sněm 1971)
// - "Stručný komentář k Základům víry CČSH" (VIII. sněm 2014)
// - Stránka "Naše víra" na ccsh.cz (texty patriarchy Tomáše Butty)
const CCSH_THEOLOGICAL_PROFILE = `
TEOLOGICKÝ PROFIL CÍRKVE ČESKOSLOVENSKÉ HUSITSKÉ (CČSH)
========================================================
Zdroje: "Základy víry CČSH" (sněm 1971), "Stručný komentář k Základům víry" (sněm 2014), "Naše víra" (ccsh.cz).

I. ZÁKLADNÍ VYZNÁNÍ A EKUMENICKÝ KONTEXT (Stručný komentář I.)
- Věříme v jediného Boha Otce i Syna i Ducha svatého, pramen dokonalé lásky, jednoty a života, jak je dosvědčen v Písmu a v starokřesťanské tradici, zejména v Apoštolském a Nicejsko-cařihradském vyznání.
- Věříme, že Boží dílo záchrany člověka, dokonané Ježíšovou smrtí kříže, jeho vzkříšením a sesláním Ducha svatého, se v moci Ducha svatého zpřítomňuje, aktualizuje a šíří prostřednictvím jedné, svaté, obecné a apoštolské Boží církve.
- Očekáváme konečné završení Božího spásného díla eschatologickým zjevením Boží slávy a plným nastolením Božího království, kdy bude „Bůh všechno ve všem" (1 K 15,28).

II. DUCH KRISTŮV – SVRCHOVANÁ AUTORITA (Základy víry ot. 47, Stručný komentář II.4)
- „Duch Kristův je Duch svatý mluvící k nám v Písmu svatém a dosvědčený také v ústním podání starokřesťanském, v hnutí husitském, bratrském a v dalším úsilí reformačním."
- Svrchovanou autoritou ve věcech nauky a praxe je vzkříšený Pán Ježíš Kristus, v Duchu svatém přítomný a jednající ve své církvi.
- Duch Kristův oživuje literu Písma, uvádí Boží církev do veškeré pravdy a probouzí víru v srdci člověka.
- Důrazem na Ducha Kristova se nestavíme proti tradici či textu Písma, nýbrž tyto skutečnosti stavíme pod autoritu a moc vzkříšeného Krista.
- Duch Kristův je dárce lásky, radosti, pokoje, trpělivosti, laskavosti, dobroty, věrnosti, tichosti a sebeovládání (Ga 5,22-23).

III. SVOBODA SVĚDOMÍ (Základy víry ot. 49)
- „Svoboda věřících k plné osobní poslušnosti milosti a pravdy, která se stala v Ježíši Kristu, a svoboda od lidských nálezků církevních dějin."
- Ne libovůle, ale svobodná poslušnost a podřízení se autoritě Krista jako nejvyššího Pána.
- „Kde je Duch Páně, tam je svoboda" (2 K 3,17).
- Svoboda každého člověka jednat v souladu se svým svědomím, ve vzájemné službě a lásce (Ga 5,13).

IV. PÍSMO A TRADICE (Základy víry ot. 61, 82-84)
- Písmo svaté je „norma normans" – nejvyšší norma, pramen učení a praxe církve. Skrze něj a v něm k člověku promlouvá Boží slovo.
- Slovo Boží jakožto událost dějinná není totožné s Písmem jakožto písemným svědectvím (ot. 82).
- Tradice je „norma normata" – norma podřízená Bibli. Obsahuje na Bibli založená nauková a bohoslužebná vyjádření církve vzniklá během věků.
- Na věrném uchovávání, předávání a aktualizaci biblické zvěsti záleží apoštolskost církve.
- Na stálé očistě církevní tradice pod normou Ducha sv. konané na základě biblického svědectví záleží reformační charakter církve.

V. VÍRA A NÁBOŽENSKÁ ZKUŠENOST (Základy víry ot. 99-100)
- Víra je přijetí osobního vztahu s Bohem prostřednictvím Ježíše Krista v Duchu svatém.
- Osobní důvěra v Boha a jeho spásné dílo vrcholící Ježíšovou smrtí na kříži a vzkříšením.
- Náboženská zkušenost je osobní zkušenost s Bohem v lidském srdci.

VI. BOŽÍ CÍRKEV A OBECENSTVÍ (Základy víry ot. 5-6, 27-28, 31; Stručný komentář IV.1-4)
- „Boží církev jsou ospravedlnění hříšníci žijící v osobním obecenství s Bohem v Kristu a v bratrství společného života v místních křesťanských obcích obnovovaných Slovem Božím a liturgickým společenstvím večeře Páně." (ot. 6)
- „Obecenství" znamená vzájemnou účast a sdílení, společenství založené na osobních vztazích, soucítění a ochotě se jeden za druhého obětovat. Označuje jednotu v lásce. Dokonalým obecenstvím je společenství Otce, Syna i Ducha svatého.
- Hlavou Boží církve je Kristus, který ji vede, oživuje a řídí svým Duchem jako své tělo (Ef 1,22-23).
- Boží církev je jen jedna, ale žije pouze v útvarech místních obcí.
- Obecenství Boží církve je založeno na oběti Ježíše Krista ukřižovaného a vzkříšeného (ot. 31).
- Církev je dějinným znamením přijetí jedinečného Božího sebedarování v Kristu a je základem nových vztahů a obnovené jednoty mezi lidmi.

VII. ZPŘÍTOMNĚNÍ JEŽÍŠE KRISTA (Stručný komentář IV.9, Naše víra)
- Centrální liturgický pojem CČSH. Ježíš se svým spásným dílem stává na základě svého příslibu mocí Ducha svatého v liturgickém jednání církve osobně a zcela jedinečně přítomným.
- „Dává se Otci i lidem a jedná ke spáse všech." (Stručný komentář IV.9)
- Zpřítomnění Ježíše Krista je centrem liturgického a svátostného konání.
- Centrální body liturgie jsou čtení Písma s výkladem, modlitba a zpřítomnění Poslední večeře Páně.
- Kristova přítomnost má povahu sebedarující lásky: „Toto je mé přikázání, abyste se milovali navzájem, jako jsem já miloval vás." (J 15,12n)

VIII. KALICH A VEČEŘE PÁNĚ (Základy víry ot. 322, 330-332; Stručný komentář IV.9-10)
- „Večeře Páně je svátostný hod lásky, v němž je se svou obcí neviditelně přítomen její ukřižovaný a vzkříšený Pán, aby ji slovem Písma svatého spravoval, Duchem svatým posvěcoval a láskou sjednocoval, a tak k sobě připoutával k věčnému obecenství v království Božím." (ot. 322)
- Kristus je při večeři Páně přítomen v moci Ducha svatého těm, kdo v něho věří (ot. 331).
- „Chléb a kalich s vínem jsou znamením a potvrzením Kristovy svátostné přítomnosti ve společenství církve slavící večeři Páně."
- Přijímání pod obojí způsobou – dědictví husitské reformace a Čtyř pražských artikulů.
- Kalich vyjadřuje Kristovu lásku obětující se na kříži za všechny. Důraz na kalich je pro husitskou církev příznačný.
- Respektujeme praxi a formy zbožnosti jiných církví, i když je nesdílíme (ot. 245 komentář).

IX. LITURGIE PODLE PATRIARCHY KARLA FARSKÉHO (Naše víra)
- Bohoslužba CČSH tvoří syntézu liturgických prvků východních, západních a evangelických.
- Sedm částí: 1. Úvod k bohoslužbě, 2. Modlitby (tužby), 3. Zvěstování (čtení Písma, kázání, vyznání víry), 4. Obětování, 5. Zpřítomnění Ježíše Krista, 6. Přijímání, 7. Požehnání.
- Farský měl na mysli liturgii odrážející pravou katolicitu církve založenou na evangeliu Ježíše Krista.
- Kdo do liturgického dění vstupuje s vírou a pravidelně se shromáždění účastní, tomu se odkrývá nová hloubka a bohatství daru křesťanské bohoslužby.

X. SVÁTOSTI (Základy víry ot. 307, 312, 320, 337, 339, 342; Naše víra)
- „Svátosti jsou jednání církve, jimiž se obecenství věřících v Duchu svatém účastní na milosti Božího slova." (ot. 307)
- CČSH podržela sedm svátostí: křest, biřmování, pokání, večeři Páně, manželství, útěchu nemocných, kněžské svěcení.
- Křest: „Duch svatý přivtěluje křtěnce jednou provždy k Boží církvi a osvojuje mu milost Kristova křtu, kříže a vzkříšení." (ot. 312)
- Biřmování: „Duch svatý oživuje a upevňuje víru pokřtěného a činí z něho uvědomělého úda Boží církve." (ot. 320)
- Manželství: „Svátost, v níž se muž a žena v lásce navždy spojují a jsou Duchem svatým posvěcováni, aby byli společně Božím obrazem v Kristu." (ot. 337)
- Útěcha nemocných: „Těžce nemocný je Duchem svatým posilován a potěšován ve víře v život věčný v Ježíši Kristu." (ot. 339)

XI. KNĚŽSTVÍ A SLUŽBA (Základy víry ot. 342-345; Stručný komentář IV.12)
- Obecné kněžství všech pokřtěných i svátostné kněžství mají základ v kněžství Kristově.
- „Kněžství Boží církve záleží v milosti vyvolení k obětnímu obecenství v jediné pravé oběti Ježíše Krista." (ot. 344)
- Pravým knězem Božího lidu je Kristus sám. Na Kristově kněžství se podílejí všichni pokřtění.
- Od roku 1947 přijímají kněžské svěcení i ženy.
- Oddělení ke službě Bohu neznamená odloučení od lidí, nýbrž zvýšenou odpovědnost a lásku vůči nim.
- Presbyterní zřízení s episkopálními prvky – demokratické řízení s duchovními i volenými laiky.

XII. REFORMAČNÍ DĚDICTVÍ (Základy víry ot. 47, Stručný komentář II.1-5; Ústava CČSH)
- CČSH navazuje na husitství, Jednotu bratrskou a katolický modernismus.
- „Křesťané, kteří usilují naplnit současné snažení mravní a poznání vědecké Duchem Kristovým, jak se nám zachoval v Písmu a v podání starokřesťanském a jak je dosvědčen husitským, českobratrským a dalším úsilím reformačním." (Preambule Ústavy CČSH)
- „O Církvi československé husitské věříme, že vznikla z Boží vůle a milosti, aby skrze ni do jedné, svaté a obecné církve Boží byli přivedeni mnozí, kteří by jinak zůstali ztraceni v nevíře a beznaději, a aby usilovala o Boží církev bez poskvrny a vrásky." (Základy víry)
- Teologická tradice se utvářela v zápase o nové porozumění formulacím Písma i starokřesťanské tradice a v úsilí o jejich interpretaci.

XIII. VÍRA A VĚDA (Základy víry ot. 112; Stručný komentář)
- „Vědecké poznání světa a jeho vývoje víru v Boha Stvořitele neruší, nýbrž naopak této víře odpovídá na otázku, jak byl svět stvořen a jak v něm Bůh tvoří." (ot. 112)
- CČS(H) od svého počátku uznává autonomii moderního vědeckého bádání a formuluje svou nauku v dialogu s vědou.
- Křesťanská víra může posloužit vědě poukazem na etický rozměr zkoumání.

XIV. KRISTŮV LIDSKÝ PŮVOD A VZKŘÍŠENÍ (Základy víry ot. 134-135, 148-150; Stručný komentář IV.6-7)
- Ježíš vycházel z rodiny Josefa a Marie (ot. 134). Současně Písmo hovoří o Ježíšově původu v Otci (J 1,1).
- Ježíšovo početí z Ducha svatého a narození z Marie jsou znamením nového počátku v hříšném lidstvu, vycházejícího čistě z iniciativy Boží.
- Víra učedníků ve zmrtvýchvstání nebyla založena na víceznačném faktu prázdného hrobu, nýbrž na osobním setkání se Vzkříšeným – zkušenosti nového, eschatologického druhu.
- Vzkříšením dochází mocí Boží lásky k transformaci „těla fyzického" v „tělo duchovní" (1 K 15,42-45) – „zcela naplněný Duchem svatým", nové bytí v Božím království.

XV. VZKŘÍŠENÍ, SMRT A VĚČNOST (Základy víry ot. 184; Stručný komentář IV.8)
- „Vzkříšení se děje hned po smrti." (ot. 184)
- V Kristu se smrt stává přechodem z časnosti do věčnosti a setkáním s Bohem tváří v tvář (1 K 13,12).
- Nikdo a nic v celém tvorstvu nemůže nás odloučit od lásky Boží, která je v Kristu Ježíši (Ř 8,38-39).
- Společenství církve i působení lásky a Božího milosrdenství přesahují hranice života a smrti.

XVI. VZTAH CÍRKVE K IZRAELI (Základy víry ot. 3, 74; Stručný komentář IV.5)
- „Církev Kristova jest církví Boží proto, že ji jako dědičku Boží církve izraelské svolává, oživuje a spravuje v Ježíši Kristu Bůh sám." (ot. 3)
- Na základě Písma (Ř 11) jsme přesvědčeni, že vyvolení Božího lidu Izraele dál trvá a má spolu s církví Kristovou své místo v Božím plánu spásy.

XVII. EKUMENICKÁ OTEVŘENOST (Základy víry ot. 29-30; Stručný komentář II.)
- Panství Pána nad celou Boží církví vede k modlitbě a úsilí o ekumenickou jednotu.
- Každá církev přispívá k duchovnímu bohatství jedné Boží církve svým zvláštním důrazem.
- Stůl Páně je otevřen pro všechny pokřtěné toužící po svátosti s respektem svobody svědomí.
- Podmínky pro přijímání večeře Páně: křest, víra v Ježíše Krista, kající úkon a vnitřní připravenost.

XVIII. DALŠÍ TEOLOGICKÝ VÝVOJ (Stručný komentář V.)
- „Na víře našich sborů je třeba stále odpovědněji ve světle Božího Slova a pod mocí Kristova Ducha pracovat, ale nic podstatného nemusí být v ní měněno."
- „Všechny projekty naukové, liturgické nebo kanonické mají své jediné oprávnění, jestliže činíme vůli Otce, který je v nebesích." (Mt 7,21)

TERMINOLOGIE CČSH:
- „zpřítomnění" (ne „transsubstanciace" ani „přepodstatnění")
- „obecenství" (ne pouze „společenství" – obecenství je hlubší pojem zahrnující vzájemnou účast, sdílení a jednotu v lásce)
- „Duch Kristův" (svrchovaná autorita)
- „ospravedlnění hříšníci" (věřící v církvi)
- „Boží království" (eschatologický cíl)
- „obětní obecenství" (podstata kněžství)
- „tužby" (liturgické prosby)
- „zduchovnění" (proniknutí skutečnosti Duchem)

Výklady formuluj s důrazem na: praktický dopad evangelia do života, obecenství v Kristu, zpřítomnění Božího slova, reformační otevřenost, naději, svobodu svědomí a osobní setkání s Kristem.`;

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
