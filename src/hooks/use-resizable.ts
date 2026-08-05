import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Small VS Code style resize hook.
 * Returns a size (px) and a pointer-down handler for a gutter element.
 * Persists to localStorage under `key`.
 */
export function useResizable(
  key: string,
  opts: {
    initial: number;
    min: number;
    max: number;
    axis?: "x" | "y";
    /** Which side of the panel the gutter is on. Controls drag direction. */
    from?: "start" | "end";
  },
) {
  const { initial, min, max, axis = "x", from = "start" } = opts;
  const [size, setSize] = useState<number>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
    } catch {}
    return initial;
  });

  const stateRef = useRef({ startPos: 0, startSize: initial });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(size));
    } catch {}
  }, [key, size]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      stateRef.current.startPos = axis === "x" ? e.clientX : e.clientY;
      stateRef.current.startSize = size;
      const onMove = (ev: PointerEvent) => {
        const pos = axis === "x" ? ev.clientX : ev.clientY;
        const delta = pos - stateRef.current.startPos;
        const signed = from === "start" ? delta : -delta;
        const next = Math.min(
          max,
          Math.max(min, stateRef.current.startSize + signed),
        );
        setSize(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [axis, from, min, max, size],
  );

  return { size, setSize, onPointerDown };
}
