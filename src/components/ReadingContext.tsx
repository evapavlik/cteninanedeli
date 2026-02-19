import { BookOpen, Users, Landmark, MessageCircle, Music, ChevronDown, ChevronUp, ScrollText, Feather } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface ReadingCharacter {
  name: string;
  description: string;
}

export interface ZVCitation {
  question_number: number;
  text: string;
  relevance: string;
}

export interface FarskyTeaser {
  quote: string;
  source_ref: string;
}

export interface ReadingContextEntry {
  title: string;
  intro: string;
  characters: ReadingCharacter[];
  historical_context: string;
  main_message: string;
  tone: string;
  citations?: ZVCitation[];
  farsky?: FarskyTeaser;
}

interface ReadingContextProps {
  readings: ReadingContextEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
  onOpenInspiration?: () => void;
  hasInspiration?: boolean;
}

/* Reusable section row: icon + label + content */
function Section({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="h-5 w-5 text-primary mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">{label}</p>
        {children}
      </div>
    </div>
  );
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-foreground text-[1.05rem] leading-relaxed">{children}</p>
);

export function ReadingContext({ readings, open, onOpenChange, initialIndex = 0, onOpenInspiration, hasInspiration }: ReadingContextProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialIndex);

  useEffect(() => {
    if (open) setExpandedIndex(initialIndex);
  }, [open, initialIndex]);

  if (!readings || readings.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-8 pt-5">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-center font-serif text-xl font-medium text-foreground">
            Průvodce ke čtení
          </SheetTitle>
          <p className="text-center font-sans text-xs text-muted-foreground italic">
            Vygenerováno pomocí AI · tonalita dle{" "}
            <span className="underline decoration-dotted" title="Základy víry Církve československé husitské, schválené VI. řádným sněmem 1971, revidované VIII. sněmem 2014">
              Základů víry CČSH
            </span>{" "}
            (1971/2014)
          </p>
        </SheetHeader>

        <div className="space-y-3">
          {readings.map((reading, idx) => {
            const isOpen = expandedIndex === idx;
            return (
              <div key={idx} className="rounded-xl border border-border bg-card overflow-hidden transition-all">
                <button
                  onClick={() => setExpandedIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
                >
                  <span className="font-serif text-base font-medium text-foreground">{reading.title}</span>
                  {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 space-y-4 text-base leading-relaxed">
                    <Section icon={<BookOpen className="h-5 w-5" />} label="Úvod pro shromáždění">
                      <p className="font-serif text-foreground italic text-[1.05rem] leading-relaxed">„{reading.intro}"</p>
                    </Section>

                    {reading.characters?.length > 0 && (
                      <Section icon={<Users className="h-5 w-5" />} label="Klíčové postavy">
                        <ul className="space-y-1">
                          {reading.characters.map((c, ci) => (
                            <li key={ci} className="text-foreground text-[1.05rem] leading-relaxed">
                              <span className="font-medium text-foreground">{c.name}</span>{" — "}{c.description}
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    <Section icon={<Landmark className="h-5 w-5" />} label="Historický kontext">
                      <P>{reading.historical_context}</P>
                    </Section>

                    <Section icon={<MessageCircle className="h-5 w-5" />} label="Hlavní poselství">
                      <P>{reading.main_message}</P>
                    </Section>

                    <Section icon={<Music className="h-5 w-5" />} label="Tón přednesu">
                      <P>{reading.tone}</P>
                    </Section>

                    {reading.citations && reading.citations.length > 0 && (
                      <Section icon={<ScrollText className="h-5 w-5" />} label="Základy víry CČSH">
                        <ul className="space-y-2">
                          {reading.citations.map((c, ci) => (
                            <li key={ci} className="text-foreground text-[1.05rem] leading-relaxed">
                              <span className="font-serif italic">„{c.text}"</span>
                              <p className="text-sm text-muted-foreground mt-0.5">{c.relevance}</p>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {reading.farsky && (
                      <div className="flex gap-3 pt-2 border-t border-border/50">
                        <Feather className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">Farského postila</p>
                          <p className="text-xs text-muted-foreground mb-1.5">{reading.farsky.source_ref}</p>
                          <blockquote className="border-l-2 border-primary/30 pl-3 mb-2">
                            <p className="font-serif italic text-foreground text-[1.05rem] leading-relaxed">„{reading.farsky.quote}"</p>
                          </blockquote>
                          {hasInspiration && onOpenInspiration && (
                            <button
                              onClick={() => { onOpenChange(false); setTimeout(() => onOpenInspiration(), 300); }}
                              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1"
                            >
                              Otevřít Inspiraci pro kázání <span className="text-xs">→</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
