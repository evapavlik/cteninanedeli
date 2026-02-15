import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
}

// Fallback theological profile (used only if DB is empty – seeds the DB on first run)
const CCSH_THEOLOGICAL_PROFILE_FALLBACK = `
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
ot.95: Úkolem teologie a věrouky je pečovat o čistotu a věrnost církve a zkoumat, zda se v ní věrně hlásá Slovo Boží.
ot.96: Zvěst církve je nesena vírou církve.
ot.97: Víra církve je stručně vyjádřena ve vyznání víry.
ot.98: Vyznání víry je odpovědný hlas církve o tom, jak porozuměla Božímu Slovu, a proto pravidlo, podle něhož má být v církvi Boží Slovo hlásáno.
ot.99: Zjevení v náboženské zkušenosti je Bůh sám, který vstoupil do osobního obecenství s námi v našich srdcích.
ot.100: Víra je důvěra v odpuštění hříchů a naděje života věčného v poslušné oddanosti neviditelnému Bohu, který nás se sebou smířil v Ježíši Kristu.

===== ČÁST III: O VÍŘE (ot. 100-232) – úplné otázky =====

ot.101: Pravá víra se nazývá vírou ospravedlňující.
ot.102: Ospravedlňující víra se projevuje svobodou od hříchu, pravou láskou a jejími skutky.
ot.103: Obsah naší víry je vyjádřen ve Vyznání víry.
ot.105: První článek zní: Věříme v Boha jednoho, Ducha věčného a Tvůrce všeho, Otce Ježíše Krista i Otce našeho, jenž od věčnosti vládne královstvím duší našich.
ot.106: Věříme v živého a osobního Boha Abrahamova, Izákova a Jákobova, jenž mluvil skrze proroky a zjevil se v Ježíši Kristu.
ot.107: Boha nazýváme živým proto, že je Pán a Stvořitel, který svobodně a svrchovaně vstupuje do života člověka.
ot.108: Boha nazýváme osobním proto, že je moudrá, sebe vědomá a sebe určující svatá vůle, že slyší a vyslýchá modlitby a slitovává se.
ot.109: Názvy Otec, Syn a Duch vyjadřují trojjediný život jednoho a téhož Boha, který se zjevuje v Slovu čili Synu jako Otec a vstupuje do obecenství s námi jako Duch svatý.
ot.110: Slovy „Ducha věčného a Tvůrce všeho" vyznáváme Boha jako neviditelného Stvořitele, jenž stvořil svět z ničeho a dále v něm tvoří.
ot.111: Starozákonnímu podání o způsobu stvoření rozumíme jako starověkému vyjádření víry ve Stvořitele pomocí názorů a představ o světě, které věda překonala.
ot.112: Vědecké poznání světa a jeho vývoje víru ve Stvořitele neruší, nýbrž naopak této víře odpovídá na otázku, jak byl svět stvořen a jak v něm Bůh tvoří.
ot.113: Stvoření světa Bohem je neviditelným pozadím vývoje a vývoj světa je viditelným popředím stvoření.
ot.114: Slovy „Otce Ježíše Krista i Otce našeho" vyznáváme víru v Boha dokonale sjednoceného s Ježíšem Kristem, v němž i nás k sobě připoutává svazkem synovské poslušnosti, důvěry a lásky.
ot.115: Slovy „jenž od věčnosti vládne královstvím duší našich" vyznáváme, že království Boží je pro nás připraveno od věčnosti u Boha.
ot.116: Království Boží čili nebeské je Boží vláda uskutečňující se v třech stupních.
ot.117: První stupeň Božího království záleží v tom, že Bůh od stvoření ovládá svou mocí vše, kromě svobody člověka.
ot.118: Druhý stupeň záleží v tom, že skrze Ježíše Krista Bůh svou láskou vládne i ve svobodné a odpovědné poslušnosti a důvěře věřících.
ot.119: Třetí stupeň záleží v plném a všem zjevném budoucím vítězství Ježíše Krista a ve věčné Boží vládě v slávě.
ot.120: Druhý článek zní: Věříme v Ježíše Krista, Syna Božího, Světlo ze Světla, Život ze Života, jenž od Otce přišel, životem svým zlo světa i smrti přemohl, aby získal nám království Boží věčné.
ot.121: Naše víra v Ježíše Krista je poslušná důvěra v něho jako Spasitele, v němž Bůh pro nás učinil vše a je s námi k naší spáse.
ot.122: Slovo „Kristus" znamená Duchem obdařeného mesiášského Krále, Spasitele, zaslíbeného skrze proroky.
ot.123: Naše víra v Ježíše jako Syna Božího je poslušná důvěra v něho jako prvorozeného bratra a Pána našeho.
ot.124: Bůh se stal naším Pánem v našem prvorozeném bratru proto, aby se nám přiblížil, nás se ujal a svou slitovnou láskou navěky spasil.
ot.125: Ježíš Kristus je naším bratrem ve svém pravém a plném lidství.
ot.126: Ježíšovo prvorozenství záleží v tom, že Bůh je s ním od počátku dokonale sjednocen.
ot.127: Ježíš Kristus je náš Pán tím, že Bůh v dokonalé jednotě s ním se nám v něm zjevuje, odpuštěním vin ze hříchu vytrhuje, nám vládne a k sobě nás na věky připoutává.
ot.128: Nejsme rovni Ježíši Kristu, protože v nás není dokonalé jednoty s Bohem.
ot.129: Dokonalé jednoty s Bohem doufáme dosáhnout z milosti v království Božím v slávě skrze Ježíše Krista.
ot.130: Od tohoto cíle nás odděluje hranice smrti, vzkříšení a konečného soudu.
ot.131: Jednotu Boha s Ježíšem Kristem rozumově pochopit a pojmově vyjádřit nemůžeme, protože je to skutečnost budoucího věku (eschatologická).
ot.132: Jednotu Boha s Ježíšem Kristem můžeme naznačovat jen obrazně.
ot.133: V našem Vyznání víry naznačujeme jednotu Boha s Ježíšem Kristem obrazy: Syn Boží, Světlo ze Světla, Život ze Života, jenž od Otce přišel.
ot.134: O Ježíšově lidském původu soudíme, že Ježíš byl synem Josefovým a Mariiným.
ot.135: Ježíšovo početí z Ducha svatého a narození z Marie jsou znamením nového počátku v hříšném lidstvu, vycházejícího čistě z iniciativy Boží.
ot.148-150: Víra učedníků ve zmrtvýchvstání nebyla založena na prázdném hrobu, nýbrž na osobním setkání se Vzkříšeným. Vzkříšením dochází k transformaci „těla fyzického" v „tělo duchovní" (1 K 15,42-45).
ot.152: Vzkříšený a oslavený Ježíš Kristus zůstává člověkem v dokonalé jednotě s Bohem.
ot.153: Lidství vzkříšeného Ježíše Krista je oslavené a duchovní.
ot.154: Ježíš pro sebe jako budoucího oslaveného Pána užíval názvu Syn člověka.
ot.156: Třetí článek zní: Věříme v Ducha Božího, jenž od věčnosti do věčnosti vše oživuje, v Ježíši Kristu se zjevil, skrze proroky a otce naše mluvil a v nás chce přebývat.
ot.157: Duch svatý čili Boží je Bůh sám, který mluvil skrze proroky, zjevil se v Ježíši Kristu a promlouval také skrze naše otce.
ot.158: Zvláštním znakem Boha jako Ducha svatého je, že od věčnosti do věčnosti vše oživuje a v nás chce přebývat.
ot.159: Přebývání Ducha svatého v nás je osobní přítomnost Boha, který vstoupil s námi do obecenství v našich srdcích.
ot.160: Dílem Ducha svatého v nás je osvícení mysli, otevření srdce, přivlastnění smíření v Kristu, vlití lásky, spojení v jednotu víry, proměnění pokáním v dítky Boží, obdarování duchovními dary a poslání ke svědectví.
ot.161: Naši otcové jsou všichni svědkové, kteří nám předali pochodeň víry, zvláště otcové české i další reformace.
ot.162: Čtvrtý článek zní: Věříme v Život věčný, Dobra, Pravdy a Krásy, tak jako jsme přesvědčeni o smrti zla i zlých.
ot.163: Životem věčným rozumíme účast na životě Božím v Ježíši Kristu, která začíná již nyní skrze víru láskou účinkující.
ot.164: Naděje věčného života je víra v život věčný s Kristem v budoucí slávě.
ot.165: Obsah života věčného naznačujeme pojmy Dobra, Pravdy a Krásy.
ot.167: Poměr Boha a člověka ve věčné slávě naznačujeme obrazem patření Bohu „tváří v tvář" (1 K 13,12).
ot.168: Chceme vyjádřit naději v milost dokonalé jednoty Boha se spasenými lidmi po vzkříšení.
ot.169: Tato jednota neznamená proměnu lidství v božství, nýbrž plnou účast oslaveného lidství na životě Božím.
ot.170: Svou naději života věčného zakládáme na Ježíši Kristu.
ot.171: K naší víře v život věčný se pojí přesvědčení o smrti zla i zlých.
ot.172: Smrt zla i zlých nastane konečným soudem a nastolením Božího království v slávě.
ot.173: Konečný Boží soud plyne z Boží svatosti a z lidské odpovědnosti.
ot.174: Bůh neúčtuje s hříchem a zlem hned proto, že je milostivý, dlouho čekající na obrácení hříšníka.
ot.175: Důkazem milostivé Boží trpělivosti je trvání lidských dějin a našeho života.
ot.176: Jen Otec nebeský ví, kdy nastane konec lhůty.
ot.177: Pro každého z nás končí tato lhůta smrtí.
ot.178: Naše neznalost dne a hodiny smrti nás nabádá k pokání a návratu k Bohu.
ot.179: Tělesná smrt je ukončení a uzavření časného života ke konečnému soudu.
ot.180: Po smrti život je, ale nezáleží v pokračování, nýbrž v duchovním obnovení, dovršení a zvěčnění života pozemského.
ot.181: Duchovní obnovení, dovršení a zvěčnění pozemského života se děje vzkříšením.
ot.182: Vzkříšení je duchovní obnovení, dovršení a zvěčnění pozemského života ukončeného smrtí.
ot.183: Vzkříšení se týká každého člověka.
ot.184: Vzkříšení se děje hned po smrti.
ot.185: Údělem nekajících a zatvrzelých hříšníků po smrti je zoufalství odloučenosti od Boha i od lidí.
ot.186: Údělem kajících a spasených hříšníků po smrti je blaženost v Bohu s Kristem v obecenství spasených.
ot.189: Budeme souzeni za celý svůj život.
ot.190: Smrt zla znamená konec hříchu a všeho zla, i smrti.
ot.191: Smrt zlých čili věčná smrt je obrazný název pro věčný úděl zatvrzelých hříšníků.
ot.192: Věčná smrt záleží v odsouzení a zavržení hříšného života k věčné temnotě v odloučení od Boha.
ot.193: Před věčnou smrtí zachraňuje Bůh v Ježíši Kristu.
ot.194: K záchraně před věčnou smrtí je třeba ospravedlňující víry láskou účinkující.
ot.195: Potřeba ospravedlňující víry nás zavazuje k horlivému hlásání evangelia všem lidem.
ot.196: O těch, kdo evangelium bez vlastní viny nepoznali, máme naději, že budou souzeni podle možností, které jim byly dány.
ot.197: Věčný život v slávě je oslavení a povýšení lidského života ospravedlněného v Kristu k věčnému obecenství s Bohem.
ot.198: Ty, jimž je zaslíbeno blaho věčného života, nazývá Ježíš Kristus blahoslavenými.
ot.199: Zaslíbení věčného života se týká také hmotného světa.

===== O PŮVODU A HŘÍCHU ČLOVĚKA (ot. 204-232) =====

ot.204: Člověk je stvořen Bohem jako tělesně-duchovní bytost.
ot.205: Člověk jako Boží obraz je bytost odpovědná, obdařená rozumem a svobodou.
ot.208: Hřích je svévolné porušení Boží vůle a řádu.
ot.209: Člověk se hříchem oddálil od Boha.
ot.215: Bůh stvořil člověka, aby byl jeho obrazem, jako muže a ženu.
ot.217: Ráj je obecenství s Bohem, harmonie, nevinnost a blaženost, pro něž byl člověk stvořen.
ot.218: Prvotní hřích je odvrat člověka od Boha k sobě samému.
ot.219: Podstatou prvotního hříchu je touha po bohorovnosti.
ot.220: Následkem hříchu je vzdálenost od Boha.
ot.222: Tuto vzdálenost může překonat jediný Bůh sám svou láskou trpící našimi hříchy.
ot.223: Trpící Boží láska překonala vzdálenost mezi námi a Bohem v Ježíši Kristu.
ot.224: Odpuštění vin je Boží ujištění člověka ve víře, že jeho viny jsou v Ježíši Kristu zahlazeny.
ot.225: Had v ráji zobrazuje temnou moc pokušení – satana nebo ďábla.
ot.226: Vyhnání z ráje je hříchem způsobené odloučení od Boha a zmaření harmonie.
ot.227: Do obecenství s Bohem nás opět přivádí Ježíš Kristus.
ot.228: Spása v Ježíši Kristu nás nezbavuje časných následků našich hříchů.
ot.229: Obecenství s Bohem v Kristu není totožné s tím, které jsme ztratili, protože se nám dostává spásy ze hříchu.
ot.230: V Kristu dosahujeme svého určení od Boha, ale již jen jako hříšníci.
ot.231: Tím nejsme ochuzeni, nýbrž obohaceni, protože teprve jako hříšníci poznáváme hlubiny Boží lásky.
ot.232: K našemu určení od stvoření patří, aby v nás přebýval Duch svatý, abychom byli šťastni, žili v Boží Pravdě a života věčného dosáhli.

===== ČÁST IV: O BOŽÍM PŘIKÁZÁNÍ (ot. 233-273) – úplné otázky =====

ot.233: Božím přikázáním rozumíme zákon života daný Bohem ve smlouvě Božímu lidu.
ot.234: Boží smlouvou rozumíme Starou smlouvu danou Bohem lidu izraelskému a Novou smlouvu danou nám v Ježíši Kristu.
ot.235: Boží přikázání Staré smlouvy jsou vyjádřena v Desateru.
ot.236: Nová smlouva v Ježíši Kristu není zrušením přikázání Desatera, nýbrž jejich naplněním.
ot.237: Desatero ve zkrácené podobě: 1. Nebudeš mít jiného boha mimo mne. 2. Nezobrazíš si Boha zpodobením. 3. Nezneužiješ jméno Hospodina. 4. Pamatuj na den odpočinku. 5. Cti otce i matku. 6. Nezabiješ. 7. Nesesmilníš. 8. Nepokradeš. 9. Nevydáš křivé svědectví. 10. Nebudeš dychtit po ničem, co patří tvému bližnímu.
ot.238: Smysl a význam Desatera se nám plně otvírá v Ježíši Kristu.
ot.240: V prvním přikázání nás Bůh oslovuje jako svatý Pán a Vysvoboditel z hříchu a přikazuje, abychom ho ctili a poslouchali.
ot.241: Boží svatost znamená, že Pánu Bohu nemůže být nikdo a nic rovno.
ot.243: V druhém přikázání nám Bůh zakazuje zhotovovat si zpodobení Boha a klanět se jim.
ot.244: Hřích z druhého přikázání se nazývá modloslužbou.
ot.245: Do modloslužby patří služba mamonu, prokazování bohopocty obrazům, sochám, ostatkům, živlům chleba a vína při večeři Páně i knize Písma svatého.
ot.246: Úcta k Písmu se stává modloslužbou, když místo Boha jsou za božské považovány kniha a text Písma.
ot.248: V třetím přikázání nám Bůh zakazuje brát nadarmo jeho jméno.
ot.249: Písmo rozumí Božím jménem Boha samého v jeho zjevení, zvláště v Ježíši Kristu.
ot.251: Ve čtvrtém přikázání nám Bůh ukládá pracovat ve všední dny, ale v den Páně obnovovat svazky s ním v obecenství církve.
ot.252: Čtvrté přikázání nezakazuje všechnu činnost, ale předpokládá činy nutné k zachování zdraví a dobra bližnímu.
ot.253: Pán Ježíš čtvrté přikázání nezrušil, nýbrž ukázal správné chápání a plnění.
ot.255: V pátém přikázání nám Bůh poroučí ctít rodiče, které nám dal, aby nás naučil vděčnosti, odpovědnosti, úctě a lásce.
ot.258: V šestém přikázání si Bůh vyhrazuje život každého člověka a prohlašuje za hřích vraždu, sebevraždu a válku.
ot.260: V sedmém přikázání nám Bůh zakazuje všeliké smilstvo mimo odpovědný a věrný svazek manželský.
ot.262: V osmém přikázání nám Bůh zakazuje osvojovat si, mařit a zcizovat životní prostředky a plody práce bližních.
ot.263: Osmé přikázání se netýká pouze jednotlivců, nýbrž také nespravedlivých společenských řádů umožňujících vykořisťování.
ot.265: V devátém přikázání nám Bůh zakazuje pomlouvat, osočovat a lživě svědčit proti bližnímu.
ot.267: V desátém přikázání nám Bůh zakazuje závist a hříšnou žádostivost.
ot.268: Smysl celého Desatera je křesťanská láska k Bohu a k bližnímu.
ot.269: Křesťanská láska se projevuje odpovědnou účastí v zápase proti zlu a skutky milosrdenství.
ot.270: Ježíš Kristus naplňuje Desatero tak, že hříšníkům dává pravou lásku a uschopňuje je plnit Boží přikázání.
ot.271: Láska nečiní Desatero zbytečným, nýbrž nutným.
ot.272: Skutky pravé lásky jsou možné z ospravedlňující víry.
ot.273: Při konečném soudu rozhodnou skutky lásky z ospravedlňující víry.

===== ČÁST V: O MODLITBĚ (ot. 274-306) – úplné otázky =====

ot.274: Modlitba je otevření srdce Bohu myšlenkou a slovem díků, oslavy a prosby.
ot.275: Důvěru ve vyslyšení čerpáme z důvěry v Boha i z ujištění Spasitele.
ot.276: Nevyslyšená modlitba je znamením naší hříšnosti, zkouškou víry a školou poznávání Boží vůle.
ot.277: Máme se modlit vytrvale, trpělivě, pokorně a odevzdaně do vůle Boží.
ot.278: Vzorem modliteb je Otčenáš – modlitba, které nás naučil Spasitel.
ot.279: Modlitba Páně zní: Otče náš, který jsi v nebesích, posvěť se jméno tvé. Přijď království tvé. Buď vůle tvá jako v nebi tak i na zemi. Chléb náš vezdejší dej nám dnes a odpusť nám naše viny, jako i my odpouštíme našim viníkům. A neuveď nás v pokušení, ale zbav nás od zlého. Neboť tvé je království i moc i sláva na věky. Amen.
ot.281: Oslovení „Otče náš, který jsi v nebesích" vyjadřuje naši důvěru k Bohu Otci.
ot.282: Nebesa jsou skrytá Boží všudypřítomnost, plná Božího světla a slávy.
ot.284: Posvěcení Božího jména se děje, když Boha uznáváme jako svatého a vzdáváme mu čest.
ot.285: Posvěcení Božího jména se dokonává, když Boha dobrovolně posloucháme a milujeme.
ot.287: Druhou prosbou prosíme o příchod Božího království v plnosti.
ot.289: Třetí prosba je doplněním prosby druhé i výrazem odevzdanosti do Boží vůle.
ot.291: Čtvrtou prosbou prosíme o dostatek pokrmu, v jehož přijímání chce být s námi přítomen náš Pán.
ot.292: Svůj vezdejší chléb máme přijímat s díkůčiněním a modlitbou, ve víře v přítomnost Pána jako chleba života.
ot.293: Křesťanský poměr k vezdejšímu chlebu nás zavazuje k ochotě ke společenství hmotných darů a k pilné a poctivé práci.
ot.295: Pátou prosbou vyznáváme Bohu své hříchy a prosíme o odpuštění.
ot.297: Doplňkem páté prosby vyjadřujeme svůj závazek Bohu za jeho odpuštění.
ot.299: Šestou prosbou prosíme, aby nás Bůh ušetřil příležitostí lákajících ke hříchu.
ot.300: Šestou prosbou vyslovujeme víru, že Otec vládne i nad pokušením.
ot.301: Sedmá prosba zní: Ale zbav nás od zlého.
ot.302: Sedmou prosbou prosíme, aby nás Bůh vysvobodil z moci zla.
ot.303: Sedmou prosbou vyslovujeme víru, že v Ježíši Kristu poražená moc zla je pod vládou Otce.
ot.304: Závěr Otčenáše: Neboť tvé jest království, i moc i sláva na věky. Amen.
ot.305: Závěr Otčenáše vyjadřuje pokoru, poddanost a podřízenost Bohu jako jedinému Pánu.
ot.306: Slovo „amen" vyjadřuje naši důvěru v Boha, odevzdanost do jeho vůle i touhu po splnění proseb.

===== ČÁST VI: O SVÁTOSTECH (ot. 307-345) – úplné otázky =====

ot.307: Svátost je jednání, jímž se obecenství věřících v Duchu svatém činně podílí na milosti Božího Slova přítomného skrze slyšené svědectví Písma a svátostné úkony.
ot.308: Svátost se liší od kázání tím, že je obecenstvím, děje se v činné účasti věřících a podílíme se na ní více smysly.
ot.309: Svátost se od kázání neliší svým obsahem, jímž je Slovo Boží.
ot.310: Význam svátosti je v tom, že Boží Slovo je teprve ve svátosti činně, viditelně a veřejně přijímáno, spojujíc údy církve v obecenství v Kristu.
ot.311: Společným účelem kázání i svátosti je, aby Slovo Boží vstoupilo do srdcí, mocí Ducha sv. probudilo víru, dalo jistotu spásy a proměnilo život.
ot.312: Křest je svátost první duchovní obrody, v níž Duch svatý přivtěluje křtěnce jednou provždy k Boží církvi a osvojuje mu milost Kristova křtu, kříže a vzkříšení.
ot.313: Zevní úkon křtu záleží v lití vody na temeno hlavy a ve výroku: „N., křtím tě ve jméno Otce i Syna i Ducha svatého."
ot.314: K prožití křestní obrody je třeba víry.
ot.315: Křest nemluvňat má smysl, protože Duch svatý nepůsobí jen ve vědomí, ale i v podvědomí a nevědomí lidí.
ot.316: Dospělý prožívá obrodu při křtu, nedospělý až ve svátosti biřmování.
ot.317: Křest nemluvňat není proti Boží vůli, neboť Bůh, který je stvořil, chce je také spasit.
ot.318: Rodiče jsou při křtu přítomni, aby Bohu za dítko děkovali a slíbili péči o jeho život v Kristu.
ot.319: Křest zavazuje církev, rodiče a kmotry k svědomité péči o víru pokřtěného.
ot.320: Biřmování je svátost, v níž Duch svatý oživuje a upevňuje víru pokřtěného a činí z něho uvědomělého úda Boží církve.
ot.321: Zevní úkon biřmování záleží v kladení rukou a žehnání křížem se slovy: „Přijmi pečeť darů Ducha svatého. Amen."
ot.322: Večeře Páně je svátostný hod lásky, v němž je se svou obcí neviditelně přítomen její ukřižovaný, vzkříšený a oslavený Pán, aby ji slovem Písma svatého spravoval, Duchem svatým posvěcoval a láskou sjednocoval.
ot.323: Zevní úkon večeře Páně záleží v obětování, zpřítomnění, lámání chleba a přijímání chleba s vínem.
ot.324: Úkon obětování je pozvedání chleba a kalicha jakožto znamení Ježíšova těla a krve a díkůvzdání.
ot.325: Úkon zpřítomnění je liturgické znázornění poslední večeře Páně s použitím chleba a kalicha.
ot.326: Úkon lámání chleba je liturgické znázornění a zpřítomnění Ježíšovy oběti za nás.
ot.327: Přijímání chleba s vínem je svátostné znamení, pod nímž obec z milosti Ducha svatého vírou přijímá neviditelně přítomného Krista.
ot.328: Večeře Páně je středem pravidelných bohoslužeb podle liturgie.
ot.329: Při pravidelných bohoslužbách přijímá za shromážděnou obec kněz, přijímání celou obcí je vázáno na svátost pokání se zpovědí (dnes věřící přistupují k večeři Páně každou neděli).
ot.330: Ježíš Kristus je při společné večeři Páně přítomen obci jako hlava svého těla zvlášť významným způsobem.
ot.331: Ježíš Kristus je při večeři Páně přítomen v moci Ducha svatého těm, kdo v něho věří.
ot.332: Ježíš Kristus není přítomen v chlebě a víně, ale přichází do našich srdcí skrze svátostnou zvěst.
ot.333: Svátost pokání je jednání, kterým se věřící obec připravuje ke svátosti večeře Páně zpytováním svědomí, lítostí, smířením a předsevzetím nového života.
ot.334: Zevní úkon pokání záleží v otázkách duchovního, přiznání hříchů, vyznání lítosti a modlitbě za odpuštění.
ot.335: Soukromá zpověď je možná jako součást svátosti pokání a v některých případech je nutná.
ot.336: Duchovní je po zpovědi vázán zpovědním tajemstvím.
ot.337: Manželství je svátost, v níž se muž a žena v lásce navždy spojují a jsou Duchem svatým posvěcováni, aby byli Božím obrazem v Kristu a základem rodiny.
ot.338: Zevní úkon manželství záleží v slibu manželské lásky, věrnosti a oddanosti a společném pití z kalicha.
ot.339: Útěcha nemocných je svátost, v níž těžce nemocný je Duchem svatým posilován a potěšován ve víře v život věčný v Ježíši Kristu.
ot.340: Zevní úkon útěchy nemocných záleží v čtení Písma, modlitbách a znamenání nemocného křížem.
ot.341: K útěše nemocných se připojují svátost pokání a svátost večeře Páně.
ot.342: Svěcení kněžstva je svátost, v níž Boží církev přenáší služby svého kněžství na osoby způsobilé a Duch svatý přistupuje ke svěcenci.
ot.343: Zevní úkon svěcení záleží ve vzkládání rukou a slovy: „Osvěcuj a posiluj tě Bůh Duchem svým svatým, amen."
ot.344: Kněžství Boží církve záleží v milosti vyvolení k obětnímu obecenství v jediné pravé oběti Ježíše Krista.
ot.345: Přenesení služeb kněžství na svěcence znamená pověření k péči o obětní obecenství obce – konáním bohoslužeb, hlásáním Slova Božího, vysluhováním svátostí a pastýřskou službou.
ot.346: Přenesením služeb na svěcence kněžství Boží církve nepomíjí, nýbrž se dále uskutečňuje.

Celkem CČSH podržela sedm svátostí: křest, biřmování, pokání, večeři Páně, manželství, útěchu nemocných, kněžské svěcení.
CČSH uchovává tři podoby svátostného kněžství: jáhenskou, kněžskou a biskupskou. Pravým knězem Božího lidu je Kristus sám. Od roku 1947 přijímají kněžské svěcení i ženy.

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

// Simple hash function for cache key
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { text, mode } = await req.json();

    // Validate text parameter
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text parameter is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MAX_TEXT_LENGTH = 50000;
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate mode parameter
    if (mode && !['annotate', 'context'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isContext = mode === "context";
    const profileSlug = "ccsh";

    // 1. Load theological profile from DB (fallback to hardcoded)
    let theologicalProfile = CCSH_THEOLOGICAL_PROFILE_FALLBACK;
    const { data: profileRow } = await supabase
      .from("theological_profiles")
      .select("content")
      .eq("slug", profileSlug)
      .maybeSingle();

    if (profileRow?.content && profileRow.content.length > 500) {
      theologicalProfile = profileRow.content;
      console.log("Using theological profile from DB");
    } else {
      // Seed DB with fallback profile
      console.log("Seeding theological profile into DB");
      await supabase
        .from("theological_profiles")
        .upsert(
          { slug: profileSlug, name: "Církev československá husitská", content: CCSH_THEOLOGICAL_PROFILE_FALLBACK },
          { onConflict: "slug" }
        );
    }

    // 2. Check AI cache
    const textHash = await hashText(text);
    const cacheMode = isContext ? "context" : "annotate";

    const { data: cached } = await supabase
      .from("ai_cache")
      .select("result")
      .eq("text_hash", textHash)
      .eq("mode", cacheMode)
      .eq("profile_slug", profileSlug)
      .maybeSingle();

    if (cached) {
      console.log("Returning cached AI result for mode:", cacheMode);
      if (isContext) {
        return new Response(JSON.stringify({ context: cached.result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ annotated: cached.result.annotated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate via AI
    const systemPrompt = isContext
      ? `${theologicalProfile}

Tvým úkolem je pro zadaný biblický text (jedno nebo více čtení) vytvořit stručný kontextový průvodce v duchu teologie CČSH. Buď maximálně stručný – lektor potřebuje rychlý přehled, ne esej.

Vrať JSON objekt s polem "readings", kde každý prvek odpovídá jednomu čtení a má tyto klíče:
- "title": název čtení (např. "První čtení – Iz 58,7-10")
- "intro": 1-2 věty, které může lektor říct shromáždění PŘED čtením, aby zasadil text do kontextu. Formuluj v duchu husitské teologie – zdůrazni Kristův odkaz, reformační tradici, obecenství a aktuálnost poselství pro dnešek.
- "context": jeden plynulý odstavec (3-4 věty), který stručně shrne: kdo jsou klíčové postavy textu, jaké je historické pozadí (kdy, kde, proč text vznikl) a jaké je hlavní poselství z perspektivy CČSH. Nepoužívej odrážky ani podnadpisy – piš jako souvislý text.
- "delivery": stručný popis tónu přednesu (1 věta, např. "Čtěte slavnostně a povzbudivě, s důrazem na zaslíbení.") následovaný 0-2 relevantními citacemi ze Základů víry CČSH ve formátu: "ot.XY: plné znění – [proč je relevantní]". Vyber JEN citace, které opravdu osvětlují téma čtení – raději žádnou než nepřesnou.

Vrať POUZE validní JSON, žádný markdown ani komentáře.`
      : `${theologicalProfile}

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

        // Save to AI cache
        await supabase.from("ai_cache").upsert(
          { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: parsed, model_used: "google/gemini-3-flash-preview" },
          { onConflict: "text_hash,mode,profile_slug" }
        );
        console.log("Cached context result");

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

    // Save annotate result to AI cache
    await supabase.from("ai_cache").upsert(
      { text_hash: textHash, mode: cacheMode, profile_slug: profileSlug, result: { annotated: content }, model_used: "google/gemini-3-flash-preview" },
      { onConflict: "text_hash,mode,profile_slug" }
    );
    console.log("Cached annotate result");

    return new Response(JSON.stringify({ annotated: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("annotate error:", e);
    return new Response(
      JSON.stringify({ error: "Došlo k chybě při zpracování požadavku" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
