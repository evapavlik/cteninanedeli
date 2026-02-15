import { BookOpen, Users, Landmark, MessageCircle, Palette, ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { useState, useEffect } from "react";
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

export interface ReadingContextEntry {
  title: string;
  intro: string;
  characters: ReadingCharacter[];
  historical_context: string;
  main_message: string;
  tone: string;
  citations?: ZVCitation[];
}

interface ReadingContextProps {
  readings: ReadingContextEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
}

export function ReadingContext({ readings, open, onOpenChange, initialIndex = 0 }: ReadingContextProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialIndex);

  // Sync expanded index when sheet opens with a new initialIndex
  useEffect(() => {
    if (open) {
      setExpandedIndex(initialIndex);
    }
  }, [open, initialIndex]);

  if (!readings || readings.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-8 pt-5"
      >
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
              <div
                key={idx}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
                >
                  <span className="font-serif text-base font-medium text-foreground">
                    {reading.title}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 space-y-4 text-base leading-relaxed">
                    {/* Intro */}
                    <div className="flex gap-3">
                      <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                          Úvod pro shromáždění
                        </p>
                        <p className="font-serif text-foreground italic text-[1.05rem] leading-relaxed">
                          „{reading.intro}"
                        </p>
                      </div>
                    </div>

                    {/* Characters */}
                    {reading.characters && reading.characters.length > 0 && (
                      <div className="flex gap-3">
                        <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                            Klíčové postavy
                          </p>
                          <ul className="space-y-1">
                            {reading.characters.map((c, ci) => (
                              <li key={ci} className="text-foreground text-[1.05rem] leading-relaxed">
                                <strong className="text-foreground">{c.name}</strong>
                                {" — "}
                                {c.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Historical context */}
                    <div className="flex gap-3">
                      <Landmark className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                          Historický kontext
                        </p>
                        <p className="text-foreground text-[1.05rem] leading-relaxed">{reading.historical_context}</p>
                      </div>
                    </div>

                    {/* Main message */}
                    <div className="flex gap-3">
                      <MessageCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                          Hlavní poselství
                        </p>
                        <p className="text-foreground font-medium text-[1.05rem] leading-relaxed">{reading.main_message}</p>
                      </div>
                    </div>

                    {/* Tone */}
                    <div className="flex gap-3">
                      <Palette className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                          Tón přednesu
                        </p>
                        <p className="text-foreground text-[1.05rem] leading-relaxed">{reading.tone}</p>
                      </div>
                    </div>

                    {/* Základy víry citations */}
                    {reading.citations && reading.citations.length > 0 && (
                      <div className="flex gap-3">
                        <ScrollText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                            Základy víry CČSH
                          </p>
                          <ul className="space-y-2">
                            {reading.citations.map((c, ci) => (
                              <li key={ci} className="text-foreground text-[1.05rem] leading-relaxed">
                                <strong className="text-foreground">Otázka {c.question_number}</strong>
                                {" — "}
                                <span className="italic">„{c.text}"</span>
                                <p className="text-sm text-muted-foreground mt-0.5">{c.relevance}</p>
                              </li>
                            ))}
                          </ul>
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
