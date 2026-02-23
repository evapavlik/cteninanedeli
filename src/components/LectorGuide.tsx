import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";

const tips = [
  {
    title: "1. Přečti si text předem – nejlépe nahlas",
    body: "Nejdůležitější pravidlo: nikdy nečti poprvé až u ambonu. Přečti si text alespoň 3× nahlas doma. Při prvním čtení pochop obsah, při druhém hledej přirozené pauzy a důrazy, při třetím už čti jako při bohoslužbě.",
  },
  {
    title: "2. Porozuměj tomu, co čteš",
    body: "Kdo nerozumí textu, nemůže ho dobře přednést. Přečti si komentář k textu, zjisti kontext – kdo mluví, ke komu a proč. Boží slovo není zpráva z novin, je to živý rozhovor.",
  },
  {
    title: "3. Neboj se pauz – ticho je mocný nástroj",
    body: 'Začátečníci se ticha bojí a čtou příliš rychle. Pauza před klíčovou větou dá posluchačům čas soustředit se. Pauza po důležité myšlence nechá slova doznít. MgA. Martina Pavlíková, lektorka přednesu z olomoucké arcidiecéze, říká: „Ticho není prázdnota – je to prostor pro Boží slovo."',
  },
  {
    title: "4. Čti pomalu a zřetelně",
    body: "V kostele zvuk doletí k posluchačům se zpožděním. Tempo, které se ti zdá přirozené, je pro ostatní příliš rychlé. Zpomal o třetinu. Vyslovuj konce slov. Dýchej klidně.",
  },
  {
    title: "5. Pracuj s hlasem – ne s křikem",
    body: 'Důraz neznamená zvýšení hlasitosti. Důraz lze vyjádřit zpomalením, pauzou před slovem nebo změnou tónu. Klíčová slova „polož" – řekni je klidněji a váhavěji, ne hlasitěji.',
  },
  {
    title: "6. Nahraj se a poslechni si to",
    body: "Nejúčinnější způsob, jak se zlepšit. Nahraj si svůj přednes na telefon a poslechni si ho. Všimni si, kde zrychluješ, kde polykáš slova, kde chybí pauzy. Je to nepříjemné, ale funguje to.",
  },
  {
    title: "7. Modli se před čtením",
    body: 'Nejde jen o techniku. Lektor je služebník Slova. Krátká modlitba před čtením – třeba „Pane, dej mi být tvým hlasem" – ti pomůže přejít od nervozity k soustředění.',
  },
];

export function LectorGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-10 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0" strokeWidth={1.5} />
          <div>
            <p className="font-serif text-base font-semibold text-foreground">
              Jak se připravit na přednes
            </p>
            <p className="font-serif text-sm text-foreground/70">
              7 praktických tipů pro lektory
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-foreground/50 shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-foreground/50 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-6 space-y-5 border-t border-border pt-5">
          <blockquote className="border-l-2 border-foreground/15 pl-4">
            <p className="font-serif text-[1.05rem] text-foreground/80 italic leading-relaxed">
              „Služba lektora vyžaduje interpretační schopnost a dovednost. Nejde jen o to přečíst text – jde o to nechat Boží slovo promluvit skrze svůj hlas."
            </p>
            <footer className="font-sans text-xs text-foreground/50 mt-2">
              — inspirováno projektem Příprava lektorů Božího slova (kulturaslova.cz)
            </footer>
          </blockquote>

          <div className="space-y-5 mt-4">
            {tips.map((tip, i) => (
              <div key={i}>
                <h3 className="font-serif text-[1.05rem] font-semibold text-foreground mb-1.5">
                  {tip.title}
                </h3>
                <p className="font-serif text-[1.05rem] text-foreground/80 leading-relaxed">
                  {tip.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <p className="font-serif text-[1.05rem] text-foreground/80 leading-relaxed">
              💡 <strong className="text-foreground">Tato aplikace ti pomůže</strong>: Použij tlačítko
              „Značky pro přednes" k automatickému vyznačení pauz a důrazů v textu.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
