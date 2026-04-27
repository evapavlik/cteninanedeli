import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceRecorder, pickSupportedMimeType } from "@/hooks/useVoiceRecorder";

// ---------- MediaRecorder mock ----------

type RecorderState = "inactive" | "recording" | "paused";

interface FakeRecorderInstance {
  state: RecorderState;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: (timeslice?: number) => void;
  stop: () => void;
  // Test helpers (not part of real spec)
  __startCalls: number[];
  __emitChunk: (size: number) => void;
}

function makeMediaRecorderMock(supportedTypes: string[] = ["audio/webm;codecs=opus", "audio/webm"]) {
  const created: FakeRecorderInstance[] = [];

  class FakeMediaRecorder implements FakeRecorderInstance {
    state: RecorderState = "inactive";
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    __startCalls: number[] = [];

    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      this.mimeType = options?.mimeType || "audio/webm";
      created.push(this);
    }

    start(timeslice?: number) {
      this.state = "recording";
      this.__startCalls.push(timeslice ?? -1);
    }

    stop() {
      this.state = "inactive";
      // Real MediaRecorder dispatches ondataavailable then onstop. We only fire
      // ondataavailable here if the test pushed data via __emitChunk; otherwise
      // we go straight to onstop to mirror the iOS Safari empty-blob bug.
      this.onstop?.();
    }

    __emitChunk(size: number) {
      const chunk = new Blob([new Uint8Array(size)], { type: this.mimeType });
      this.ondataavailable?.({ data: chunk });
    }

    static isTypeSupported(type: string): boolean {
      return supportedTypes.includes(type);
    }
  }

  return { FakeMediaRecorder, created };
}

function makeMediaStreamMock() {
  const tracks = [
    { stop: vi.fn(), kind: "audio" as const },
  ];
  const stream = {
    getTracks: () => tracks,
  } as unknown as MediaStream;
  return { stream, tracks };
}

// ---------- Setup / teardown ----------

let originalMediaRecorder: typeof MediaRecorder | undefined;
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | undefined;
let createdUrls: string[] = [];
let revokedUrls: string[] = [];

beforeEach(() => {
  originalMediaRecorder = (globalThis as any).MediaRecorder;
  // jsdom may not define navigator.mediaDevices at all
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {} });
  }
  originalGetUserMedia = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);

  createdUrls = [];
  revokedUrls = [];
  (URL as any).createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test-${createdUrls.length}-${blob.size}`;
    createdUrls.push(url);
    return url;
  });
  (URL as any).revokeObjectURL = vi.fn((url: string) => {
    revokedUrls.push(url);
  });
});

afterEach(() => {
  if (originalMediaRecorder) (globalThis as any).MediaRecorder = originalMediaRecorder;
  else delete (globalThis as any).MediaRecorder;
  if (originalGetUserMedia) {
    (navigator.mediaDevices as any).getUserMedia = originalGetUserMedia;
  } else {
    delete (navigator.mediaDevices as any).getUserMedia;
  }
});

// ---------- Tests ----------

describe("pickSupportedMimeType", () => {
  it("returns the highest-priority supported type", () => {
    const { FakeMediaRecorder } = makeMediaRecorderMock(["audio/mp4", "audio/webm"]);
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    // Both are supported but webm is preferred (earlier in the list)
    expect(pickSupportedMimeType()).toBe("audio/webm");
  });

  it("falls back to mp4 when webm is unsupported (iOS Safari)", () => {
    const { FakeMediaRecorder } = makeMediaRecorderMock([
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
    ]);
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    expect(pickSupportedMimeType()).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  it("prefers the codec-qualified webm over the bare type", () => {
    const { FakeMediaRecorder } = makeMediaRecorderMock([
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ]);
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    expect(pickSupportedMimeType()).toBe("audio/webm;codecs=opus");
  });

  it("returns undefined when MediaRecorder is missing", () => {
    delete (globalThis as any).MediaRecorder;
    expect(pickSupportedMimeType()).toBeUndefined();
  });

  it("returns undefined when no candidate is supported", () => {
    const { FakeMediaRecorder } = makeMediaRecorderMock([]);
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    expect(pickSupportedMimeType()).toBeUndefined();
  });
});

describe("useVoiceRecorder", () => {
  it("starts MediaRecorder with a 1000ms timeslice (prevents iOS empty-blob bug)", async () => {
    const { FakeMediaRecorder, created } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const { stream } = makeMediaStreamMock();
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockResolvedValue(stream);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(created).toHaveLength(1);
    expect(created[0].__startCalls).toEqual([1000]);
    expect(result.current.isRecording).toBe(true);
  });

  it("produces an audioUrl with the captured chunks on stop", async () => {
    const { FakeMediaRecorder, created } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const { stream } = makeMediaStreamMock();
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockResolvedValue(stream);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulate periodic chunks accumulating during recording, then stop
    act(() => {
      created[0].__emitChunk(1024);
      created[0].__emitChunk(2048);
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioUrl).toMatch(/^blob:test-/);
    expect(result.current.error).toBeNull();
    // The blob URL was generated from a non-empty blob (1024 + 2048 = 3072)
    expect(createdUrls).toHaveLength(1);
  });

  it("surfaces an error instead of a silent empty blob when no chunks arrived (iOS bug)", async () => {
    const { FakeMediaRecorder, created } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const { stream } = makeMediaStreamMock();
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockResolvedValue(stream);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // Stop without ever emitting a chunk — replicates the iOS Safari case
    // where ondataavailable fires after onstop and chunks stay empty
    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioUrl).toBeNull();
    expect(result.current.error).toBe("Nahrávka je prázdná. Zkuste to prosím znovu.");
    expect(createdUrls).toHaveLength(0);
    // No URL means none should have been revoked either
    expect(revokedUrls).toHaveLength(0);
    // Audio tracks should be released even on the error path
    const tracks = (stream as any).getTracks();
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("releases the previous audioUrl when starting a new recording", async () => {
    const { FakeMediaRecorder, created } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const { stream } = makeMediaStreamMock();
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockResolvedValue(stream);

    const { result } = renderHook(() => useVoiceRecorder());

    // First recording
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      created[0].__emitChunk(512);
      result.current.stopRecording();
    });
    const firstUrl = result.current.audioUrl;
    expect(firstUrl).toBeTruthy();

    // Start a second recording — should revoke the first url
    await act(async () => {
      await result.current.startRecording();
    });
    expect(revokedUrls).toContain(firstUrl);
    expect(result.current.audioUrl).toBeNull();
  });

  it("clearRecording releases the blob URL and resets state", async () => {
    const { FakeMediaRecorder, created } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const { stream } = makeMediaStreamMock();
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockResolvedValue(stream);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      created[0].__emitChunk(512);
      result.current.stopRecording();
    });
    const url = result.current.audioUrl!;

    act(() => {
      result.current.clearRecording();
    });

    expect(result.current.audioUrl).toBeNull();
    expect(result.current.duration).toBe(0);
    expect(revokedUrls).toContain(url);
  });

  it("reports a permission-denied error in Czech when the user blocks the mic", async () => {
    const { FakeMediaRecorder } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const denied = new DOMException("denied", "NotAllowedError");
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockRejectedValue(denied);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toContain("mikrofon");
    expect(result.current.audioUrl).toBeNull();
  });

  it("reports a generic error for non-permission failures", async () => {
    const { FakeMediaRecorder } = makeMediaRecorderMock();
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe("Nepodařilo se spustit nahrávání.");
  });

  it("uses the recorder's actual mimeType for the blob (matches what the encoder produced)", async () => {
    const { FakeMediaRecorder, created } = makeMediaRecorderMock(["audio/mp4"]);
    (globalThis as any).MediaRecorder = FakeMediaRecorder;
    const { stream } = makeMediaStreamMock();
    (navigator.mediaDevices as any).getUserMedia = vi.fn().mockResolvedValue(stream);

    let blobType: string | undefined;
    (URL as any).createObjectURL = vi.fn((blob: Blob) => {
      blobType = blob.type;
      return "blob:test";
    });

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      created[0].__emitChunk(256);
      result.current.stopRecording();
    });

    expect(blobType).toBe("audio/mp4");
  });
});
