import { useEffect, useState } from "react";

/**
 * Reading typography (font size + line height) persisted to localStorage so
 * each lector's preferred sizing survives across opens. Stored values are
 * range-checked against the same bounds the toolbar plus/minus buttons use,
 * so corrupted localStorage gracefully falls back to defaults.
 */

const FONT_SIZE_KEY = "ccsh-font-size";
const LINE_HEIGHT_KEY = "ccsh-line-height";

const FONT_SIZE_DEFAULT = 24;
const FONT_SIZE_MIN = 18;
const FONT_SIZE_MAX = 48;

const LINE_HEIGHT_DEFAULT = 2.0;
const LINE_HEIGHT_MIN = 1.4;
const LINE_HEIGHT_MAX = 3;

function readFontSize(): number {
  if (typeof window === "undefined") return FONT_SIZE_DEFAULT;
  const raw = localStorage.getItem(FONT_SIZE_KEY);
  if (raw == null) return FONT_SIZE_DEFAULT;
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && v >= FONT_SIZE_MIN && v <= FONT_SIZE_MAX
    ? v
    : FONT_SIZE_DEFAULT;
}

function readLineHeight(): number {
  if (typeof window === "undefined") return LINE_HEIGHT_DEFAULT;
  const raw = localStorage.getItem(LINE_HEIGHT_KEY);
  if (raw == null) return LINE_HEIGHT_DEFAULT;
  const v = parseFloat(raw);
  return Number.isFinite(v) && v >= LINE_HEIGHT_MIN && v <= LINE_HEIGHT_MAX
    ? v
    : LINE_HEIGHT_DEFAULT;
}

export function useTypography() {
  const [fontSize, setFontSize] = useState<number>(readFontSize);
  const [lineHeight, setLineHeight] = useState<number>(readLineHeight);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(LINE_HEIGHT_KEY, String(lineHeight));
  }, [lineHeight]);

  return { fontSize, setFontSize, lineHeight, setLineHeight };
}

// Exported for tests
export const __TYPOGRAPHY = {
  FONT_SIZE_KEY,
  LINE_HEIGHT_KEY,
  FONT_SIZE_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
};
