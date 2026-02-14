import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause, ChevronUp, ChevronDown } from "lucide-react";
import { AnnotatedText } from "./AnnotatedText";

interface AmbonModeProps {
  markdown: string;
  onClose: () => void;
}

const AMBON_FONT_SIZE = 32;
const AMBON_LINE_HEIGHT = 2.2;
const SCROLL_SPEED_OPTIONS = [0.4, 0.7, 1.0, 1.5];

export function AmbonMode({ markdown, onClose }: AmbonModeProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speed = SCROLL_SPEED_OPTIONS[speedIndex];

  // Auto-hide controls after inactivity
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Fullscreen + Wake Lock on mount
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
    resetHideTimer();

    // Prevent screen from sleeping
    let wakeLock: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").then((lock: WakeLockSentinel) => {
        wakeLock = lock;
      }).catch(() => {});
    }

    const handleFsChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", handleFsChange);

    // Escape key
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setIsScrolling((s) => !s);
      }
      resetHideTimer();
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("keydown", handleKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [onClose, resetHideTimer]);

  // Auto-scroll loop
  useEffect(() => {
    if (!isScrolling || !scrollRef.current) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (scrollRef.current) {
        scrollRef.current.scrollTop += speed * (delta / 16.67);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isScrolling, speed]);

  const handleClose = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background cursor-none"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {/* Scrollable reading area */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-6 py-16 md:px-12 lg:px-24"
        onClick={() => {
          resetHideTimer();
          setIsScrolling((s) => !s);
        }}
      >
        <div className="mx-auto max-w-3xl">
          <AnnotatedText
            markdown={markdown}
            fontSize={AMBON_FONT_SIZE}
            lineHeight={AMBON_LINE_HEIGHT}
          />
          {/* Extra padding at bottom so last text can scroll to top */}
          <div className="h-[60vh]" />
        </div>
      </div>

      {/* Floating controls – auto-hide */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full border border-border bg-card/90 px-5 py-3 shadow-lg backdrop-blur-sm transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Speed down */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSpeedIndex((i) => Math.max(0, i - 1));
          }}
          className="p-1.5 rounded-full hover:bg-accent text-foreground/70"
          aria-label="Pomalejší"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsScrolling((s) => !s);
          }}
          className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label={isScrolling ? "Zastavit" : "Přehrát"}
        >
          {isScrolling ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>

        {/* Speed up */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSpeedIndex((i) => Math.min(SCROLL_SPEED_OPTIONS.length - 1, i + 1));
          }}
          className="p-1.5 rounded-full hover:bg-accent text-foreground/70"
          aria-label="Rychlejší"
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <span className="font-serif text-xs text-muted-foreground min-w-[3ch] text-center">
          {speed.toFixed(1)}×
        </span>

        {/* Close */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="p-1.5 rounded-full hover:bg-accent text-foreground/70 ml-2"
          aria-label="Zavřít režim Ambon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
