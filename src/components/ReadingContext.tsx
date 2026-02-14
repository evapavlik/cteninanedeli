import { BookOpen, Users, Landmark, MessageCircle, Palette, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

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
}

export function ReadingContext({ readings }: ReadingContextProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!readings || readings.length === 0) return null;

  return (
    <div className="mb-10 space-y-4">
      <h2 className="text-center font-serif text-lg font-medium text-foreground/70 mb-6">
        Průvodce ke čtení
      </h2>
      {readings.map((reading, idx) => {
        const isOpen = expandedIndex === idx;
        return (
          <div
            key={idx}
            className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden transition-all"
          >
            <button
              onClick={() => setExpandedIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent/30 transition-colors"
            >
              <span className="font-serif text-base font-medium text-foreground/80">
                {reading.title}
              </span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4 text-sm leading-relaxed">
                {/* Intro */}
                <div className="flex gap-3">
                  <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Úvod pro shromáždění
                    </p>
                    <p className="font-serif text-foreground/80 italic">
                      „{reading.intro}"
                    </p>
                  </div>
                </div>

                {/* Characters */}
                {reading.characters && reading.characters.length > 0 && (
                  <div className="flex gap-3">
                    <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Klíčové postavy
                      </p>
                      <ul className="space-y-1">
                        {reading.characters.map((c, ci) => (
                          <li key={ci} className="text-foreground/80">
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
                  <Landmark className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Historický kontext
                    </p>
                    <p className="text-foreground/80">{reading.historical_context}</p>
                  </div>
                </div>

                {/* Main message */}
                <div className="flex gap-3">
                  <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Hlavní poselství
                    </p>
                    <p className="text-foreground/80 font-medium">{reading.main_message}</p>
                  </div>
                </div>

                {/* Tone */}
                <div className="flex gap-3">
                  <Palette className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Tón přednesu
                    </p>
                    <p className="text-foreground/80">{reading.tone}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
