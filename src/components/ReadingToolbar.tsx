import { useState } from "react";
import {
  Play,
  Pause,
  Type,
  Sparkles,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface ReadingToolbarProps {
  onAnnotate: () => void;
  isAnnotating: boolean;
  isAnnotated: boolean;
  teleprompterActive: boolean;
  onTeleprompterToggle: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  lineHeight: number;
  onLineHeightChange: (height: number) => void;
}

export function ReadingToolbar({
  onAnnotate,
  isAnnotating,
  isAnnotated,
  teleprompterActive,
  onTeleprompterToggle,
  speed,
  onSpeedChange,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
}: ReadingToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="sticky top-0 z-10 mb-8 rounded-xl border border-border bg-card/95 p-4 backdrop-blur-sm shadow-sm">
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

        {/* Teleprompter */}
        <button
          onClick={onTeleprompterToggle}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-serif text-sm font-medium transition-colors ${
            teleprompterActive
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background text-foreground hover:bg-accent"
          }`}
        >
          {teleprompterActive ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Teleprompter
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
      </div>

      {/* Speed slider (visible when teleprompter is active) */}
      {teleprompterActive && (
        <div className="mt-4 flex items-center gap-3 px-2">
          <span className="font-serif text-xs text-muted-foreground whitespace-nowrap">
            Pomalu
          </span>
          <Slider
            value={[speed]}
            onValueChange={(v) => onSpeedChange(v[0])}
            min={0.5}
            max={5}
            step={0.25}
            className="flex-1"
          />
          <span className="font-serif text-xs text-muted-foreground whitespace-nowrap">
            Rychle
          </span>
        </div>
      )}

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
