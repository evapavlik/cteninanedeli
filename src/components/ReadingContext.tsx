import { BookOpen, Users, Landmark, MessageCircle, Palette, ChevronDown, ChevronUp, Church, Music, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LiturgicalExtras } from "@/lib/api/firecrawl";

export interface ReadingCharacter {
  name: string;
  description: string;
}

export interface ReadingContextEntry {
  title: string;
  intro: string;
  characters: ReadingCharacter[];
  historical_context: string;
  main_message: string;
  tone: string;
}

interface ReadingContextProps {
  readings: ReadingContextEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
  liturgicalExtras?: LiturgicalExtras;
}

export function ReadingContext({ readings, open, onOpenChange, initialIndex = 0, liturgicalExtras }: ReadingContextProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialIndex);

  useEffect(() => {
    if (open) {
      setExpandedIndex(initialIndex);
    }
  }, [open, initialIndex]);

  if (!readings || readings.length === 0) return null;

  const hasExtras = liturgicalExtras && (
    liturgicalExtras.tuzby ||
    liturgicalExtras.modlitbaPredCtenim ||
    liturgicalExtras.versKObetovani ||
    liturgicalExtras.versKPozehnani ||
    liturgicalExtras.modlitbaKPozehnani ||
    liturgicalExtras.vhodnePisne
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-center font-serif text-lg font-medium text-foreground/80">
            Průvodce ke čtení
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {readings.map((reading, idx) => {
            const isOpen = expandedIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-border/60 bg-card/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
                >
                  <span className="font-serif text-sm font-medium text-foreground/80">
                    {reading.title}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3.5 text-sm leading-relaxed">
                    {/* AI label */}
                    <p className="font-sans text-[0.6rem] text-muted-foreground/50 italic text-center">
                      ✦ Vygenerováno pomocí AI – orientační pomůcka
                    </p>

                    {/* Intro */}
                    <div className="flex gap-2.5">
                      <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Úvod pro shromáždění
                        </p>
                        <p className="font-serif text-foreground/80 italic text-[0.85rem]">
                          „{reading.intro}"
                        </p>
                      </div>
                    </div>

                    {/* Characters */}
                    {reading.characters && reading.characters.length > 0 && (
                      <div className="flex gap-2.5">
                        <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Klíčové postavy
                          </p>
                          <ul className="space-y-0.5">
                            {reading.characters.map((c, ci) => (
                              <li key={ci} className="text-foreground/80 text-[0.85rem]">
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
                    <div className="flex gap-2.5">
                      <Landmark className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Historický kontext
                        </p>
                        <p className="text-foreground/80 text-[0.85rem]">{reading.historical_context}</p>
                      </div>
                    </div>

                    {/* Main message */}
                    <div className="flex gap-2.5">
                      <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Hlavní poselství
                        </p>
                        <p className="text-foreground/80 font-medium text-[0.85rem]">{reading.main_message}</p>
                      </div>
                    </div>

                    {/* Tone */}
                    <div className="flex gap-2.5">
                      <Palette className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Tón přednesu
                        </p>
                        <p className="text-foreground/80 text-[0.85rem]">{reading.tone}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Liturgical extras from ccsh.cz */}
          {hasExtras && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <p className="text-center font-sans text-[0.6rem] text-muted-foreground/50 italic mb-3">
                ✦ Z webu ccsh.cz – autentické liturgické texty CČSH
              </p>

              <div className="space-y-3">
                {liturgicalExtras.modlitbaPredCtenim && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <div className="flex gap-2.5">
                      <Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Modlitba před čtením
                        </p>
                        <p className="font-serif text-foreground/80 italic text-[0.85rem] leading-relaxed">
                          {liturgicalExtras.modlitbaPredCtenim}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {liturgicalExtras.tuzby && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <div className="flex gap-2.5">
                      <Church className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Tužby
                        </p>
                        <p className="font-serif text-foreground/80 text-[0.85rem] leading-relaxed whitespace-pre-line">
                          {liturgicalExtras.tuzby}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {liturgicalExtras.versKObetovani && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <div className="flex gap-2.5">
                      <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Verše k obětování
                        </p>
                        <p className="font-serif text-foreground/80 italic text-[0.85rem] leading-relaxed">
                          {liturgicalExtras.versKObetovani}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {liturgicalExtras.versKPozehnani && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <div className="flex gap-2.5">
                      <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Verš k požehnání
                        </p>
                        <p className="font-serif text-foreground/80 italic text-[0.85rem] leading-relaxed">
                          {liturgicalExtras.versKPozehnani}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {liturgicalExtras.modlitbaKPozehnani && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <div className="flex gap-2.5">
                      <Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Modlitba k požehnání
                        </p>
                        <p className="font-serif text-foreground/80 italic text-[0.85rem] leading-relaxed">
                          {liturgicalExtras.modlitbaKPozehnani}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {liturgicalExtras.vhodnePisne && (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                    <div className="flex gap-2.5">
                      <Music className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Vhodné písně
                        </p>
                        <p className="font-serif text-foreground/80 text-[0.85rem] leading-relaxed">
                          {liturgicalExtras.vhodnePisne}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
