import { useState } from "react";
import { Feather, ChevronDown, ChevronUp, Quote, Lightbulb, ArrowRight, BookOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface PostilaInsight {
  postil_number: number;
  title: string;
  source_ref: string;
  year: number;
  matched_ref: string;
  quotes: string[];
  insight: string;
  relevance: string;
  preaching_angle: string;
  full_text: string;
}

export interface PreachingInspirationData {
  postily: PostilaInsight[];
}

interface PreachingInspirationProps {
  data: PreachingInspirationData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreachingInspiration({ data, open, onOpenChange }: PreachingInspirationProps) {
  const [expandedFullText, setExpandedFullText] = useState<number | null>(null);

  if (!data?.postily || data.postily.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-8 pt-5"
      >
        <SheetHeader className="mb-5">
          <SheetTitle className="text-center font-serif text-xl font-medium text-foreground">
            Inspirace pro kázání
          </SheetTitle>
          <p className="text-center font-sans text-xs text-muted-foreground italic">
            Z postil Karla Farského (1921–1924) · zpracováno pomocí AI
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {data.postily.map((postila, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-border/50 bg-accent/20">
                <h3 className="font-serif text-base font-medium text-foreground">
                  {postila.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {postila.source_ref} · {postila.matched_ref}
                </p>
              </div>

              <div className="px-4 pb-5 pt-4 space-y-4 text-base leading-relaxed">
                {/* Quotes */}
                {postila.quotes && postila.quotes.length > 0 && (
                  <div className="flex gap-3">
                    <Quote className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">
                        Citáty z Farského
                      </p>
                      <div className="space-y-2">
                        {postila.quotes.map((quote, qi) => (
                          <blockquote
                            key={qi}
                            className="border-l-2 border-primary/30 pl-3"
                          >
                            <p className="font-serif italic text-foreground text-[1.05rem] leading-relaxed">
                              „{quote}"
                            </p>
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Insight */}
                {postila.insight && (
                  <div className="flex gap-3">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                        Farského pohled
                      </p>
                      <p className="text-foreground text-[1.05rem] leading-relaxed">
                        {postila.insight}
                      </p>
                    </div>
                  </div>
                )}

                {/* Relevance */}
                {postila.relevance && (
                  <div className="flex gap-3">
                    <ArrowRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                        Aktuálnost pro dnešek
                      </p>
                      <p className="text-foreground text-[1.05rem] leading-relaxed">
                        {postila.relevance}
                      </p>
                    </div>
                  </div>
                )}

                {/* Preaching angle */}
                {postila.preaching_angle && (
                  <div className="flex gap-3">
                    <Feather className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground/60 mb-1">
                        Podnět pro kázání
                      </p>
                      <p className="text-foreground font-medium text-[1.05rem] leading-relaxed">
                        {postila.preaching_angle}
                      </p>
                    </div>
                  </div>
                )}

                {/* Full text toggle */}
                {postila.full_text && (
                  <div className="pt-2 border-t border-border/50">
                    <button
                      onClick={() => setExpandedFullText(expandedFullText === idx ? null : idx)}
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      <BookOpen className="h-4 w-4" />
                      {expandedFullText === idx ? "Skrýt celý text postily" : "Celý text postily"}
                      {expandedFullText === idx ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {expandedFullText === idx && (
                      <div className="mt-3 p-4 rounded-lg bg-accent/30 text-sm text-foreground/80 leading-relaxed whitespace-pre-line font-serif">
                        {postila.full_text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
