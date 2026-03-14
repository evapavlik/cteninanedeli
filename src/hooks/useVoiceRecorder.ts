import { useState, useRef, useCallback, useEffect } from "react";

interface VoiceRecorderState {
  isRecording: boolean;
  audioUrl: string | null;
  duration: number;
  error: string | null;
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

      // Pick a supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : undefined;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setState((s) => ({
          ...s,
          isRecording: false,
          audioUrl: url,
          duration: elapsed,
        }));
        releaseStream();
        stopTimer();
      };

      recorder.start();
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
