import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { Copy, Play, Sigma, Type } from "lucide-react";
import { evaluateLatex, type EvalResult } from "@/lib/math";
import { RawLatexDialog } from "./RawLatexDialog";
import { SolveResultPanel } from "./SolveResultPanel";

/* ---------------------------------------------------------------------------
 * Line model
 * ------------------------------------------------------------------------- */

function splitContent(content: string): string[] {
  const lines: string[] = [];
  let text = "";
  let i = 0;
  while (i < content.length) {
    if (content.startsWith("\\[", i) && (i === 0 || content[i - 1] === "\n")) {
      const end = content.indexOf("\\]", i + 2);
      if (end >= 0) {
        if (text.length > 0) lines.push(text);
        text = "";
        lines.push(content.slice(i, end + 2));
        i = end + 2;
        if (content[i] === "\n") i++;
        continue;
      }
    }
    if (content[i] === "\n") {
      lines.push(text);
      text = "";
      i++;
      continue;
    }
    text += content[i];
    i++;
  }
  if (text.length > 0) lines.push(text);
  return lines;
}

let uidCounter = 0;
function newLineId(): string {
  return `line-${Date.now().toString(36)}-${++uidCounter}`;
}

type Line = { id: string; type: "text" | "math"; value: string };

function toLines(content: string): Line[] {
  const out = splitContent(content).map((text): Line => {
    const trimmed = text.trim();
    if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) {
      return { id: newLineId(), type: "math", value: trimmed.slice(2, -2).trim() };
    }
    return { id: newLineId(), type: "text", value: text };
  });
  return out.length > 0 ? out : [{ id: newLineId(), type: "text", value: "" }];
}

function serializeLines(lines: Line[]): string {
  return lines.map((l) => (l.type === "math" ? `\\[${l.value}\\]` : l.value)).join("\n");
}

/* ---------------------------------------------------------------------------
 * Shared bits
 * ------------------------------------------------------------------------- */

type Anchor = { top: number; left: number };
const PANEL_W = 460;

const UNDO_LIMIT = 100;
const DEBOUNCE_MS = 500;

type FocusRequest = { lineId: string; caret: "start" | "end"; token: number };
type UndoEntry = { content: string; focusLineId?: string; focusCaret?: "start" | "end" };

/* ---------------------------------------------------------------------------
 * Prose line — a plain contenteditable div
 * ------------------------------------------------------------------------- */

function TextLine({
  id,
  text,
  focusReq,
  onTextChange,
  onSplit,
  onMergeBack,
  onConvertToMath,
  onDuplicate,
  onFocusHandled,
}: {
  id: string;
  text: string;
  focusReq: FocusRequest | null;
  onTextChange: (id: string, text: string) => void;
  onSplit: (id: string, before: string, after: string) => void;
  onMergeBack: (id: string) => void;
  onConvertToMath: () => void;
  onDuplicate: () => void;
  onFocusHandled: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const focusedRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes to the DOM.
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== text) el.textContent = text;
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !focusReq) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(focusReq.caret === "end");
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    onFocusHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReq?.lineId, focusReq?.caret, focusReq?.token]);

  const positionControls = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - PANEL_W - 12));
    setAnchor({ top: r.bottom + 6, left });
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (anchor) positionControls();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchor, positionControls]);

  const scheduleShow = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setShowControls(focusedRef.current);
    }, 80);
  }, []);

  useEffect(
    () => () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (e.key === "Escape") {
      e.preventDefault();
      el.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const value = el.textContent ?? "";
      const sel = window.getSelection();
      let before = value;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(el);
        pre.setEnd(range.startContainer, range.startOffset);
        before = pre.toString();
      }
      onSplit(id, before, value.slice(before.length));
      return;
    }
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          const pre = range.cloneRange();
          pre.selectNodeContents(el);
          pre.setEnd(range.startContainer, range.startOffset);
          if (pre.toString().length === 0) {
            e.preventDefault();
            onMergeBack(id);
            return;
          }
        }
      }
      return;
    }
    if (e.key === "$" && (el.textContent ?? "").trim() === "") {
      e.preventDefault();
      onConvertToMath();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "m" || e.key === "M")) {
      e.preventDefault();
      onConvertToMath();
      return;
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain").replace(/\s+/g, " ").trim();
    if (!pasted) return;
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(pasted);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);
    onTextChange(id, el.textContent ?? "");
  };

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    onTextChange(id, e.currentTarget.textContent ?? "");
  };

  const floating = anchor && showControls && focused;

  return (
    <div className="suma-document-line">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="suma-text-line"
        data-placeholder="Type here…"
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onInput={onInput}
        onFocus={() => {
          focusedRef.current = true;
          setFocused(true);
          positionControls();
          scheduleShow();
        }}
        onBlur={() => {
          focusedRef.current = false;
          setFocused(false);
          setShowControls(false);
          setAnchor(null);
        }}
        onSelect={() => {
          if (focusedRef.current) {
            scheduleShow();
          }
        }}
      />

      {floating && (
        <div
          className="fixed z-40 suma-floating-controls"
          style={{ top: anchor.top, left: anchor.left }}
        >
          <div className="flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-1.5 py-1.5 shadow-lg">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onConvertToMath}
              title="Turn this line into a math line (Ctrl+M)"
              className="suma-btn-primary inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-[12.5px] font-medium text-accent-fg"
            >
              <Sigma className="h-3.5 w-3.5" strokeWidth={2} />
              Math
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDuplicate}
              title="Duplicate this line"
              className="suma-btn-icon inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] text-fg-muted hover:bg-bg-hover hover:text-fg"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Math line — a MathLive field in math mode
 * ------------------------------------------------------------------------- */

function MathLine({
  id,
  latex,
  focusReq,
  computeReady,
  onLatexChange,
  onEnterToText,
  onMergeBack,
  onConvertToText,
  onFocusHandled,
  onOpenRaw,
  onDuplicate,
}: {
  id: string;
  latex: string;
  focusReq: FocusRequest | null;
  computeReady: boolean;
  onLatexChange: (id: string, latex: string) => void;
  onEnterToText: (id: string) => void;
  onMergeBack: (id: string) => void;
  onConvertToText: () => void;
  onFocusHandled: () => void;
  onOpenRaw: () => void;
  onDuplicate: () => void;
}) {
  const ref = useRef<MathfieldElement | null>(null);
  const fieldEl = useRef<MathfieldElement | null>(null);
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<Anchor | null>(null);

  // When this line unmounts (convert to text, split/merge, page switch, raw
  // LaTeX apply) while the field is focused, MathLive disposes the field
  // without firing a blur. The disposed field then stays registered as the
  // "globally focused" mathfield; the NEXT field to receive focus calls
  // onBlur() on it and crashes (arnog/mathlive#2973). Blur the field before
  // React removes it from the DOM so MathLive runs its own onBlur first.
  useLayoutEffect(() => {
    return () => {
      const mf = fieldEl.current;
      if (!mf) return;
      try {
        mf.blur();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const focusedRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latexRef = useRef(latex);
  latexRef.current = latex;

  const positionControls = useCallback((mf: MathfieldElement) => {
    const r = (mf as unknown as HTMLElement).getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - PANEL_W - 12));
    const next = { top: r.bottom + 8, left };
    anchorRef.current = next;
    setAnchor(next);
  }, []);

  const reposition = useCallback(() => {
    const mf = ref.current;
    if (mf && anchorRef.current) positionControls(mf);
  }, [positionControls]);

  const scheduleShow = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setShowControls(focusedRef.current);
    }, 80);
  }, []);

  useEffect(() => {
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [reposition]);

  useEffect(() => {
    let cancelled = false;
    import("mathlive").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const mf = ref.current;
    if (!mf) return;
    fieldEl.current = mf;
    if (mf.value !== latexRef.current) mf.value = latexRef.current;

    const onInput = () => {
      onLatexChange(id, mf.value);
      setResult(null);
      scheduleShow();
    };
    const onFocus = () => {
      focusedRef.current = true;
      setFocused(true);
      positionControls(mf);
      scheduleShow();
    };
    const onBlur = () => {
      focusedRef.current = false;
      setFocused(false);
      setShowControls(false);
      setResult(null);
      anchorRef.current = null;
      setAnchor(null);
    };
    const onSelectionChange = () => {
      scheduleShow();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setResult(null);
        setShowControls(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onEnterToText(id);
        return;
      }
      if (e.key === "Backspace") {
        if (mf.position === 0 && mf.selectionIsCollapsed) {
          e.preventDefault();
          onMergeBack(id);
          return;
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        onConvertToText();
        return;
      }
    };

    mf.addEventListener("input", onInput);
    mf.addEventListener("focus", onFocus);
    mf.addEventListener("blur", onBlur);
    mf.addEventListener("selection-change", onSelectionChange);
    mf.addEventListener("keydown", onKeyDown);
    return () => {
      mf.removeEventListener("input", onInput);
      mf.removeEventListener("focus", onFocus);
      mf.removeEventListener("blur", onBlur);
      mf.removeEventListener("selection-change", onSelectionChange);
      mf.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const mf = ref.current;
    if (!mf) return;
    if (mf.value !== latex) mf.value = latex;
  }, [latex]);

  // Focus requests from parent.
  useEffect(() => {
    const mf = ref.current;
    if (!ready || !mf || !focusReq) return;
    mf.focus();
    try {
      mf.position = focusReq.caret === "end" ? mf.lastOffset : 0;
    } catch {
      /* ignore */
    }
    onFocusHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReq?.lineId, focusReq?.caret, focusReq?.token, ready]);

  const solve = async () => {
    const mf = ref.current;
    if (!mf) return;
    const latex = latexRef.current.trim();
    if (!latex) {
      setResult({ kind: "err", message: "No expression to solve." });
      positionControls(mf);
      return;
    }
    if (!computeReady) {
      setResult({
        kind: "err",
        message: "The math engine is still loading — try again in a second.",
      });
      positionControls(mf);
      return;
    }
    positionControls(mf);
    setShowControls(false);
    setResult({ kind: "ok", exact: undefined, numeric: undefined });
    try {
      const r = await evaluateLatex(latex);
      setResult(r);
      positionControls(mf);
    } catch (err) {
      setResult({
        kind: "err",
        message: err instanceof Error ? err.message : "Evaluation failed.",
      });
      positionControls(mf);
    }
  };

  const floating = anchor && (result || (showControls && focused));

  return (
    <div className="suma-document-line">
      {ready ? (
        <math-field ref={ref} class="suma-document" default-mode="math" smart-mode="off" />
      ) : (
        <div className="min-h-[2.5em] animate-pulse" />
      )}

      {floating && (
        <div
          className="fixed z-40 suma-floating-controls"
          style={{ top: anchor.top, left: anchor.left, maxWidth: "calc(100vw - 24px)" }}
        >
          {result &&
          result.kind === "ok" &&
          result.exact === undefined &&
          result.numeric === undefined ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1.5 text-[13px] text-fg-muted shadow-lg">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" />
              Solving…
            </div>
          ) : result ? (
            <SolveResultPanel
              result={result}
              sourceLatex={latexRef.current.trim()}
              onClose={() => setResult(null)}
            />
          ) : (
            <div className="flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-1.5 py-1.5 shadow-lg">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={solve}
                className="suma-btn-primary inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-[12.5px] font-medium text-accent-fg"
              >
                <Play className="h-3.5 w-3.5" strokeWidth={2} />
                Solve
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onConvertToText}
                title="Turn this line back into a text line (Ctrl+M)"
                className="suma-btn-ghost inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] text-fg-muted hover:bg-bg-hover hover:text-fg"
              >
                <Type className="h-3.5 w-3.5" strokeWidth={2} />
                Text
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onOpenRaw}
                title="Edit the raw LaTeX of the whole page"
                className="suma-btn-ghost rounded-full px-2.5 py-1 text-[12.5px] text-fg-muted hover:bg-bg-hover hover:text-fg"
              >
                LaTeX
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onDuplicate}
                title="Duplicate this line"
                className="suma-btn-icon rounded-full px-2.5 py-1 text-[12.5px] text-fg-muted hover:bg-bg-hover hover:text-fg"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The document canvas
 * ------------------------------------------------------------------------- */

export function DocumentEditor({
  value,
  onChange,
  computeReady,
}: {
  value: string;
  onChange: (v: string) => void;
  computeReady: boolean;
}) {
  const [lines, setLines] = useState<Line[]>(() => toLines(value));
  const [focusReq, setFocusReq] = useState<FocusRequest | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const linesRef = useRef(lines);
  const tokenRef = useRef(0);

  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const pendingHistoryRef = useRef<UndoEntry | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUndo = useCallback((entry: UndoEntry) => {
    const stack = undoStackRef.current;
    if (stack.length > 0) {
      const last = stack[stack.length - 1];
      if (last.content === entry.content) return;
    }
    stack.push(entry);
    if (stack.length > UNDO_LIMIT) stack.shift();
    redoStackRef.current = [];
  }, []);

  const flushPendingHistory = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingHistoryRef.current) {
      pushUndo(pendingHistoryRef.current);
      pendingHistoryRef.current = null;
    }
  }, [pushUndo]);

  const commit = useCallback(
    (next: Line[], structural?: boolean, focusLineId?: string, focusCaret?: "start" | "end") => {
      const prev = linesRef.current;
      linesRef.current = next;
      setLines(next);
      onChange(serializeLines(next));

      if (structural) {
        flushPendingHistory();
        pushUndo({ content: serializeLines(prev), focusLineId, focusCaret });
      } else {
        if (!pendingHistoryRef.current) {
          pendingHistoryRef.current = { content: serializeLines(prev) };
        }
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          if (pendingHistoryRef.current) {
            pushUndo(pendingHistoryRef.current);
            pendingHistoryRef.current = null;
          }
          debounceTimerRef.current = null;
        }, DEBOUNCE_MS);
      }
    },
    [onChange, pushUndo, flushPendingHistory],
  );

  const undo = useCallback(() => {
    flushPendingHistory();
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack.pop()!;
    redoStackRef.current.push({ content: serializeLines(linesRef.current) });
    const next = toLines(entry.content);
    linesRef.current = next;
    setLines(next);
    onChange(entry.content);
    if (entry.focusLineId) {
      setFocusReq({
        lineId: entry.focusLineId,
        caret: entry.focusCaret ?? "end",
        token: ++tokenRef.current,
      });
    }
  }, [onChange, flushPendingHistory]);

  const redo = useCallback(() => {
    flushPendingHistory();
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack.pop()!;
    undoStackRef.current.push({ content: serializeLines(linesRef.current) });
    const next = toLines(entry.content);
    linesRef.current = next;
    setLines(next);
    onChange(entry.content);
  }, [onChange, flushPendingHistory]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const requestFocus = useCallback((lineId: string, caret: "start" | "end") => {
    setFocusReq({ lineId, caret, token: ++tokenRef.current });
  }, []);

  useEffect(() => {
    if (value !== serializeLines(linesRef.current)) {
      undoStackRef.current = [];
      redoStackRef.current = [];
      pendingHistoryRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const next = toLines(value);
      linesRef.current = next;
      setLines(next);
    }
  }, [value]);

  const handleLineChange = useCallback(
    (id: string, value: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const next = linesRef.current.map((l, i) => (i === idx ? { ...l, value } : l));
      if (serializeLines(next) === serializeLines(linesRef.current)) return;
      commit(next);
    },
    [commit],
  );

  const handleSplit = useCallback(
    (id: string, before: string, after: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const newLine: Line = { id: newLineId(), type: "text", value: after };
      const next = [...linesRef.current];
      next[idx] = { ...next[idx], value: before };
      next.splice(idx + 1, 0, newLine);
      commit(next, true, newLine.id, "start");
      requestFocus(newLine.id, "start");
    },
    [commit, requestFocus],
  );

  const handleEnterToText = useCallback(
    (id: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const newLine: Line = { id: newLineId(), type: "text", value: "" };
      const next = [...linesRef.current];
      next.splice(idx + 1, 0, newLine);
      commit(next, true, newLine.id, "start");
      requestFocus(newLine.id, "start");
    },
    [commit, requestFocus],
  );

  const handleMergeBack = useCallback(
    (id: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx <= 0) return;
      const prev = linesRef.current[idx - 1];
      const cur = linesRef.current[idx];
      if (prev.type !== cur.type && cur.value !== "") return;
      const next = [...linesRef.current];
      next[idx - 1] =
        prev.type === cur.type
          ? { ...prev, value: prev.value + cur.value }
          : { ...prev, value: prev.value };
      next.splice(idx, 1);
      commit(next, true, prev.id, "end");
      requestFocus(prev.id, "end");
    },
    [commit, requestFocus],
  );

  const handleConvert = useCallback(
    (id: string, toType: "text" | "math") => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const line = linesRef.current[idx];
      if (line.type === toType) return;
      const value = toType === "math" ? line.value.trim() : line.value;
      const next = linesRef.current.map((l, i) => (i === idx ? { ...l, type: toType, value } : l));
      commit(next, true, id, "end");
      requestFocus(id, "end");
    },
    [commit, requestFocus],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const line = linesRef.current[idx];
      const dup: Line = { id: newLineId(), type: line.type, value: line.value };
      const next = [...linesRef.current];
      next.splice(idx + 1, 0, dup);
      commit(next, true, dup.id, "end");
      requestFocus(dup.id, "end");
    },
    [commit, requestFocus],
  );

  return (
    <>
      <div
        className="suma-document-wrap"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const lastTextLine = [...linesRef.current].reverse().find((l) => l.type === "text");
          if (lastTextLine) {
            requestFocus(lastTextLine.id, "end");
          } else if (linesRef.current.length > 0) {
            requestFocus(linesRef.current[linesRef.current.length - 1].id, "end");
          }
        }}
      >
        {lines.map((line) =>
          line.type === "text" ? (
            <TextLine
              key={line.id}
              id={line.id}
              text={line.value}
              focusReq={focusReq && focusReq.lineId === line.id ? focusReq : null}
              onTextChange={handleLineChange}
              onSplit={handleSplit}
              onMergeBack={handleMergeBack}
              onConvertToMath={() => handleConvert(line.id, "math")}
              onDuplicate={() => handleDuplicate(line.id)}
              onFocusHandled={() => setFocusReq(null)}
            />
          ) : (
            <MathLine
              key={line.id}
              id={line.id}
              latex={line.value}
              focusReq={focusReq && focusReq.lineId === line.id ? focusReq : null}
              computeReady={computeReady}
              onLatexChange={handleLineChange}
              onEnterToText={handleEnterToText}
              onMergeBack={handleMergeBack}
              onConvertToText={() => handleConvert(line.id, "text")}
              onFocusHandled={() => setFocusReq(null)}
              onOpenRaw={() => setRawOpen(true)}
              onDuplicate={() => handleDuplicate(line.id)}
            />
          ),
        )}
      </div>

      {rawOpen && (
        <RawLatexDialog
          initial={value}
          onApply={(raw) => {
            flushPendingHistory();
            pushUndo({ content: value });
            onChange(raw);
            setRawOpen(false);
          }}
          onClose={() => setRawOpen(false)}
        />
      )}
    </>
  );
}
