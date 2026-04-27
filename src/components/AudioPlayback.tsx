import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic, Trash2 } from "lucide-react";

interface AudioPlaybackProps {
  audioUrl: string;
  duration: number;
  onRecordAgain: () => void;
  onDelete: () => void;
}

// We use the Web Audio API instead of <audio> because WebKit (Safari, both
// macOS and iOS) has a long-standing bug where it accepts fragmented MP4
// blobs from MediaRecorder, advances currentTime through container metadata,
// reports readyState=4, but never produces audible output. decodeAudioData()
// + AudioBufferSourceNode bypasses the broken playback path.
export function AudioPlayback({ audioUrl, duration, onRecordAgain, onDelete }: AudioPlaybackProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0); // ctx.currentTime when current playback started
  const pausedAtRef = useRef(0); // offset within buffer when paused
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setPlaybackError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    pausedAtRef.current = 0;
    audioBufferRef.current = null;

    (async () => {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
        const ctx = audioCtxRef.current;
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        audioBufferRef.current = buffer;
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setPlaybackError("Nahrávku se nepodařilo načíst.");
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stopSource();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      stopSource();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  function stopSource() {
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }

  function startSource(offset: number) {
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      // stop() also triggers onended; guard so manual pause doesn't reset.
      if (sourceRef.current !== source) return;
      sourceRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      pausedAtRef.current = 0;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
    source.start(0, Math.min(offset, buffer.duration));
    sourceRef.current = source;
    startedAtRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      const t = ctx.currentTime - startedAtRef.current;
      setCurrentTime(Math.floor(Math.min(t, buffer.duration)));
    }, 250);
  }

  async function togglePlay() {
    if (isLoading || !audioBufferRef.current || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    setPlaybackError(null);

    // iOS requires resume() inside a user gesture before audio can play.
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // proceed anyway — start() may still work
      }
    }

    if (sourceRef.current) {
      const offset = ctx.currentTime - startedAtRef.current;
      stopSource();
      pausedAtRef.current = Math.min(offset, audioBufferRef.current.duration);
      setIsPlaying(false);
      return;
    }

    try {
      startSource(pausedAtRef.current);
    } catch {
      setPlaybackError("Nahrávku se nepodařilo přehrát. Zkuste to prosím znovu.");
      setIsPlaying(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={isLoading || !!playbackError}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? "Pozastavit" : "Přehrát"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <span className="font-serif text-base text-muted-foreground tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onRecordAgain}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-serif text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Nahrát znovu"
          >
            <Mic className="h-4 w-4" />
            Znovu
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center rounded-lg p-2 text-muted-foreground/50 hover:text-destructive hover:bg-accent transition-colors"
            aria-label="Smazat nahrávku"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {playbackError && (
        <p className="font-serif text-sm text-destructive">{playbackError}</p>
      )}
    </div>
  );
}
