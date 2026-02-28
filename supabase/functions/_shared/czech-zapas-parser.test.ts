import { describe, it, expect } from "vitest";
import { parseNadPismem, parseBiblicalRefs } from "./czech-zapas-parser";

// Reálný text ze sekce "Nad písmem" — Český zápas 2026/9
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

  it("zvládne text s další sekcí za kázáním", () => {
    const textWithNextSection = SAMPLE_NAD_PISMEM + "\n\nZe sborů\nNějaká zpráva...";
    const result = parseNadPismem(textWithNextSection, 2026, 9);

    expect(result).not.toBeNull();
    expect(result!.author).toBe("Kateřina Kašparová");
    expect(result!.content).not.toContain("Ze sborů");
  });
});
