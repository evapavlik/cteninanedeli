import { describe, it, expect } from "vitest";
import { parseNadPismem, parseBiblicalRefs } from "./czech-zapas-parser";

// Real text from the "Nad písmem" section — Český zápas 2026/9
const SAMPLE_NAD_PISMEM = `Nad Písmem
Narození z Ducha J 3,1-17
Milé sestry a milí bratři,
v 2. neděli postní se dostáváme k textu z Janova
evangelia 3,1-17. K poněkud složitějšímu, ale přesto
důležitému textu. Příběh, nad nímž se dnes zamýšlíme,
začíná příchodem Nikodéma, který přichází za Ježíšem.
Co se o něm dozvídáme?
Nikodém je představený židovské rady, tedy člověk znalý
židovské víry, zákonů a tradic. O Nikodémovi se v Ja-
nově evangeliu později dočítáme jako o tom muži, který
brání Ježíše proti obvinění (J 7,50-51), či při poskytnutí
vonných látek při obvazování Ježíšova těla (J 19,39).
Ve spojitosti s oslovením, které k Ježíši pronáší („rabbi",
tedy můj učiteli), je možné z textu vyčíst určitou Ni-
kodémovu náklonnost, která je potvrzena jeho slovy:
„Víme, že jsi učitel, který přišel od Boha".
Přesto nám z následujících vět je jasné, že Ježíše uznává
jako učitele, ale neuznává ho ještě jako Mesiáše. Ačkoli
nám text neříká důvod Nikodémovy návštěvy, přesto mu
Ježíš říká: „Nenarodí-li se kdo shůry, nemůže spatřit
království Boží." Můžeme se domnívat, že tato věta byla
právě reakcí na Nikodémovo nepřijetí Ježíše jako
Mesiáše. Neb ten, kdo se nenarodil shůry, nemůže Ježíše
přijmout jinak než pouze jako rabbiho.
Tedy základní myšlenkou textu je, že člověk se musí
narodit z Ducha (shůry), aby přijal Ježíše jako Mesiáše
a mohl dojít království Božího. Můžeme říci, že člověk
musí projít jistým znovuzrozením. Nikodém tomuto
nerozumí, neb přichází s otázkou, jak se může člověk
znovu narodit. Ježíš ho kárá. Však duchovní znovu-
zrození zažívali proselyté (pohané okolních národů) již
v tehdejší době při přechodu k židovství. V rámci
přechodu k judaismu zde dochází i k ponořování do vody
(mikve). Z tohoto hlediska by Nikodém měl mít alespoň
trochu ponětí, o čem Ježíš hovoří, když praví o narození
se z Ducha a z vody. Ježíš jde zde však nad rámec těchto
tradic. Hovoří zde o ponoření do Ducha, vyjití ze tmy do
světla a o věčném životě.
V hebrejštině či řečtině nalezneme pro výraz duch, vítr
jedno slovo ruach/pneuma. Doplníme-li si do věty „Vítr
vane, kam chce, jeho zvuk slyšíš, ale nevíš, odkud při-
chází a kam směřuje" tento jednotný výraz, pochopíme,
že pneuma větru je jako pneuma Boží. Cítíme ducha, ale
nevidíme ho. Teprve, když se narodíme z neviditelného
pneumatu, můžeme spatřit Boží království. Stejně jako
pneuma dýchání dává život našemu tělu, tak pneuma
Boží nám dává život věčný (J 6,63). V textu následuje pa-
sáž zabývající se nanebevstoupením. „Nikdo nevstoupil
na nebesa, kromě toho, který sestoupil z nebes, totiž Syn
člověka…" (J 3,13) a pokračujeme dále v J 3,15: „aby
každý, kdo v něho věří, měl život věčný." Tato na-
dějeplná pasáž nám chce říci, co je smyslem Ježíšovy
služby. Je to právě umožnění lidem, aby poznali Boha
a stali se s ním jedno právě a pouze jen skrze něho – Syna
Božího. „Neboť Bůh tak miloval svět, že dal svého
jediného Syna, aby žádný, kdo v něho věří, nezahynul,
ale měl věčný život." (J 3,16)
Závěrem této vybrané pasáže se dotýkáme tématu spasení,
kterého můžeme dosáhnout pouze skrze Syna. Neb světlo
sestoupilo z nebe, aby spasilo svět, a pouze ti, kdo jsou
obnoveni Duchem, toto světlo rozpoznají a vstoupí do
království Božího.
Kateřina Kašparová`;

// Real text — CZ 2026/10 — author on same line as closing sentence
const SAMPLE_SETKANI = `NAD PÍSMEM
Setkání u studně Jan 4,3-42
Milé sestry a bratři,
přenesme se do starověkého Izraele: je
horké poledne a ke studni přichází osamo-
cená žena. Rozhlíží se. Nechce se potkat
se svými sousedy, lidmi z vesnice. Žena
s divokou minulostí, poraněnou duší,
možná zklamaná životem.
U studny potkává člověka a zapřede s ním
rozhovor. Hned je jí jasné, že to není jen
tak někdo, je to prorok. Ježíš… Mesiáš.
Překvapí ji hlubokými myšlenkami, zjeví
duchovní pravdy… ale především ji za-
skočí svou laskavostí a zájmem. Nikoho
takového nikdy nepoznala.
A když pak rozkryl její vlastní nitro, po-
znala, že se jí dotknul Bůh. Ví o ní
všechno, přesto ji nekárá, neodsuzuje. Má
jak na dlani celý její život. Ví, proč chodí
ke studni v čase, kdy tam nikdo jiný není.
Že žila s pěti muži a ten, co s ním žije teď,
není její manžel…
Toto setkání s Ježíšem proměnilo její
život. Vnitřní zábrany, které způsobovaly
strach z lidí, odcizenost a obavy, zmizely.
Už není ostýchavá, ale radostná a od-
vážná. Běží do vesnice a nadšeně všem
vypráví o Ježíši. Reakce na setkání s Ježí-
šem je nadšení, úleva a radost, potřeba
sdílení (tedy misie).
My křesťané máme často dobré biblické
základy, teologické povědomí – kdo je
Ježíš, jaké to prameny budou prýštit z na-
šeho nitra a co je ta voda života, po které
už nikdy nebudeme žíznit.
Nejde ale ani tak o to „správně věřit". Te-
prve až osobní setkání s Ježíšem může
proměnit náš život. Potřebujeme se –
stejně jako samařská žena – s Ježíšem se-
tkat. To nás změní. A následně naše sbory
a třeba i celou církev.
… a díky svědectví samařské ženy vyšli
lidé z města, celý zástup, aby se přesvěd-
čili, aby sami uviděli, a díky Jeho slovu
také uvěřili. Lucie Haltofová`;

// Real text — CZ 2026/? — reference with en-dash, author on its own line
const SAMPLE_OBROZENI = `Nad PíSMEM
Obrození shůry Jan 3,1–17
Nikodém - člověk upřímný, přemýš-
livý, hledající, toužící po pravém poznání
i životu podle Boží vůle. Doposud byla
jeho životní cesta jasně daná: studovat
Zákon Boží a žít podle něj; být dobrým
věřícím před Bohem, stejně jako učitelem
a příkladem pro druhé. Však si svým způ-
sobem života zasloužil nejedno uznání.
Byl váženým občanem Jeruzaléma. Jako
členu nejvyšší rady mu byla svěřena moc
spolurozhodovat ve věcech víry, mravů,
a tak ovlivňovat veřejný život.
Text Janova evangelia, určený k zamyš-
lení pro tuto neděli, o Nikodémově obro-
zení shůry mlčí. Protože nejde ani tak
o něj, ale o Ježíše, o jeho nabídku a o nás.
Ježíš snáší hříchy nás všech, fandí nám a raduje
se ze zázraku znovuzrození, které po-
stupně prostupuje naše postoje, myšlení,
slova, oblasti zájmů, vztah k Bohu i lidem.
Světluše Košíčková`;

// Real text — reference in parentheses, author after "Amen."
const SAMPLE_DOKAŽEME = `Nad Písmem Dokážeme říct jasně a zřetelně Ne? (L 4,1–13)
Vážené sestry, vážení bratři, pokoj vám!
Ježíš plný Ducha svatého odchází na poušť, kde tráví čtyřicet dní.
Jednalo se o přípravu na veřejné působení, na vystoupení s úkolem,
který na Ježíše čekal. Byl tam sám, jen v kontaktu se svým nebeským Otcem.
Když uběhlo oněch čtyřicet dní, dostavil se ďábel se svými třemi pokusy.
Vybízí Ježíše, aby využil svou moc k vlastnímu nasycení, nabízí mu vládu
nad světem výměnou za to, že se mu Ježíš bude klanět. Nakonec nutí Ježíše,
aby učinil pokus s připraveností andělů, kteří by ho měli chytit,
když by se vrhnul ze střechy chrámu.
Zajímavé jsou Ježíšovy reakce. Nepoužívá složité náboženské fráze,
nevyhání pokušitele pomocí nějakých tajných slov, zaklínadel, neuvrhá ho
do hlubin nebo tak něco. Ježíš klidně, bez zbytečných slov a gest ďábla odmítá.
Cituje z Písma stručně a jasně. Říká zkrátka jednoduše a vytrvale ďáblovi své Ne!
A ten posléze, když vidí, že jsou jeho pokusy marné, odchází s nepořízenou.
Ale i my se nazýváme Božími dětmi, nebo ne? Myslím, že hlavní zákeřnost
pokušení spočívá v tom, že si vůbec nevšimneme, že se jedná o dílo pokušitele.
S pomocí našeho Spasitele Ježíše bychom se tedy měli celoživotně učit říkat
svůdci, který na nás číhá: „Ne, v žádném případě, s tebou já se nebavím."
Je to ale možné. Potřebujeme k tomu sílu, kterou nacházíme v Písmu, v rozhovo-
rech s Pánem a ve společenství bratří a sester. A je ještě jedna věc, kterou
pokušitel nemůže vystát, a to je láska. Láska k Bohu i k lidem, láska dávaná
i přijímaná, přítomná všude tam, kde je opravdová a věrná Kristova Církev.
Amen. Vladislav Pek`;

// Simulated text from ČZ 11/2023 — reversed layout: heading appears AFTER the sermon.
// PDF column layout causes the section heading to render below the body.
const SAMPLE_REVERSED = `Týdeník Církve československé husitské
EDITORIAL • ZE ŽIVOTA CÍRKVE • MLÁDEŽ CČSH • NAD PÍSMEM • TÉMA MĚSÍCE
Milé sestry a bratři,
přenesme se do starověkého Izraele: je
horké poledne a ke studni přichází osamo-
cená žena. Rozhlíží se. Nechce se potkat
se svými sousedy, lidmi z vesnice. Žena
s divokou minulostí, poraněnou duší,
možná zklamaná životem.
U studny potkává člověka a zapřede s ním
rozhovor. Hned je jí jasné, že to není jen
tak někdo, je to prorok. Ježíš… Mesiáš.
Překvapí ji hlubokými myšlenkami, zjeví
duchovní pravdy ale především ji za-
skočí svou laskavostí a zájmem.
Toto setkání s Ježíšem proměnilo její
život. Vnitřní zábrany zmizely.
Už není ostýchavá, ale radostná.
Běží do vesnice a nadšeně všem
vypráví o Ježíši. A díky svědectví
samařské ženy vyšli lidé z města
a díky Jeho slovu také uvěřili.
Lucie Haltofová
Setkání u studně Jan 4,3-42
N AD   P ÍSMEM
3. neděle postní (Oculi)`;

// Reversed layout with author embedded in last line (no standalone name)
const SAMPLE_REVERSED_EMBEDDED = `EDITORIAL • ZE ŽIVOTA CÍRKVE • NAD PÍSMEM • TÉMA
Milé sestry a bratři,
text kázání začíná zde.
Pokračuje na dalších řádcích.
Obsahuje myšlenky a úvahy.
Další odstavec s obsahem.
A ještě více textu.
Kázání pokračuje.
Více textu kázání.
Závěrečné myšlenky kázání
a díky Jeho slovu také uvěřili. Lucie Haltofová
Setkání u studně Jan 4,3-42
N AD   P ÍSMEM
3. neděle postní (Oculi)`;

// Simulated text from ČZ 10/2020 — heading at page break with noise lines
// (TOC, page footer) between heading and body, title at end after author.
// Variant D: heading → [noise] → body → author → title
// Note: The parser's hyphenation repair (e.g. "Mů-\nžeme" → "Můžeme") reduces
// line count. We need 20+ body lines AFTER joins for standalone author detection.
const SAMPLE_PAGE_BREAK_NOISE = `nové poodhalení tajemství tvé velkorysé a krásné lásky. amen
N ad P íSMEM
EdiTorial • ZE živoTa CírkvE • Nad PíSMEM • TéMa MěSíCE: ToMáš GarriGuE MaSaryk
Pro děTi • TéMa MěSíCE • ZPrávy
6 Český zápas č. 10 8. 3. 2020
K. Č.: Každý může říci: „V nás žije veliký odkaz Husův," ale
kdo z vás může říci: „Ve mně žije veliký odkaz Husův?"
Můžeme být mravní ve světě, jehož jsme součástí?
T. G. M.: Česká reformace byla mravní par excellence. Bránit
pravdu až do smrti, to je velké naučení
Husovo z jeho života.
K. Č.: Myslel jsem na dobrého doktora, zatímco celý svět
mluvil o hospodářské krizi, národních expanzích a budoucí válce.
Nemohl jsem se plně ztotožnit se svým doktorem, protože i já
jsem byl a jsem stále pln starostí o to, co hrozí lidskému světu.
T. G. M.: Zakládám demokracii na
lásce a na spravedlnosti, jež je
matematikou lásky.
K. Č.: Je potřeba tolerance mezi národy, zachování vlastní
identity jako tvořivý prvek identity společné.
T. G. M.: Tož demokracii bychom už
měli, teď ještě nějaké ty demokraty.
Mravnost je poměr člověka k člověku.
K. Č.: Umělé bytosti podobné člověku se poprvé na světové
scéně objevili roku 1921 v mé divadelní hře.
T. G. M.: Život měříme příliš jednostranně, podle jeho délky
a ne podle jeho velikosti.
Bohumil Ždichynec
T. G. Masaryk a K. Čapek k dnešku`;

// Variant D with biblical reference in the trailing title.
// Needs 20+ body lines between titleIdx+1 and author for standalone name detection.
const SAMPLE_PAGE_BREAK_WITH_REF = `modlitba za pokoj. amen
N ad P íSMEM
EdiTorial • ZE živoTa CírkvE • Nad PíSMEM • TéMa MěSíCE
6 Český zápas č. 5 3. 2. 2021
Milé sestry a bratři,
dnes se zamýšlíme nad textem, který nás
vyzývá k lásce a odpuštění. Ježíš nám
ukazuje cestu, jak žít v pravdě.
Pokračování kázání s dalšími myšlenkami.
Hluboké zamyšlení nad tématem.
A ještě více textu, aby bylo dost řádků.
Další odstavec s teologickými úvahami.
Přemýšlení o smyslu odpuštění.
Jak se odpuštění projevuje v životě.
Co nám říká Ježíš o milosrdenství.
Láska a spravedlnost jdou ruku v ruce.
Naděje pro každého z nás.
Víra nás vede k lepšímu životu.
Společenství bratří a sester nás posiluje.
Odpuštění je dar, který osvobozuje.
Každý den je nová příležitost.
Boží milost nás provází na cestě.
Modlitba otevírá naše srdce.
Služba druhým je projevem víry.
Závěrečné slovo kázání s nadějí.
Jan Novák
Cesta k odpuštění Mt 5,1-12`;

describe("parseBiblicalRefs", () => {
  it("najde referenci ve formátu 'J 3,1-17'", () => {
    expect(parseBiblicalRefs("J 3,1-17")).toEqual(["J 3,1-17"]);
  });

  it("najde referenci ve formátu 'Mt 4,1-11'", () => {
    expect(parseBiblicalRefs("Mt 4,1-11")).toEqual(["Mt 4,1-11"]);
  });

  it("najde více referencí v textu", () => {
    const refs = parseBiblicalRefs("viz J 7,50-51 a také J 19,39");
    expect(refs).toEqual(["J 7,50-51", "J 19,39"]);
  });

  it("vrátí prázdné pole pro text bez referencí", () => {
    expect(parseBiblicalRefs("Milé sestry a milí bratři")).toEqual([]);
  });

  it("najde referenci ve formátu 'Jan 4,3-42' (plné jméno knihy)", () => {
    expect(parseBiblicalRefs("Jan 4,3-42")).toEqual(["Jan 4,3-42"]);
  });

  it("najde referenci s en-dash 'Jan 3,1–17'", () => {
    expect(parseBiblicalRefs("Jan 3,1–17")).toEqual(["Jan 3,1–17"]);
  });
});

describe("parseNadPismem", () => {
  it("najde sekci a správně rozloží na název, referenci, obsah a autora", () => {
    const result = parseNadPismem(SAMPLE_NAD_PISMEM, 2026, 9);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Narození z Ducha");
    expect(result!.biblical_refs_raw).toBe("J 3,1-17");
    expect(result!.biblical_references).toEqual(["J 3,1-17"]);
    expect(result!.author).toBe("Kateřina Kašparová");
    expect(result!.content_type).toBe("kazani");
  });

  it("obsah začíná oslovením, ne názvem", () => {
    const result = parseNadPismem(SAMPLE_NAD_PISMEM, 2026, 9);
    expect(result!.content).toMatch(/^Milé sestry a milí bratři/);
  });

  it("obsah neobsahuje podpis autora", () => {
    const result = parseNadPismem(SAMPLE_NAD_PISMEM, 2026, 9);
    expect(result!.content).not.toContain("Kateřina Kašparová");
  });

  it("rozpozná liturgický kontext z textu", () => {
    const result = parseNadPismem(SAMPLE_NAD_PISMEM, 2026, 9);
    expect(result!.liturgical_context).toMatch(/neděl/);
  });

  it("vrátí null pro text bez sekce Nad písmem", () => {
    const result = parseNadPismem("Ze sborů\nNějaký text...", 2026, 9);
    expect(result).toBeNull();
  });

  describe("Setkání u studně (Haltofová) — autorka na posledním řádku za větou", () => {
    it("rozpozná název a referenci", () => {
      const result = parseNadPismem(SAMPLE_SETKANI, 2026, 10);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Setkání u studně");
      expect(result!.biblical_refs_raw).toBe("Jan 4,3-42");
      expect(result!.biblical_references).toEqual(["Jan 4,3-42"]);
    });

    it("oddělí autorku od závěrečné věty", () => {
      const result = parseNadPismem(SAMPLE_SETKANI, 2026, 10);
      expect(result!.author).toBe("Lucie Haltofová");
    });

    it("obsah obsahuje závěrečnou větu, ale ne podpis", () => {
      const result = parseNadPismem(SAMPLE_SETKANI, 2026, 10);
      expect(result!.content).toContain("také uvěřili.");
      expect(result!.content).not.toContain("Lucie Haltofová");
    });

    it("obsah začíná oslovením", () => {
      const result = parseNadPismem(SAMPLE_SETKANI, 2026, 10);
      expect(result!.content).toMatch(/^Milé sestry a bratři/);
    });

    it("liturgický kontext je null (nezmíněna konkrétní neděle)", () => {
      const result = parseNadPismem(SAMPLE_SETKANI, 2026, 10);
      expect(result!.liturgical_context).toBeNull();
    });

    it("zvládne hlavičku velkými písmeny NAD PÍSMEM", () => {
      const result = parseNadPismem(SAMPLE_SETKANI, 2026, 10);
      expect(result).not.toBeNull();
    });
  });

  describe("Obrození shůry (Košíčková) — reference s en-dash, autorka na vlastním řádku", () => {
    it("rozpozná název a referenci s en-dash", () => {
      const result = parseNadPismem(SAMPLE_OBROZENI, 2026, 11);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Obrození shůry");
      expect(result!.biblical_refs_raw).toBe("Jan 3,1–17");
      expect(result!.biblical_references).toEqual(["Jan 3,1–17"]);
    });

    it("správně rozpozná autorku na vlastním řádku", () => {
      const result = parseNadPismem(SAMPLE_OBROZENI, 2026, 11);
      expect(result!.author).toBe("Světluše Košíčková");
    });

    it("obsah neobsahuje podpis autorky", () => {
      const result = parseNadPismem(SAMPLE_OBROZENI, 2026, 11);
      expect(result!.content).not.toContain("Světluše Košíčková");
    });

    it("zvládne hlavičku se smíšenými písmeny Nad PíSMEM", () => {
      const result = parseNadPismem(SAMPLE_OBROZENI, 2026, 11);
      expect(result).not.toBeNull();
    });
  });

  describe("Dokážeme říct Ne? (Pek) — reference v závorce, autor za Amen.", () => {
    it("extrahuje název bez závorky", () => {
      const result = parseNadPismem(SAMPLE_DOKAŽEME, 2026, 12);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Dokážeme říct jasně a zřetelně Ne?");
    });

    it("extrahuje referenci z závorky", () => {
      const result = parseNadPismem(SAMPLE_DOKAŽEME, 2026, 12);
      expect(result!.biblical_refs_raw).toBe("L 4,1–13");
      expect(result!.biblical_references).toEqual(["L 4,1–13"]);
    });

    it("oddělí autora od Amen.", () => {
      const result = parseNadPismem(SAMPLE_DOKAŽEME, 2026, 12);
      expect(result!.author).toBe("Vladislav Pek");
    });

    it("obsah obsahuje Amen., ale ne autorovo jméno", () => {
      const result = parseNadPismem(SAMPLE_DOKAŽEME, 2026, 12);
      expect(result!.content).toContain("Amen.");
      expect(result!.content).not.toContain("Vladislav Pek");
    });

    it("obsah začíná oslovením", () => {
      const result = parseNadPismem(SAMPLE_DOKAŽEME, 2026, 12);
      expect(result!.content).toMatch(/^Vážené sestry/);
    });
  });

  it("zvládne text s další sekcí za kázáním", () => {
    const textWithNextSection = SAMPLE_NAD_PISMEM + "\n\nZe sborů\nNějaká zpráva...";
    const result = parseNadPismem(textWithNextSection, 2026, 9);

    expect(result).not.toBeNull();
    expect(result!.author).toBe("Kateřina Kašparová");
    expect(result!.content).not.toContain("Ze sborů");
  });

  describe("PDF extraction artifacts — merged columns, page headers", () => {
    it("zastaví se na záhlaví stránky s ISSN", () => {
      const textWithPageHeader = SAMPLE_NAD_PISMEM +
        "\n4   •   Český zápas 10 • 5. března 2023 MK ČR E 127 ISSN 0323-1321 Český zápas Týdeník Církve" +
        "\nZprávy ze sborů a další obsah magazínu...";
      const result = parseNadPismem(textWithPageHeader, 2023, 10);

      expect(result).not.toBeNull();
      expect(result!.author).toBe("Kateřina Kašparová");
      expect(result!.content).not.toContain("ISSN");
      expect(result!.content).not.toContain("Zprávy ze sborů");
    });

    it("zastaví se na záhlaví s rozdělenými diakritikami (pdfjs artefakt)", () => {
      const textWithSplitDiacritics = SAMPLE_NAD_PISMEM +
        "\n4   •   Č eský zápas 10 • 5. b ř ezna 2023 MK Č R E 127 ISSN 0323-1321" +
        "\nDalší text co tam nepatří";
      const result = parseNadPismem(textWithSplitDiacritics, 2023, 10);

      expect(result).not.toBeNull();
      expect(result!.author).toBe("Kateřina Kašparová");
      expect(result!.content).not.toContain("ISSN");
    });

    it("zastaví se na sekci 'Pro děti a mládež'", () => {
      const textWithKids = SAMPLE_NAD_PISMEM + "\n\nPro děti a mládež\nNějaký obsah pro děti...";
      const result = parseNadPismem(textWithKids, 2026, 9);

      expect(result).not.toBeNull();
      expect(result!.author).toBe("Kateřina Kašparová");
      expect(result!.content).not.toContain("Pro děti");
    });

    it("zastaví se na sekci 'Z ekumeny'", () => {
      const textWithEcumeny = SAMPLE_NAD_PISMEM + "\n\nZ ekumeny\nNějaký ekumenický text...";
      const result = parseNadPismem(textWithEcumeny, 2026, 9);

      expect(result).not.toBeNull();
      expect(result!.author).toBe("Kateřina Kašparová");
      expect(result!.content).not.toContain("Z ekumeny");
    });

    it("přeskočí TOC řádky a najde skutečnou sekci Nad písmem", () => {
      // PDF has TOC lines like "EDITORIAL • ZE ŽIVOTA CÍRKVE • NAD PÍSMEM • TÉMA"
      // at the top of each page. Parser must skip these and find the real section.
      const textWithToc = `Týdeník Církve československé husitské
Český zápas
EDITORIAL • ZE ŽIVOTA CÍRKVE • MLÁDEŽ CČSH • NAD PÍSMEM • TÉMA MĚSÍCE: KŘESŤANSKÁ MEDITACE
PRO DĚTI • ROZHOVOR • TÉMA MĚSÍCE • ZPRÁVY
Nějaký editorial text...
EDITORIAL • ZE ŽIVOTA CÍRKVE • MLÁDEŽ CČSH • NAD PÍSMEM • TÉMA MĚSÍCE
Další strana...
Nad Písmem
Setkání u studně Jan 4,3-42
Milé sestry a bratři,
přenesme se do starověkého Izraele.
Text kázání pokračuje.
Další odstavec s myšlenkami.
A ještě jeden odstavec.
Závěr kázání s poselstvím.
Lucie Haltofová`;
      const result = parseNadPismem(textWithToc, 2023, 11);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Setkání u studně");
      expect(result!.biblical_references).toEqual(["Jan 4,3-42"]);
      expect(result!.author).toBe("Lucie Haltofová");
    });

    it("přeskočí TOC řádky i se split formou 'NAD PÍSM EM'", () => {
      // Some PDFs split non-diacritic characters too
      const textWithSplitToc = `EDITORIAL • ZE ŽIVOTA CÍRKVE • NAD PÍSM EM • TÉMA MĚSÍCE
Nad Písmem
Obrození shůry Jan 3,1–17
Text kázání.
Další odstavce textu kázání.
Pokračování textu.
Více textu zde.
Ještě více textu kázání.
Světluše Košíčková`;
      const result = parseNadPismem(textWithSplitToc, 2023, 12);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Obrození shůry");
      expect(result!.author).toBe("Světluše Košíčková");
    });

    it("zvládne obrácený layout — heading za kázáním (ČZ 11/2023)", () => {
      const result = parseNadPismem(SAMPLE_REVERSED, 2023, 11);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Setkání u studně");
      expect(result!.biblical_refs_raw).toBe("Jan 4,3-42");
      expect(result!.biblical_references).toEqual(["Jan 4,3-42"]);
      expect(result!.author).toBe("Lucie Haltofová");
      expect(result!.content).toMatch(/^Milé sestry a bratři/);
      expect(result!.content).toContain("také uvěřili.");
      expect(result!.content).not.toContain("Lucie Haltofová");
      expect(result!.content).not.toContain("N AD");
      expect(result!.liturgical_context).toMatch(/neděle postní/i);
    });

    it("zvládne obrácený layout s embedded autorem", () => {
      const result = parseNadPismem(SAMPLE_REVERSED_EMBEDDED, 2023, 11);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Setkání u studně");
      expect(result!.biblical_refs_raw).toBe("Jan 4,3-42");
      expect(result!.author).toBe("Lucie Haltofová");
      expect(result!.content).toContain("také uvěřili.");
      expect(result!.content).not.toContain("Lucie Haltofová");
    });

    it("přeskočí šum (TOC, zápatí) po headingu a najde kázání — varianta D (ČZ 10/2020)", () => {
      const result = parseNadPismem(SAMPLE_PAGE_BREAK_NOISE, 2020, 10);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("T. G. Masaryk a K. Čapek k dnešku");
      expect(result!.author).toBe("Bohumil Ždichynec");
      expect(result!.content).toContain("Každý může říci");
      expect(result!.content).toContain("matematikou lásky");
      expect(result!.content).not.toContain("EdiTorial");
      expect(result!.content).not.toContain("Český zápas");
      expect(result!.content).not.toContain("Bohumil Ždichynec");
      expect(result!.biblical_references).toEqual([]);
    });

    it("varianta D s biblickou referencí v titulku za autorem", () => {
      const result = parseNadPismem(SAMPLE_PAGE_BREAK_WITH_REF, 2021, 5);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Cesta k odpuštění");
      expect(result!.biblical_refs_raw).toBe("Mt 5,1-12");
      expect(result!.biblical_references).toEqual(["Mt 5,1-12"]);
      expect(result!.author).toBe("Jan Novák");
      expect(result!.content).toMatch(/^Milé sestry a bratři/);
      expect(result!.content).not.toContain("Jan Novák");
    });

    it("nezastaví se na slovu 'Zprávy' uvnitř věty", () => {
      // "Zprávy" embedded in body text should NOT trigger section boundary
      const textWithEmbeddedZpravy = `Nad Písmem
Test kázání J 3,1-17
Dobré zprávy. Evangelium přináší naději.
Další věta kázání pokračuje.
Jan Novák`;
      const result = parseNadPismem(textWithEmbeddedZpravy, 2026, 9);

      expect(result).not.toBeNull();
      expect(result!.content).toContain("Dobré zprávy.");
      expect(result!.author).toBe("Jan Novák");
    });
  });
});
