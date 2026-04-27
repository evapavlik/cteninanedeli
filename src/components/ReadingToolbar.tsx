import { useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  Type,
  Sparkles,
  Loader2,
  Minus,
  Plus,
  BookOpen,
  Maximize,
  Feather,
  Mic,
  Square,
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
  onOpenInspiration?: () => void;
  hasInspiration?: boolean;
  isLoadingInspiration?: boolean;
  onToggleRecording?: () => void;
  isRecording?: boolean;
  recordingDuration?: number;
  audioSlot?: ReactNode;
  // Attached to every analytics event fired from this toolbar so we can
  // segment usage per Sunday / per liturgical period.
  analyticsContext?: Record<string, unknown>;
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
  onOpenInspiration,
  hasInspiration,
  isLoadingInspiration,
  onToggleRecording,
  isRecording,
  recordingDuration = 0,
  audioSlot,
  analyticsContext,
}: ReadingToolbarProps) {
  const ctx = analyticsContext ?? {};
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="mb-2 rounded-xl border border-border bg-card/95 p-3 backdrop-blur-sm shadow-sm">
      {/* Main controls row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Annotate */}
        <button
          onClick={() => { trackEvent("annotate_click", { ...ctx, isAnnotated }); onAnnotate(); }}
          disabled={isAnnotating}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 font-serif text-base md:text-sm md:px-4 md:py-2.5 font-medium transition-colors ${
            isAnnotated
              ? "bg-accent text-accent-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          } disabled:opacity-50`}
        >
          {isAnnotating ? (
            <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5 md:h-4 md:w-4" />
          )}
          {isAnnotating
            ? "Zpracovávám…"
            : isAnnotated
            ? "✓ Anotováno"
            : "Značky pro přednes"}
        </button>

        {/* Typography settings toggle */}
        <button
          onClick={() => { trackEvent("toggle_settings", { ...ctx, open: !showSettings }); setShowSettings(!showSettings); }}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 font-serif text-base md:text-sm md:px-4 md:py-2.5 font-medium transition-colors border border-border ${
            showSettings
              ? "bg-accent text-accent-foreground"
              : "bg-background text-foreground hover:bg-accent"
          }`}
        >
          <Type className="h-5 w-5 md:h-4 md:w-4" />
          Zobrazení
        </button>

        {/* Guide button */}
        {(hasGuide || isLoadingGuide) && (
          <button
            onClick={onOpenGuide}
            disabled={isLoadingGuide || !hasGuide}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-serif text-base md:text-sm md:px-4 md:py-2.5 font-medium transition-colors border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50"
          >
            {isLoadingGuide ? (
              <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin" />
            ) : (
              <BookOpen className="h-5 w-5 md:h-4 md:w-4" />
            )}
            Průvodce
          </button>
        )}

        {/* Inspiration button */}
        {(hasInspiration || isLoadingInspiration) && (
          <button
            onClick={onOpenInspiration}
            disabled={isLoadingInspiration || !hasInspiration}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-serif text-base md:text-sm md:px-4 md:py-2.5 font-medium transition-colors border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50"
          >
            {isLoadingInspiration ? (
              <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin" />
            ) : (
              <Feather className="h-5 w-5 md:h-4 md:w-4" />
            )}
            Inspirace
          </button>
        )}

        {/* Voice recording */}
        {onToggleRecording && (
          <button
            onClick={() => { trackEvent(isRecording ? "voice_record_stop" : "voice_record_start", ctx); onToggleRecording(); }}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 font-serif text-base md:text-sm md:px-4 md:py-2.5 font-medium transition-colors border border-border ${
              isRecording
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                : "bg-background text-foreground hover:bg-accent"
            }`}
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 md:h-3.5 md:w-3.5 fill-current" />
                <span className="tabular-nums">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}</span>
                Zastavit
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 md:h-4 md:w-4" />
                Nahrát
              </>
            )}
          </button>
        )}
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
              onClick={() => onFontSizeChange(Math.max(18, fontSize - 2))}
              className="rounded-md border border-border p-1.5 hover:bg-accent"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-serif text-sm w-10 text-center">
              {fontSize}px
            </span>
            <button
              onClick={() => onFontSizeChange(Math.min(48, fontSize + 2))}
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

      {/* Audio playback slot */}
      {audioSlot}
    </div>
  );
}
