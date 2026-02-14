import { useEffect, useState } from "react";

interface Section {
  label: string;
  active: boolean;
}

interface SectionProgressProps {
  activeIndex: number;
  /** Total number of reading sections (h2 headings) */
  total: number;
  labels?: string[];
}

export function SectionProgress({ activeIndex, total, labels }: SectionProgressProps) {
  if (total <= 0) return null;

  const defaultLabels = ["První čtení", "Druhé čtení", "Evangelium"];
  const displayLabels = labels?.length ? labels : defaultLabels.slice(0, total);

  return (
    <div className="sticky top-[4.5rem] z-[9] mb-6">
      <div className="flex items-center justify-center gap-1.5">
        {displayLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => {
              // Scroll to the corresponding h2
              const article = document.querySelector(".prose-reading");
              if (!article) return;
              const headings = article.querySelectorAll("h2");
              headings[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-serif text-xs transition-all duration-300 ${
              i === activeIndex
                ? "bg-primary text-primary-foreground shadow-sm scale-105"
                : i < activeIndex
                ? "bg-accent text-accent-foreground/70"
                : "bg-accent/50 text-muted-foreground"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                i === activeIndex
                  ? "bg-primary-foreground"
                  : i < activeIndex
                  ? "bg-accent-foreground/40"
                  : "bg-muted-foreground/40"
              }`}
            />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
