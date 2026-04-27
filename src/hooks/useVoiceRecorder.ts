import { useState, useRef, useCallback, useEffect } from "react";

interface VoiceRecorderState {
  isRecording: boolean;
  audioUrl: string | null;
  duration: number;
  error: string | null;
  outcome: RecordingOutcome | null;
}

/**
 * Result of the most recent recording attempt. Each outcome carries an `id`
 * so consumers can fire side effects (analytics, toasts) only when a *new*
 * outcome appears, not on every re-render.
 *  - success: a non-empty blob was produced
 *  - empty_blob: recorder fired onstop with zero chunks (iOS race condition)
 *  - error: getUserMedia / recorder construction failed before any data
 */
export type RecordingOutcome =
  | { id: number; type: "success"; durationSec: number; mimeType: string }
  | { id: number; type: "empty_blob" }
  | { id: number; type: "error"; code: "NotAllowedError" | "other" };

// MIME types in preference order. mp4/AAC is universally playable in <audio>
// across Chrome and Safari, so it's listed first. Safari 17+ can record WebM
// but can't always play it back via <audio>, which would produce a silent file.
// Variants with explicit codecs are listed first because some browsers report
// the bare type as supported but then produce a container the <audio> element
// can't decode.
const MIME_PREFERENCES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

// Forces MediaRecorder to flush a chunk every TIMESLICE_MS via `ondataavailable`.
// Without a timeslice, iOS Safari sometimes dispatches `onstop` before the final
// `ondataavailable`, leaving the blob empty (recording appears made, playback is
// silent). With a timeslice, chunks accumulate during recording so the blob is
// always populated by the time stop fires.
const TIMESLICE_MS = 1000;

// Returns true if the MIME type can be both recorded and played back. Some
// browsers (notably Safari 17+) report a type as supported by MediaRecorder
// but the <audio> element can't decode the resulting container.
function canPlayBack(type: string): boolean {
  if (typeof document === "undefined") return true;
  try {
    const probe = document.createElement("audio");
    const verdict = probe.canPlayType(type);
    return verdict === "probably" || verdict === "maybe";
  } catch {
    return true;
  }
}

export function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_PREFERENCES.find(
    (t) => MediaRecorder.isTypeSupported(t) && canPlayBack(t),
  );
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    audioUrl: null,
    duration: 0,
    error: null,
    outcome: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const outcomeIdRef = useRef(0);
  const nextOutcomeId = () => ++outcomeIdRef.current;

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
            outcome: { id: nextOutcomeId(), type: "empty_blob" },
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
          outcome: {
            id: nextOutcomeId(),
            type: "success",
            durationSec: elapsed,
            mimeType: blobType,
          },
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
      const isPermissionDenied =
        err instanceof DOMException && err.name === "NotAllowedError";
      const msg = isPermissionDenied
        ? "Přístup k mikrofonu byl zamítnut. Povolte mikrofon v nastavení prohlížeče."
        : "Nepodařilo se spustit nahrávání.";
      setState((s) => ({
        ...s,
        error: msg,
        outcome: {
          id: nextOutcomeId(),
          type: "error",
          code: isPermissionDenied ? "NotAllowedError" : "other",
        },
      }));
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
    outcome: state.outcome,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
