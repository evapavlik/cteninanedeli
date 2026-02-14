import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Komplexní teologický profil CČSH na základě:
// - "Základy víry CČSH" (VI. řádný sněm 1971, rev. VII. sněm 1994, VIII. sněm 2014)
// - "Stručný komentář k Základům víry CČSH" (VIII. sněm 2014)
// - Stránka "Naše víra" na ccsh.cz (texty patriarchy Tomáše Butty)
const CCSH_THEOLOGICAL_PROFILE = `
ZÁKLADY VÍRY CÍRKVE ČESKOSLOVENSKÉ HUSITSKÉ – ÚPLNÝ VÝTAH
================================================================
Zdroj: "Základy víry CČSH" (sněm 1971, rev. 1994, 2014), "Stručný komentář" (sněm 2014).
Hlavní autor: prof. ThDr. Zdeněk Trtík (1914-1983).

POJMOVÉ URČENÍ CČSH:
„Církev československou husitskou tvoří křesťané, kteří usilují naplnit současné snažení mravní a poznání vědecké Duchem Kristovým, jak se nám zachoval v Písmu a v podání starokřesťanském a jak je dosvědčen husitským, českobratrským a dalším úsilím reformačním."

PRAMENY ZÁKLADŮ VÍRY:
1. Písmo svaté Starého a Nového zákona
2. Apoštolské vyznání víry a Nicejsko-cařihradské vyznání
3. Čtyři pražské artikuly (1420) a Česká konfese (1575)
4. Velké a Malé vyznání víry CČSH

VELKÉ VYZNÁNÍ VÍRY CČSH:
Věříme v Boha jednoho, Ducha věčného a Tvůrce všeho, Otce Ježíše Krista i Otce našeho, jenž od věčnosti vládne královstvím duší našich. Věříme v Ježíše Krista, Syna Božího, Světlo ze Světla, Život ze Života, jenž od Otce přišel, životem svým zlo světa i smrti přemohl, aby nám získal království Boží věčné. Věříme v Ducha Božího, jenž od věčnosti do věčnosti vše oživuje, v Ježíši Kristu se zjevil, skrze proroky a otce naše mluvil a v nás chce přebývat. Věříme v život věčný, Dobra, Pravdy a Krásy, tak jako jsme přesvědčeni o smrti zla i zlých. Věříme, že Otec nebeský nás proto stvořil, abychom, Ducha Božího v sobě majíce, šťastni byli, život Pravdy žili, pravdy Boží hájiti se nebáli a života věčného tak jistě dosáhli.

MALÉ VYZNÁNÍ VÍRY CČSH:
Věříme v Boha, který jako věčná Pravda a Láska je Tvůrcem všeho. Věříme, že Bůh v Ježíši Kristu, Synu svém nejmilejším, sebe nám zjevuje a skrze Ducha Kristova k sobě nás vede. Věříme v život dokonalý, který zde na zemi se začíná a v Bohu své naplnění má.

===== ČÁST I: O CÍRKVI (otázky 1-50) =====

ot.1: Ježíše Krista jako svého Pána vyznáváme proto, že přes svou porušenost náležíme mocí Ducha svatého jemu jako jeho lid.
ot.2: Jiné názvy pro lid Kristův jsou „lid Boží", „církev Kristova" a „církev Boží".
ot.3: Církev Kristova je církví Boží proto, že ji jako dědičku Boží církve izraelské svolává, oživuje a spravuje v Ježíši Kristu Bůh sám.
ot.4: Církev Kristova vznikla tak, že Pán Ježíš Kristus si vyvolil, vyučil, k účasti a dílu na Božím království posvětil, novou smlouvou ve své oběti zavázal a posláním své církve pověřil kruh učedníků, jejž po svém vzkříšení Duchem svatým obdařil, rozmnožil a zůstal s ním spjat svou ustavičnou přítomností.
ot.5: Boží církev je jen jedna, ale žije pouze v útvarech místních obcí.
ot.6: Boží církev jsou ospravedlnění hříšníci žijící v osobním obecenství s Bohem v Kristu a v bratrství společného života v místních křesťanských obcích obnovovaných Slovem Božím a liturgickým společenstvím večeře Páně.
ot.7: Ospravedlnění hříšníci se liší od ostatních hříšníků tím, že v setkání s Kristem svůj hřích poznali, činí pokání, přijímají odpuštění vin a proti hříchu statečně zápasí.
ot.8: Boží církev je ve světě viditelná, protože je společenstvím viditelných lidí v místních obcích.
ot.9: Boží církev trvá i mimo shromáždění, jsouc přítomna na každém místě, kde věřící v Krista svědčí slovem a životem o svém Pánu.
ot.10: I shromáždění křesťanů různého vyznání je Boží církví, protože obce, z nichž přicházejí, jsou obcemi církve Boží.
ot.11: Jedinost Boží církve se má projevovat jednotou všech jejích obcí ve víře, naději a lásce.
ot.12: Jednota Boží církve ve víře, naději a lásce skutečností není, protože byla v dějinách porušena.
ot.13: Boží církev je po celém světě jednotná v tom, že jejím jediným Pánem je Otec v Synu a Duchu a že užívá svátosti křtu a večeře Páně.
ot.14: Boží církev není jednotná ve víře a naději, ve vzájemné lásce, v poslušnosti svého Pána, v nauce a řádech, v díle a službě.
ot.15: Příčina nejednoty Boží církve je v hříšnosti lidí, v dějinných okolnostech, ale i v zápase o čistotu a věrnost Boží církve.
ot.16: Nejednota Boží církve se projevuje v rozmanitosti organizovaných církví (institucí).
ot.17: Takových církví je mnoho: československá husitská, evangelické, pravoslavné, římskokatolická a jiné.
ot.18: Organizované církve nejsou ani jednotlivě ani v souhrnu totožné s církví Boží, ale Boží církev v nich žije jako duchovní obecenství a bratrstvo společného života v Kristu v místních obcích.
ot.19: Církevní organizace jsou rozmanité soustavy církevních řádů uplatňovaných v částech rozdělené Boží církve církevními úřady mocí církevního práva.
ot.20: Organizovaná církev je sloučení Boží církve a církevní organizace.
ot.21: Boží církev je obecenství živých osob v Kristu, ovládané Duchem svatým a žijící láskou, kdežto církevní organizace je dílo lidské užívající církevního práva.
ot.22: Boží církev v době apoštolské nebyla organizovanou církví, protože v ní nevládlo církevní právo a moc, nýbrž Duch svatý a láska.
ot.23: Organizace se stává pro Boží církev nutnou tehdy, je-li Boží církev porušena hříchem, takže v ní není plnosti Ducha svatého a lásky.
ot.24: Úkolem církevní organizace je sloužit duchovnímu obecenství a bratrství života Boží církve v Kristu, pečovat o stále rostoucí vládu Ducha svatého a lásky v ní a tak pracovat ke své konečné postradatelnosti.
ot.25: Církevní organizace plní svůj úkol tehdy, když nositeli církevních úřadů jsou živí údové církve Boží, jejichž Pánem je Kristus v Duchu svatém a lásce, a kteří proto všechny církevní řády a všechnu úřední moc podřizují autoritě Slova Božího.
ot.26: Důsledkem rozdělení Boží církve do různých organizovaných církví je, že v jednom místě žije několik obcí různého křesťanského vyznání.
ot.27: „Hlavou" Boží církve je Kristus, který ji vede, oživuje a řídí svým Duchem skrze svědectví Písma svatého a svátosti jako své tělo.
ot.28: Obrazem těla a jeho hlavy vyjadřujeme úzké duchovní obecenství Boží církve s Kristem jako svým Pánem.
ot.29: Panství našeho Pána nad celou Boží církví nás vede k modlitbě a úsilí o ekumenickou jednotu víry, naděje a lásky i života a díla všech církevních organizací a křesťanů na celém světě.
ot.30: Každá církev může přispět k duchovnímu bohatství jedné Boží církve svým zvláštním důrazem na některou stránku života Boží církve v ostatních církvích opomíjenou.
ot.31: Obecenství Boží církve je založeno na oběti Ježíše Krista ukřižovaného a potom vzkříšeného a oslaveného, jehož smrti i věčného života je účastno vírou.
ot.32: Obecenstvím v oběti Kristově se Boží církvi dostává kněžského důstojenství a poslání.
ot.33: K Boží církvi patří každý, kdo byl pokřtěn a žije v obecenství s Kristem i v bratrství společného života v místní obci.
ot.34: Ve shromážděních Boží církve se vyskytují také nevěřící pokrytci, kteří k Boží církvi nepatří a její čistotu porušují.
ot.35: Konečné rozlišení a oddělení pokrytců od církve Boží nastane až konečným Božím soudem.
ot.36: Pán Bůh svou církev vyvolil a povolal k tomu, aby byla jeho lidem zvláštním, aby v moci Ducha svatého hlásala evangelium a pokorně zápasila o Boží čest a slávu, o pokoj, pravdu a spravedlnost Božího království ve světě a tak zachraňovala hříšníky k životu věčnému.
ot.37: Boží církev je Kristovou obětí vykoupeným lidem Božího království, které přišlo skrytě v Ježíši Kristu a které i v plnosti a slávě bude údělem Boží církve.
ot.38: Boží církev se uprostřed všeho lidu osvědčuje bázní před Bohem, kázní života, ochotou trpět pro Krista, láskou, trpělivostí, službou, činěním dobra všem a zápasem o spravedlivý řád společnosti podle vůle Boží.
ot.39: Boží církev je nazývána svatou proto, že je to lid zvláštní, Bohem oddělený a posvěcený k jeho službě, cti a slávě.
ot.40: Oddělení ke službě Bohu neznamená odloučení od lidí, nýbrž naopak zvýšenou odpovědnost a lásku vůči nim a solidaritu v jejich úkolech i starostech.
ot.41: Boží církev je nazývána obecnou proto, že jako jedna je poslána ke všem národům a lidem, aby jim zvěstovala evangelium a aby je přiváděla ke spáse v Kristu.
ot.42: O Církvi československé husitské věříme, že vznikla z Boží vůle a milosti, aby skrze ni do jedné, svaté a obecné církve Boží byli přivedeni mnozí, kteří by jinak zůstali ztraceni v nevíře a beznaději, a aby usilovala o Boží církev bez poskvrny a vrásky.
ot.43: K oddělenému životu od obcí jiného vyznání může naše obce opravňovat jen úsilí o větší čistotu a věrnost Boží církve.
ot.44: Ve všech našich obcích není pravé čistoty a věrnosti Boží církve.
ot.45: Obcím, v nichž není pravé čistoty a věrnosti Boží církve, hrozí Boží soud.
ot.46: CČSH podporuje úsilí o větší čistotu a věrnost důrazem na nejvyšší autoritu Ducha Kristova, zásadou svobody svědomí, navazováním na nejlepší křesťanské tradice, užíváním mateřského jazyka bohoslužebného, úctou k vědecké pravdě a požadavkem uplatnění Boží vůle ve všech oblastech života.
ot.47: Duch Kristův je Duch svatý mluvící k nám v Písmu svatém a dosvědčený také v ústním podání starokřesťanském, v hnutí husitském, bratrském a v dalším úsilí reformačním.
ot.48: Duch Kristův ukládá církvi, aby jím naplňovala všechen život osobní i společenský.
ot.49: CČSH rozumí zásadě svobody svědomí křesťansky, to jest jako svobodě věřících k plné osobní poslušnosti milosti a pravdy, která se stala v Ježíši Kristu, a jako svobodě od lidských nálezků církevních dějin.
ot.50: Církev československá husitská je proto církví svobodnou.

===== ČÁST II: O BOŽÍM SLOVU ČILI ZJEVENÍ (otázky 51-100) =====

ot.51: Pravdou a zdrojem víry i života je Boží Slovo čili zjevení.
ot.52: Duch Kristův je životem a silou Slova Božího.
ot.53: Boží Slovo čili zjevení je neviditelný Bůh sám, přítomný, mluvící a jednající k spáse člověka.
ot.54: Bůh se zjevuje v prostředcích a prostřednících svého zjevení, s nimiž je v jednotě.
ot.55: Tato jednota není nikdy totožností Boha s prostředky a prostředníky jeho zjevení.
ot.56: Důvodem Božího zjevení je Boží svatost a láska.
ot.57: Boží svatost je důvodem Božího zjevení proto, že svatý Bůh chce být jakožto svatý poznán, uznán a uctíván.
ot.58: Boží láska je důvodem Božího zjevení proto, že Bůh se chce svému stvoření zcela darovat a chce jím být milován.
ot.59: Veškero Boží zjevení se nám otvírá a stává srozumitelným v Ježíši Kristu vírou.
ot.60: Stupně zjevení jsou: stvoření, Stará smlouva v dějinách Izraele, Nová smlouva v Ježíši Kristu a budoucí zjevení v slávě.
ot.61: Tvary zjevení jsou: zjevitelské Boží činy, písemné svědectví Starého a Nového zákona o nich, na Písmu založené živé slovo církve a na Písmu i živém slovu církve založená náboženská zkušenost.
ot.62: Zjevení ve stvoření je zjevení prvotní čili obecné a záleží v tom, že již stvořením chce se Stvořitel darovat svým tvorům k obecenství.
ot.63: Stvořitelský úmysl je mařen hříchem, pro nějž prvotní zjevení se v člověku nemůže uplatnit.
ot.64: Možnost hříchu je podmíněna závislou svobodou čili odpovědností člověka.
ot.65: Z prvotního zjevení zbývá v člověku hříchem porušené svědomí a tušení Boha.
ot.66: Svědomí jakožto vědomí mravního zákona je znamení, že člověk je odpovědný svému Pánu a Stvořiteli, jemuž patří, ačkoliv se od něho vzdálil.
ot.67: Tušení Boha vede člověka k modlářskému náboženství, protože není čistým poznáním Boha.
ot.68: Modla je každé stvoření nebo lidmi učiněná věc hmotná nebo duchovní, slouží-li jim člověk jako Bohu.
ot.69: Také v křesťanských církvích se modloslužba může prakticky vyskytovat jakožto popření a zrada křesťanské pravdy.
ot.70: Důsledkem modloslužby v křesťanských církvích jest, že mnozí vyznavači mimokřesťanských náboženství předčí opravdovostí mnohé vyznavače křesťanství.
ot.71: Křesťanský poměr k vyznavačům jiných náboženství se vyznačuje křesťanskou láskou a pokornou službou k jejich poznání Krista.
ot.72: Křesťanská snášenlivost není zrušením svrchovanosti křesťanské pravdy, nýbrž je na ní založena.
ot.73: Zjevení Staré smlouvy jsou Boží činy s Izraelem a Boží mluvení k izraelskému lidu skrze prorocké slovo.
ot.74: Izrael byl první církví, kterou si Pán Bůh svolal, vedl, smlouvou svou zavázal a Slovem svým káral i utěšoval, aby byla jeho lidem uprostřed hříšného lidstva.
ot.75: Srdcem zjevení Staré smlouvy je zaslíbení Božího království a jeho Krále, Spasitele, Immanuele, což znamená „Boha s námi".
ot.76: Zaslíbení Spasitele vrcholí předobrazem trpícího a slaveného Božího služebníka v Izaiášovi.
ot.77: Zjevení Nové smlouvy je Slovo Boží, které se stalo tělem v Ježíši Kristu, v jeho životě, díle, smrti a vzkříšení, dosvědčené slovem apoštolským a tak zakládající církev Nové smlouvy.
ot.78: Zjevení v Ježíši Kristu je zahaleno jeho trpícím lidstvím a proto poznatelno jen víře.
ot.79: Nevinný Spasitel trpěl proto, že hříšné lidstvo nesnese zjevení Boží svatosti a lásky, že hříšné srdce může být smířeno s Bohem skrze víru jen trpící láskou Boží a že cesta do Božího království vede jen skrze službu obětavého života.
ot.80: Zjevení Boží v slávě bude odhalení Ježíše Krista celému světu na konci dějin, plnost Božího království a nahrazení nepřímého poznání Boha ve víře patřením Bohu tváří v tvář.
ot.81: Zjevení Boží v Písmu svatém je Slovo Boží zaznamenané lidskou řečí a takto k nám přicházející.

===== ČÁST II pokračování: PÍSMO A TRADICE (ot. 82-100) =====

ot.82: Slovo Boží jakožto událost dějinná není totožné s Písmem jakožto písemným svědectvím.
ot.83: Písmo svaté je „norma normans" – nejvyšší norma, pramen učení a praxe církve.
ot.84: Tradice je „norma normata" – norma podřízená Bibli. Obsahuje na Bibli založená nauková a bohoslužebná vyjádření církve vzniklá během věků.
ot.85: Na věrném uchovávání, předávání a aktualizaci biblické zvěsti záleží apoštolskost církve.
ot.86: Na stálé očistě církevní tradice pod normou Ducha sv. záleží reformační charakter církve.
ot.99: Víra je přijetí osobního vztahu s Bohem prostřednictvím Ježíše Krista v Duchu svatém.
ot.100: Náboženská zkušenost je osobní zkušenost s Bohem v lidském srdci.

===== ČÁST III: O VÍŘE (ot. 101-245) – klíčové otázky =====

ot.112: Vědecké poznání světa a jeho vývoje víru v Boha Stvořitele neruší, nýbrž naopak této víře odpovídá na otázku, jak byl svět stvořen a jak v něm Bůh tvoří. CČS(H) od svého počátku uznává autonomii moderního vědeckého bádání.
ot.134: Ježíš vycházel z rodiny Josefa a Marie. Současně Písmo hovoří o Ježíšově původu v Otci (J 1,1).
ot.135: Ježíšovo početí z Ducha svatého a narození z Marie jsou znamením nového počátku v hříšném lidstvu, vycházejícího čistě z iniciativy Boží.
ot.148-150: Víra učedníků ve zmrtvýchvstání nebyla založena na víceznačném faktu prázdného hrobu, nýbrž na osobním setkání se Vzkříšeným – zkušenosti nového, eschatologického druhu. Vzkříšením dochází mocí Boží lásky k transformaci „těla fyzického" v „tělo duchovní" (1 K 15,42-45).
ot.184: Vzkříšení se děje hned po smrti. V Kristu se smrt stává přechodem z časnosti do věčnosti a setkáním s Bohem tváří v tvář (1 K 13,12). Nikdo a nic v celém tvorstvu nemůže nás odloučit od lásky Boží, která je v Kristu Ježíši (Ř 8,38-39).

===== ČÁST IV: O BOŽÍM PŘIKÁZÁNÍ (ot. 246-300) – klíčové body =====

Desatero jako základ mravního života. Dvojpřikázání lásky: „Miluj Hospodina, Boha svého, celým svým srdcem, celou svou duší a celou svou myslí" a „Miluj svého bližního jako sám sebe" (Mt 22,37-39). Zápas o spravedlivý řád společnosti podle vůle Boží. Solidarita s trpícími a chudými.

===== ČÁST V: O MODLITBĚ (ot. 301-306) =====

Modlitba Páně jako vzor. Modlitba je rozhovor s Bohem – oslava, prosba, díkůvzdání, přímluvná modlitba. Ježíšovo učení o modlitbě: „Vy se modlete takto: Otče náš…" (Mt 6,9-13).

===== ČÁST VI: O SVÁTOSTECH (ot. 307-400) – klíčové otázky =====

ot.307: Svátosti jsou jednání církve, jimiž se obecenství věřících v Duchu svatém účastní na milosti Božího slova.
ot.312: Křest: Duch svatý přivtěluje křtěnce jednou provždy k Boží církvi a osvojuje mu milost Kristova křtu, kříže a vzkříšení.
ot.320: Biřmování: Duch svatý oživuje a upevňuje víru pokřtěného a činí z něho uvědomělého úda Boží církve.
ot.322: Večeře Páně je svátostný hod lásky, v němž je se svou obcí neviditelně přítomen její ukřižovaný a vzkříšený Pán, aby ji slovem Písma svatého spravoval, Duchem svatým posvěcoval a láskou sjednocoval, a tak k sobě připoutával k věčnému obecenství v království Božím.
ot.330-332: Chléb a kalich s vínem jsou znamením a potvrzením Kristovy svátostné přítomnosti ve společenství církve slavící večeři Páně. Kristus je při večeři Páně přítomen v moci Ducha svatého těm, kdo v něho věří. Přijímání pod obojí způsobou – dědictví husitské reformace.
ot.337: Manželství: Svátost, v níž se muž a žena v lásce navždy spojují a jsou Duchem svatým posvěcováni, aby byli společně Božím obrazem v Kristu.
ot.339: Útěcha nemocných: Těžce nemocný je Duchem svatým posilován a potěšován ve víře v život věčný v Ježíši Kristu.
ot.342-345: Obecné kněžství všech pokřtěných i svátostné kněžství mají základ v kněžství Kristově. „Kněžství Boží církve záleží v milosti vyvolení k obětnímu obecenství v jediné pravé oběti Ježíše Krista." Pravým knězem Božího lidu je Kristus sám. Od roku 1947 přijímají kněžské svěcení i ženy.

Celkem CČSH podržela sedm svátostí: křest, biřmování, pokání, večeři Páně, manželství, útěchu nemocných, kněžské svěcení.

===== STRUČNÝ KOMENTÁŘ K ZÁKLADŮM VÍRY (sněm 2014) =====

I. ZÁKLADNÍ VYZNÁNÍ A EKUMENICKÝ KONTEXT:
- Věříme v jediného Boha Otce i Syna i Ducha svatého, pramen dokonalé lásky, jednoty a života.
- Věříme, že Boží dílo záchrany člověka, dokonané Ježíšovou smrtí kříže, jeho vzkříšením a sesláním Ducha svatého, se v moci Ducha svatého zpřítomňuje, aktualizuje a šíří prostřednictvím jedné, svaté, obecné a apoštolské Boží církve.
- Očekáváme konečné završení Božího spásného díla eschatologickým zjevením Boží slávy a plným nastolením Božího království, kdy bude „Bůh všechno ve všem" (1 K 15,28).

II. DUCH KRISTŮV – SVRCHOVANÁ AUTORITA:
- Svrchovanou autoritou ve věcech nauky a praxe je vzkříšený Pán Ježíš Kristus, v Duchu svatém přítomný a jednající ve své církvi.
- Duch Kristův oživuje literu Písma, uvádí Boží církev do veškeré pravdy a probouzí víru v srdci člověka.
- Duch Kristův je dárce lásky, radosti, pokoje, trpělivosti, laskavosti, dobroty, věrnosti, tichosti a sebeovládání (Ga 5,22-23).

III. ZPŘÍTOMNĚNÍ JEŽÍŠE KRISTA (centrální liturgický pojem CČSH):
- Ježíš se svým spásným dílem stává na základě svého příslibu mocí Ducha svatého v liturgickém jednání církve osobně a zcela jedinečně přítomným.
- „Dává se Otci i lidem a jedná ke spáse všech."
- Centrální body liturgie jsou čtení Písma s výkladem, modlitba a zpřítomnění Poslední večeře Páně.

IV. VZTAH CÍRKVE K IZRAELI:
- „Církev Kristova jest církví Boží proto, že ji jako dědičku Boží církve izraelské svolává, oživuje a spravuje v Ježíši Kristu Bůh sám." (ot. 3)
- Vyvolení Božího lidu Izraele dál trvá a má spolu s církví Kristovou své místo v Božím plánu spásy (Ř 11).

V. KRISTŮV LIDSKÝ PŮVOD A VZKŘÍŠENÍ:
- Ježíšovo početí z Ducha svatého a narození z Marie jsou znamením nového počátku.
- Víra ve zmrtvýchvstání je založena na osobním setkání se Vzkříšeným.
- Vzkříšením dochází k transformaci „těla fyzického" v „tělo duchovní" – „zcela naplněný Duchem svatým".

VI. LITURGIE PODLE PATRIARCHY KARLA FARSKÉHO:
- Bohoslužba CČSH tvoří syntézu liturgických prvků východních, západních a evangelických.
- Sedm částí: 1. Úvod, 2. Modlitby (tužby), 3. Zvěstování (čtení Písma, kázání, vyznání víry), 4. Obětování, 5. Zpřítomnění Ježíše Krista, 6. Přijímání, 7. Požehnání.

VII. EKUMENICKÁ OTEVŘENOST:
- Stůl Páně je otevřen pro všechny pokřtěné toužící po svátosti s respektem svobody svědomí.
- Podmínky pro přijímání večeře Páně: křest, víra v Ježíše Krista, kající úkon a vnitřní připravenost.

VIII. DALŠÍ TEOLOGICKÝ VÝVOJ:
- „Na víře našich sborů je třeba stále odpovědněji ve světle Božího Slova a pod mocí Kristova Ducha pracovat, ale nic podstatného nemusí být v ní měněno."
- Presbyterní zřízení s episkopálními prvky – demokratické řízení s duchovními i volenými laiky.

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
