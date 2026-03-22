import { useState } from "react";
import { Feather, ChevronDown, ChevronUp, Quote, Lightbulb, ArrowRight, BookOpen, Newspaper, Scale, ExternalLink } from "lucide-react";
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

export interface CzechZapasInsight {
  article_number: number;
  title: string;
  author: string | null;
  source_ref: string;
  year: number;
  matched_ref: string;
  quotes: string[];
  insight: string;
  relevance: string;
  preaching_angle: string;
  full_text: string;
}

export interface CcshKazaniInsight {
  sermon_number: number;
  title: string;
  author: string | null;
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
  data: PreachingInspirationData | null;
  czData?: { czech_zapas: CzechZapasInsight[]; cross_era_tension?: string | null } | null;
  ccshKazaniData?: { ccsh_kazani: CcshKazaniInsight[]; cross_era_tension?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreachingInspiration({ data, czData, ccshKazaniData, open, onOpenChange }: PreachingInspirationProps) {
  const [expandedFullText, setExpandedFullText] = useState<number | null>(null);
  const [expandedCzFullText, setExpandedCzFullText] = useState<number | null>(null);
  const [expandedKazaniFullText, setExpandedPatriarchFullText] = useState<number | null>(null);

  const hasPostily = data?.postily && data.postily.length > 0;
  const hasCz = czData?.czech_zapas && czData.czech_zapas.length > 0;
  const hasCcshKazani = ccshKazaniData?.ccsh_kazani && ccshKazaniData.ccsh_kazani.length > 0;

  if (!hasPostily && !hasCz && !hasCcshKazani) return null;

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
        </SheetHeader>

        {/* ── Farského postily ── */}
        {hasPostily && (
          <>
            <p className="text-center font-sans text-sm text-muted-foreground italic mb-4">
              Z postil Karla Farského (1921–1924) · zpracováno pomocí AI
            </p>
            <div className="space-y-6">
              {data!.postily.map((postila, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="px-4 py-3.5 border-b border-border/50 bg-accent/20">
                    <h3 className="font-serif text-base font-medium text-foreground">
                      {postila.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {postila.source_ref} · {postila.matched_ref}
                    </p>
                  </div>

                  <div className="px-4 pb-5 pt-4 space-y-4 text-base leading-relaxed">
                    {postila.quotes && postila.quotes.length > 0 && (
                      <div className="flex gap-3">
                        <Quote className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-2">
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

                    {postila.insight && (
                      <div className="flex gap-3">
                        <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Farského pohled
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {postila.insight}
                          </p>
                        </div>
                      </div>
                    )}

                    {postila.relevance && (
                      <div className="flex gap-3">
                        <ArrowRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Aktuálnost pro dnešek
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {postila.relevance}
                          </p>
                        </div>
                      </div>
                    )}

                    {postila.preaching_angle && (
                      <div className="flex gap-3">
                        <Feather className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Podnět pro kázání
                          </p>
                          <p className="text-foreground font-medium text-[1.05rem] leading-relaxed">
                            {postila.preaching_angle}
                          </p>
                        </div>
                      </div>
                    )}

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
          </>
        )}

        {/* ── Cross-era tension — jen když existují oba zdroje ── */}
        {hasPostily && hasCz && czData!.cross_era_tension && (
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-border/60 bg-accent/10 px-4 py-3.5">
            <Scale className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                Napětí a kontinuita
              </p>
              <p className="text-foreground text-[1.05rem] leading-relaxed italic">
                {czData!.cross_era_tension}
              </p>
            </div>
          </div>
        )}

        {/* ── Moderní Český zápas ── */}
        {hasCz && (
          <div className={hasPostily ? "mt-8 border-t pt-6" : ""}>
            <p className="text-center font-sans text-sm text-muted-foreground italic mb-4">
              Z Českého zápasu – moderní CČSH · zpracováno pomocí AI
            </p>
            <div className="space-y-6">
              {czData!.czech_zapas.map((article, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="px-4 py-3.5 border-b border-border/50 bg-accent/20">
                    <div className="flex items-start gap-2">
                      <Newspaper className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-serif text-base font-medium text-foreground">
                          {article.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {article.author && `${article.author} · `}{article.source_ref} · {article.matched_ref}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-5 pt-4 space-y-4 text-base leading-relaxed">
                    {article.quotes && article.quotes.length > 0 && (
                      <div className="flex gap-3">
                        <Quote className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-2">
                            Citáty
                          </p>
                          <div className="space-y-2">
                            {article.quotes.map((quote, qi) => (
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

                    {article.insight && (
                      <div className="flex gap-3">
                        <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Autorův pohled
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {article.insight}
                          </p>
                        </div>
                      </div>
                    )}

                    {article.relevance && (
                      <div className="flex gap-3">
                        <ArrowRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Aktuálnost pro dnešek
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {article.relevance}
                          </p>
                        </div>
                      </div>
                    )}

                    {article.preaching_angle && (
                      <div className="flex gap-3">
                        <Feather className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Podnět pro kázání
                          </p>
                          <p className="text-foreground font-medium text-[1.05rem] leading-relaxed">
                            {article.preaching_angle}
                          </p>
                        </div>
                      </div>
                    )}

                    {article.full_text && (
                      <div className="pt-2 border-t border-border/50">
                        <button
                          onClick={() => setExpandedCzFullText(expandedCzFullText === idx ? null : idx)}
                          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          <BookOpen className="h-4 w-4" />
                          {expandedCzFullText === idx ? "Skrýt celý text článku" : "Celý text článku"}
                          {expandedCzFullText === idx ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        {expandedCzFullText === idx && (
                          <div className="mt-3 p-4 rounded-lg bg-accent/30 text-sm text-foreground/80 leading-relaxed whitespace-pre-line font-serif">
                            {article.full_text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Kázání z ccsh.cz ── */}
        {hasCcshKazani && (
          <div className={(hasPostily || hasCz) ? "mt-8 border-t pt-6" : ""}>
            <p className="text-center font-sans text-sm text-muted-foreground italic mb-4">
              Z kázání na ccsh.cz · zpracováno pomocí AI
            </p>

            {/* Cross-era tension s Farským (pokud oba matchují) */}
            {hasPostily && ccshKazaniData!.cross_era_tension && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-border/60 bg-accent/10 px-4 py-3.5">
                <Scale className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                    Napětí a kontinuita
                  </p>
                  <p className="text-foreground text-[1.05rem] leading-relaxed italic">
                    {ccshKazaniData!.cross_era_tension}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {ccshKazaniData!.ccsh_kazani.map((sermon, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="px-4 py-3.5 border-b border-border/50 bg-accent/20">
                    <div className="flex items-start gap-2">
                      <Newspaper className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-serif text-base font-medium text-foreground">
                          {sermon.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {sermon.author && `${sermon.author} · `}{sermon.source_ref} · {sermon.matched_ref}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-5 pt-4 space-y-4 text-base leading-relaxed">
                    {sermon.quotes && sermon.quotes.length > 0 && (
                      <div className="flex gap-3">
                        <Quote className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-2">
                            Citáty
                          </p>
                          <div className="space-y-2">
                            {sermon.quotes.map((quote, qi) => (
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

                    {sermon.insight && (
                      <div className="flex gap-3">
                        <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Autorův pohled
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {sermon.insight}
                          </p>
                        </div>
                      </div>
                    )}

                    {sermon.relevance && (
                      <div className="flex gap-3">
                        <ArrowRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Aktuálnost pro dnešek
                          </p>
                          <p className="text-foreground text-[1.05rem] leading-relaxed">
                            {sermon.relevance}
                          </p>
                        </div>
                      </div>
                    )}

                    {sermon.preaching_angle && (
                      <div className="flex gap-3">
                        <Feather className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-bold uppercase tracking-wider text-foreground/80 mb-1">
                            Podnět pro kázání
                          </p>
                          <p className="text-foreground font-medium text-[1.05rem] leading-relaxed">
                            {sermon.preaching_angle}
                          </p>
                        </div>
                      </div>
                    )}

                    {sermon.full_text && (
                      <div className="pt-2 border-t border-border/50">
                        <button
                          onClick={() => setExpandedPatriarchFullText(expandedKazaniFullText === idx ? null : idx)}
                          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          <BookOpen className="h-4 w-4" />
                          {expandedKazaniFullText === idx ? "Skrýt celý text kázání" : "Celý text kázání"}
                          {expandedKazaniFullText === idx ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        {expandedKazaniFullText === idx && (
                          <div className="mt-3 p-4 rounded-lg bg-accent/30 text-sm text-foreground/80 leading-relaxed whitespace-pre-line font-serif">
                            {sermon.full_text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: statické odkazy (zobrazí se jen pokud component dostane prázdná data — nemělo by nastat) */}
        {!hasPostily && !hasCz && !hasCcshKazani && (
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Pro tato čtení zatím nemáme zpracované prameny.
            </p>
            <div className="space-y-2 text-sm">
              <a
                href="https://cyklus.ccsh.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                cyklus.ccsh.cz – výklady k čtením
              </a>
              <a
                href="https://www.ccsh.cz/kazani.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Archiv kázání CČSH
              </a>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
