import { BookOpen, Palette, ChevronDown, ChevronUp, Church, Music, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LiturgicalExtras } from "@/lib/api/firecrawl";

export interface ReadingContextEntry {
  title: string;
  tone: string;
  // Legacy fields kept optional for cache compatibility
  intro?: string;
  characters?: { name: string; description: string }[];
  historical_context?: string;
  main_message?: string;
}

interface ReadingContextProps {
  readings: ReadingContextEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
  liturgicalExtras?: LiturgicalExtras;
}

export function ReadingContext({ readings, open, onOpenChange, initialIndex = 0, liturgicalExtras }: ReadingContextProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("liturgy");

  useEffect(() => {
    if (open) setExpandedSection("liturgy");
  }, [open]);

  const hasExtras = liturgicalExtras && (
    liturgicalExtras.tuzby ||
    liturgicalExtras.modlitbaPredCtenim ||
    liturgicalExtras.versKObetovani ||
    liturgicalExtras.versKPozehnani ||
    liturgicalExtras.modlitbaKPozehnani ||
    liturgicalExtras.vhodnePisne
  );

  const hasReadings = readings && readings.length > 0;

  if (!hasExtras && !hasReadings) return null;

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
          {/* === Liturgické texty z ccsh.cz (hlavní obsah) === */}
          {hasExtras && (
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === "liturgy" ? null : "liturgy")}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-card/50 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Church className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-serif text-sm font-medium text-foreground/80">
                    Liturgické texty
                  </span>
                </div>
                {expandedSection === "liturgy" ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {expandedSection === "liturgy" && (
                <div className="mt-2 space-y-2.5 pl-1">
                  <p className="font-sans text-[0.6rem] text-muted-foreground/50 italic text-center">
                    Z webu ccsh.cz – Bohoslužebná kniha CČSH
                  </p>

                  {liturgicalExtras!.modlitbaPredCtenim && (
                    <LiturgyItem icon={<Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" />} label="Modlitba před čtením" italic>
                      {liturgicalExtras!.modlitbaPredCtenim}
                    </LiturgyItem>
                  )}

                  {liturgicalExtras!.tuzby && (
                    <LiturgyItem icon={<Church className="h-4 w-4 text-primary mt-0.5 shrink-0" />} label="Tužby">
                      {liturgicalExtras!.tuzby}
                    </LiturgyItem>
                  )}

                  {liturgicalExtras!.versKObetovani && (
                    <LiturgyItem icon={<BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />} label="Verše k obětování" italic>
                      {liturgicalExtras!.versKObetovani}
                    </LiturgyItem>
                  )}

                  {liturgicalExtras!.versKPozehnani && (
                    <LiturgyItem icon={<BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />} label="Verš k požehnání" italic>
                      {liturgicalExtras!.versKPozehnani}
                    </LiturgyItem>
                  )}

                  {liturgicalExtras!.modlitbaKPozehnani && (
                    <LiturgyItem icon={<Heart className="h-4 w-4 text-primary mt-0.5 shrink-0" />} label="Modlitba k požehnání" italic>
                      {liturgicalExtras!.modlitbaKPozehnani}
                    </LiturgyItem>
                  )}

                  {liturgicalExtras!.vhodnePisne && (
                    <LiturgyItem icon={<Music className="h-4 w-4 text-primary mt-0.5 shrink-0" />} label="Vhodné písně">
                      {liturgicalExtras!.vhodnePisne}
                    </LiturgyItem>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === Tón přednesu z AI (minimální) === */}
          {hasReadings && (
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === "tone" ? null : "tone")}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-card/50 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-serif text-sm font-medium text-foreground/80">
                    Tón přednesu
                  </span>
                </div>
                {expandedSection === "tone" ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {expandedSection === "tone" && (
                <div className="mt-2 space-y-2 pl-1">
                  <p className="font-sans text-[0.6rem] text-muted-foreground/50 italic text-center">
                    ✦ Vygenerováno pomocí AI – orientační pomůcka
                  </p>
                  {readings.map((reading, idx) => (
                    <div key={idx} className="rounded-lg border border-border/40 bg-card/30 px-4 py-3">
                      <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {reading.title}
                      </p>
                      <p className="font-serif text-foreground/80 text-[0.85rem] leading-relaxed">
                        {reading.tone}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LiturgyItem({ icon, label, italic, children }: { icon: React.ReactNode; label: string; italic?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3">
      <div className="flex gap-2.5">
        {icon}
        <div className="min-w-0">
          <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {label}
          </p>
          <p className={`font-serif text-foreground/80 text-[0.85rem] leading-relaxed whitespace-pre-line ${italic ? "italic" : ""}`}>
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
