import { useState } from "react";
import {
  Type,
  Sparkles,
  Loader2,
  Minus,
  Plus,
  BookOpen,
  Maximize,
} from "lucide-react";

interface ReadingToolbarProps {
  onAnnotate: () => void;
  isAnnotating: boolean;
  isAnnotated: boolean;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  lineHeight: number;
  onLineHeightChange: (height: number) => void;
  onOpenGuide?: () => void;
  hasGuide?: boolean;
  isLoadingGuide?: boolean;
  onAmbon?: () => void;
}

export function ReadingToolbar({
  onAnnotate,
  isAnnotating,
  isAnnotated,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  onOpenGuide,
  hasGuide,
  isLoadingGuide,
  onAmbon,
}: ReadingToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="mb-2 rounded-xl border border-border bg-card/95 p-3 backdrop-blur-sm shadow-sm">
      {/* Main controls row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Annotate */}
        <button
          onClick={onAnnotate}
          disabled={isAnnotating}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-serif text-sm font-medium transition-colors ${
            isAnnotated
              ? "bg-accent text-accent-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          } disabled:opacity-50`}
        >
          {isAnnotating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isAnnotating
            ? "Zpracovávám…"
            : isAnnotated
            ? "✓ Anotováno"
            : "Značky pro přednes"}
        </button>

        {/* Typography settings toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-serif text-sm font-medium transition-colors border border-border ${
            showSettings
              ? "bg-accent text-accent-foreground"
              : "bg-background text-foreground hover:bg-accent"
          }`}
        >
          <Type className="h-4 w-4" />
          Zobrazení
        </button>

        {/* Guide button */}
        {(hasGuide || isLoadingGuide) && (
          <button
            onClick={onOpenGuide}
            disabled={isLoadingGuide || !hasGuide}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-serif text-sm font-medium transition-colors border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50"
          >
            {isLoadingGuide ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            Průvodce
          </button>
        )}

        {/* Ambon mode button – temporarily disabled */}
      </div>

      {/* Typography settings */}
      {showSettings && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {/* Font size */}
          <div className="flex items-center gap-3">
            <span className="font-serif text-sm text-muted-foreground w-28">
              Velikost písma
            </span>
            <button
              onClick={() => onFontSizeChange(Math.max(14, fontSize - 2))}
              className="rounded-md border border-border p-1.5 hover:bg-accent"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-serif text-sm w-10 text-center">
              {fontSize}px
            </span>
            <button
              onClick={() => onFontSizeChange(Math.min(40, fontSize + 2))}
              className="rounded-md border border-border p-1.5 hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Line height */}
          <div className="flex items-center gap-3">
            <span className="font-serif text-sm text-muted-foreground w-28">
              Řádkování
            </span>
            <button
              onClick={() =>
                onLineHeightChange(
                  Math.max(1.4, Math.round((lineHeight - 0.1) * 10) / 10)
                )
              }
              className="rounded-md border border-border p-1.5 hover:bg-accent"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-serif text-sm w-10 text-center">
              {lineHeight.toFixed(1)}
            </span>
            <button
              onClick={() =>
                onLineHeightChange(
                  Math.min(3, Math.round((lineHeight + 0.1) * 10) / 10)
                )
              }
              className="rounded-md border border-border p-1.5 hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
