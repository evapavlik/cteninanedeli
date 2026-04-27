import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypography, __TYPOGRAPHY } from "@/hooks/useTypography";

const { FONT_SIZE_KEY, LINE_HEIGHT_KEY, FONT_SIZE_DEFAULT, LINE_HEIGHT_DEFAULT } = __TYPOGRAPHY;

// jsdom in this project's vitest setup has a Storage implementation missing
// `removeItem` / `clear`, which breaks normal cleanup. Swap in a fresh
// in-memory store per test so the hook still goes through the real
// localStorage interface but we get reliable isolation.
function makeMemoryStorage(): Storage {
  let data: Record<string, string> = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
    clear: () => {
      data = {};
    },
    key: (i) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  };
}

let originalLocalStorage: Storage;

beforeEach(() => {
  originalLocalStorage = window.localStorage;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: makeMemoryStorage(),
  });
});

afterEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
});

describe("useTypography", () => {
  it("returns defaults on first open (nothing in localStorage)", () => {
    const { result } = renderHook(() => useTypography());
    expect(result.current.fontSize).toBe(FONT_SIZE_DEFAULT);
    expect(result.current.lineHeight).toBe(LINE_HEIGHT_DEFAULT);
  });

  it("loads previously saved values from localStorage", () => {
    localStorage.setItem(FONT_SIZE_KEY, "32");
    localStorage.setItem(LINE_HEIGHT_KEY, "2.4");

    const { result } = renderHook(() => useTypography());
    expect(result.current.fontSize).toBe(32);
    expect(result.current.lineHeight).toBe(2.4);
  });

  it("persists fontSize on change", () => {
    const { result } = renderHook(() => useTypography());

    act(() => {
      result.current.setFontSize(36);
    });

    expect(result.current.fontSize).toBe(36);
    expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("36");
  });

  it("persists lineHeight on change", () => {
    const { result } = renderHook(() => useTypography());

    act(() => {
      result.current.setLineHeight(2.6);
    });

    expect(result.current.lineHeight).toBe(2.6);
    expect(localStorage.getItem(LINE_HEIGHT_KEY)).toBe("2.6");
  });

  it("ignores corrupted (non-numeric) values and falls back to defaults", () => {
    localStorage.setItem(FONT_SIZE_KEY, "not-a-number");
    localStorage.setItem(LINE_HEIGHT_KEY, "garbage");

    const { result } = renderHook(() => useTypography());
    expect(result.current.fontSize).toBe(FONT_SIZE_DEFAULT);
    expect(result.current.lineHeight).toBe(LINE_HEIGHT_DEFAULT);
  });

  it("clamps out-of-range fontSize to default (defends against stale data)", () => {
    localStorage.setItem(FONT_SIZE_KEY, "5"); // below minimum
    let { result } = renderHook(() => useTypography());
    expect(result.current.fontSize).toBe(FONT_SIZE_DEFAULT);

    localStorage.setItem(FONT_SIZE_KEY, "200"); // above maximum
    ({ result } = renderHook(() => useTypography()));
    expect(result.current.fontSize).toBe(FONT_SIZE_DEFAULT);
  });

  it("clamps out-of-range lineHeight to default", () => {
    localStorage.setItem(LINE_HEIGHT_KEY, "0.5"); // below minimum
    let { result } = renderHook(() => useTypography());
    expect(result.current.lineHeight).toBe(LINE_HEIGHT_DEFAULT);

    localStorage.setItem(LINE_HEIGHT_KEY, "10"); // above maximum
    ({ result } = renderHook(() => useTypography()));
    expect(result.current.lineHeight).toBe(LINE_HEIGHT_DEFAULT);
  });

  it("survives an unmount-remount cycle (proxy for closing & reopening the app)", () => {
    const first = renderHook(() => useTypography());
    act(() => {
      first.result.current.setFontSize(40);
      first.result.current.setLineHeight(2.8);
    });
    first.unmount();

    const second = renderHook(() => useTypography());
    expect(second.result.current.fontSize).toBe(40);
    expect(second.result.current.lineHeight).toBe(2.8);
  });
});
