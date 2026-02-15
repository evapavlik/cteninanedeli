import { BookOpen, Lightbulb, Mic, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Legacy fields kept as optional for backward compatibility with cached data
export interface ReadingCharacter {
  name: string;
  description: string;
}

export interface ReadingCitation {
  question_number: string;
  text: string;
  relevance: string;
}

export interface ReadingContextEntry {
  title: string;
  intro: string;
  // New consolidated fields
  context?: string;
  delivery?: string;
  // Legacy fields (kept for backward compat with old cache)
  characters?: ReadingCharacter[];
  historical_context?: string;
  main_message?: string;
  tone?: string;
  citations?: ReadingCitation[];
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

            // Build legacy context fallback from old fields
            const contextText = reading.context || buildLegacyContext(reading);
            const deliveryText = reading.delivery || buildLegacyDelivery(reading);

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
                    {/* 1. Úvod pro shromáždění */}
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

                    {/* 2. Kontext */}
                    {contextText && (
                      <div className="flex gap-3">
                        <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                            Kontext
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {contextText}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3. Přednes */}
                    {deliveryText && (
                      <div className="flex gap-3">
                        <Mic className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                            Přednes
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed whitespace-pre-line">
                            {deliveryText}
                          </p>
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

/** Fallback: build context paragraph from legacy fields */
function buildLegacyContext(r: ReadingContextEntry): string {
  const parts: string[] = [];
  if (r.characters && r.characters.length > 0) {
    parts.push(r.characters.map(c => `${c.name} – ${c.description}`).join("; ") + ".");
  }
  if (r.historical_context) parts.push(r.historical_context);
  if (r.main_message) parts.push(r.main_message);
  return parts.join(" ");
}

/** Fallback: build delivery text from legacy fields */
function buildLegacyDelivery(r: ReadingContextEntry): string {
  const parts: string[] = [];
  if (r.tone) parts.push(r.tone);
  if (r.citations && r.citations.length > 0) {
    for (const c of r.citations) {
      parts.push(`${c.question_number}: ${c.text} – ${c.relevance}`);
    }
  }
  return parts.join("\n\n");
}
