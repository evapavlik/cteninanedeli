import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic, Trash2 } from "lucide-react";

interface AudioPlaybackProps {
  audioUrl: string;
  duration: number;
  onRecordAgain: () => void;
  onDelete: () => void;
}

export function AudioPlayback({ audioUrl, duration, onRecordAgain, onDelete }: AudioPlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(Math.floor(audio.currentTime));
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-2.5 backdrop-blur-sm shadow-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        onClick={togglePlay}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        aria-label={isPlaying ? "Pozastavit" : "Přehrát"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <span className="font-mono text-sm text-muted-foreground tabular-nums">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onRecordAgain}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-serif text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Nahrát znovu"
        >
          <Mic className="h-3.5 w-3.5" />
          Znovu
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-accent transition-colors"
          aria-label="Smazat nahrávku"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
