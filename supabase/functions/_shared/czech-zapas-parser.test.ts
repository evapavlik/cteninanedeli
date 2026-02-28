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
});
