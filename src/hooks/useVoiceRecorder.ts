import { useState, useRef, useCallback, useEffect } from "react";

interface VoiceRecorderState {
  isRecording: boolean;
  audioUrl: string | null;
  duration: number;
  error: string | null;
}

// MIME types in preference order. On iOS Safari `audio/webm` is unsupported, so
// the mp4/AAC variants matter. Variants with explicit codecs are listed first
// because some browsers report the bare type as supported but then produce a
// container the <audio> element can't decode.
const MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

// Forces MediaRecorder to flush a chunk every TIMESLICE_MS via `ondataavailable`.
// Without a timeslice, iOS Safari sometimes dispatches `onstop` before the final
// `ondataavailable`, leaving the blob empty (recording appears made, playback is
// silent). With a timeslice, chunks accumulate during recording so the blob is
// always populated by the time stop fires.
const TIMESLICE_MS = 1000;

export function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_PREFERENCES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    audioUrl: null,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }

  const startRecording = useCallback(async () => {
    // Revoke previous recording
    setState((s) => {
      if (s.audioUrl) URL.revokeObjectURL(s.audioUrl);
      return { ...s, audioUrl: null, duration: 0, error: null };
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blobType = recorder.mimeType || mimeType || "audio/webm";

        if (chunksRef.current.length === 0) {
          // No data was captured — surface to user instead of producing a silent file
          setState((s) => ({
            ...s,
            isRecording: false,
            duration: 0,
            error: "Nahrávka je prázdná. Zkuste to prosím znovu.",
          }));
          releaseStream();
          stopTimer();
          return;
        }

        const blob = new Blob(chunksRef.current, { type: blobType });
        const url = URL.createObjectURL(blob);
        setState((s) => ({
          ...s,
          isRecording: false,
          audioUrl: url,
          duration: elapsed,
        }));
        releaseStream();
        stopTimer();
      };

      recorder.start(TIMESLICE_MS);
      startTimeRef.current = Date.now();
      setState((s) => ({ ...s, isRecording: true }));

      // Live duration counter
      timerRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          duration: Math.round((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Přístup k mikrofonu byl zamítnut. Povolte mikrofon v nastavení prohlížeče."
          : "Nepodařilo se spustit nahrávání.";
      setState((s) => ({ ...s, error: msg }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const clearRecording = useCallback(() => {
    setState((s) => {
      if (s.audioUrl) URL.revokeObjectURL(s.audioUrl);
      return { ...s, audioUrl: null, duration: 0 };
    });
  }, []);

  return {
    isRecording: state.isRecording,
    audioUrl: state.audioUrl,
    duration: state.duration,
    error: state.error,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
