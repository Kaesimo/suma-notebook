import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { Play, Sigma, Type } from "lucide-react";
import { evaluateLatex, type EvalResult } from "@/lib/math";
import { RawLatexDialog } from "./RawLatexDialog";
import { SolveResultPanel } from "./SolveResultPanel";

/* ---------------------------------------------------------------------------
 * Line model
 *
 * The document is a stack of lines.
 *
 *   • Text lines are plain contenteditable divs: spaces, punctuation and any
 *     character work exactly like a normal editor, with none of MathLive's
 *     parsing surprises. Typing `$` at the start of an empty line — or
 *     pressing Ctrl/Cmd+M — converts the line to math.
 *
 *   • Math lines are MathLive fields in math mode, so equations behave the
 *     way MathLive intends: `^`, `/`, `\sqrt`, `=` … all work. They serialize
 *     as a `\[ … \]` block, and Ctrl/Cmd+M converts back to text.
 *
 * Each line is its own editable region because a single MathLive field cannot
 * contain newlines — this is what makes Enter (and therefore multiple lines)
 * work at all.
 * ------------------------------------------------------------------------- */

/** Split page content into lines, never splitting inside a `\[ … \]` block. */
function splitContent(content: string): string[] {
  const lines: string[] = [];
  let text = "";
  let i = 0;
  while (i < content.length) {
    if (content.startsWith("\\[", i)) {
      const end = content.indexOf("\\]", i + 2);
      if (end >= 0) {
        if (text.length > 0) lines.push(text);
        text = "";
        lines.push(content.slice(i, end + 2));
        i = end + 2;
        // A math block owns its line, so the separator newline after it must
        // not be mistaken for a separate empty line.
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

type FocusRequest = { lineId: string; caret: "start" | "end"; token: number };

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
  onFocusHandled,
}: {
  id: string;
  text: string;
  focusReq: FocusRequest | null;
  onTextChange: (id: string, text: string) => void;
  onSplit: (id: string, before: string, after: string) => void;
  onMergeBack: (id: string) => void;
  onConvertToMath: () => void;
  onFocusHandled: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const focusedRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // External changes (page switch, split/merge/convert, raw LaTeX apply) land
  // here. Normal typing keeps prop and DOM in lockstep, so this is a no-op.
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
    }, 350);
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
    if (pasted) document.execCommand("insertText", false, pasted);
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
            positionControls();
            scheduleShow();
          }
        }}
      />

      {floating && (
        <div className="fixed z-40" style={{ top: anchor.top, left: anchor.left }}>
          <div className="flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-1.5 py-1.5 shadow-lg">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onConvertToMath}
              title="Turn this line into a math line (Ctrl+M)"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-[12.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              <Sigma className="h-3.5 w-3.5" strokeWidth={2} />
              Math
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
}) {
  const ref = useRef<MathfieldElement | null>(null);
  const fieldEl = useRef<MathfieldElement | null>(null);
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

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
  const scrollEl = useRef<HTMLElement | null>(null);
  const latexRef = useRef(latex);
  latexRef.current = latex;

  const positionControls = useCallback((mf: MathfieldElement) => {
    const r = (mf as unknown as HTMLElement).getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - PANEL_W - 12));
    setAnchor({ top: r.bottom + 8, left });
  }, []);

  const reposition = useCallback(() => {
    const mf = ref.current;
    if (mf && anchor) positionControls(mf);
  }, [anchor, positionControls]);

  const scheduleShow = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      setShowControls(focusedRef.current);
    }, 350);
  }, []);

  useEffect(() => {
    const onResize = () => reposition();
    const scroller = () => reposition();
    window.addEventListener("resize", onResize);
    scrollEl.current?.addEventListener("scroll", scroller);
    return () => {
      window.removeEventListener("resize", onResize);
      scrollEl.current?.removeEventListener("scroll", scroller);
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
    scrollEl.current = mf.closest("main") as HTMLElement | null;

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
      setAnchor(null);
    };
    const onSelectionChange = () => {
      scheduleShow();
      if (anchor) positionControls(mf);
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

  // External changes (page switch, raw LaTeX edit, split/merge/convert).
  useEffect(() => {
    const mf = ref.current;
    if (!mf) return;
    if (mf.value !== latex) mf.value = latex;
  }, [latex]);

  // Focus requests from the parent (Enter, merge-back, convert, new page).
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
        <math-field
          ref={ref}
          class="suma-document suma-math-line"
          default-mode="math"
          smart-mode="off"
        />
      ) : (
        <div className="min-h-[2.5em] animate-pulse" />
      )}

      {floating && (
        <div
          className="fixed z-40"
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
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-[12.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" strokeWidth={2} />
                Solve
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onConvertToText}
                title="Turn this line back into a text line (Ctrl+M)"
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
              >
                <Type className="h-3.5 w-3.5" strokeWidth={2} />
                Text
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onOpenRaw}
                title="Edit the raw LaTeX of the whole page"
                className="rounded-full px-2.5 py-1 text-[12.5px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
              >
                LaTeX
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

  const commit = useCallback(
    (next: Line[]) => {
      linesRef.current = next;
      setLines(next);
      onChange(serializeLines(next));
    },
    [onChange],
  );

  const requestFocus = useCallback((lineId: string, caret: "start" | "end") => {
    setFocusReq({ lineId, caret, token: ++tokenRef.current });
  }, []);

  // External changes (page switch, raw LaTeX apply) → re-parse lines.
  useEffect(() => {
    if (value !== serializeLines(linesRef.current)) {
      const next = toLines(value);
      linesRef.current = next;
      setLines(next);
    }
  }, [value]);

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const next = linesRef.current.map((l, i) => (i === idx ? { ...l, value: text } : l));
      if (serializeLines(next) === serializeLines(linesRef.current)) return;
      commit(next);
    },
    [commit],
  );

  const handleLatexChange = useCallback(
    (id: string, latex: string) => {
      const idx = linesRef.current.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const next = linesRef.current.map((l, i) => (i === idx ? { ...l, value: latex } : l));
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
      commit(next);
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
      commit(next);
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
      commit(next);
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
      commit(next);
      requestFocus(id, "end");
    },
    [commit, requestFocus],
  );

  return (
    <>
      <div className="suma-document-wrap">
        {lines.map((line) =>
          line.type === "text" ? (
            <TextLine
              key={line.id}
              id={line.id}
              text={line.value}
              focusReq={focusReq && focusReq.lineId === line.id ? focusReq : null}
              onTextChange={handleTextChange}
              onSplit={handleSplit}
              onMergeBack={handleMergeBack}
              onConvertToMath={() => handleConvert(line.id, "math")}
              onFocusHandled={() => setFocusReq(null)}
            />
          ) : (
            <MathLine
              key={line.id}
              id={line.id}
              latex={line.value}
              focusReq={focusReq && focusReq.lineId === line.id ? focusReq : null}
              computeReady={computeReady}
              onLatexChange={handleLatexChange}
              onEnterToText={handleEnterToText}
              onMergeBack={handleMergeBack}
              onConvertToText={() => handleConvert(line.id, "text")}
              onFocusHandled={() => setFocusReq(null)}
              onOpenRaw={() => setRawOpen(true)}
            />
          ),
        )}
      </div>

      {rawOpen && (
        <RawLatexDialog
          initial={value}
          onApply={(raw) => {
            onChange(raw);
            setRawOpen(false);
          }}
          onClose={() => setRawOpen(false)}
        />
      )}
    </>
  );
}
