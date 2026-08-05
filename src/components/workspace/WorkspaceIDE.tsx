import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import {
  FilePlus2,
  Trash2,
  Sigma,
  Download,
  Upload,
  Palette,
  HelpCircle,
  Play,
  Plus,
  ArrowUp,
  ArrowDown,
  Type,
  FunctionSquare,
  ChevronsLeft,
  ChevronsRight,
  Archive,
  ArchiveRestore,
  FileDown,
} from "lucide-react";
import {
  downloadWorkspace,
  parseWorkspaceFile,
  mergeWorkspace,
  migrateProblem,
  newCell,
  type Problem,
  type Cell,
} from "@/lib/workspace-io";
import { useResizable } from "@/hooks/use-resizable";
import { exportWorkspacePdf } from "@/lib/pdf-export";
import { pushSnapshot } from "@/lib/history";

const STORAGE_KEY = "mat:problems:v2";
const LEGACY_STORAGE_KEY = "mat:problems:v1";
const SELECTED_KEY = "mat:problems:selected:v1";
const APPEARANCE_KEY = "mat:appearance:v1";
const LEFT_COLLAPSED_KEY = "mat:panel:left:collapsed";
const RIGHT_COLLAPSED_KEY = "mat:panel:right:collapsed";

type Appearance = { font: string; accent: string; bg: string };

const FONT_OPTIONS = [
  {
    id: "sans",
    label: "Sans — Inter",
    stack: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: "serif",
    label: "Serif — Literary",
    stack: '"Iowan Old Style", "Charter", Georgia, Cambria, serif',
  },
  {
    id: "mono",
    label: "Mono — JetBrains",
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
] as const;

const ACCENT_OPTIONS = [
  { id: "blue", label: "Blue", value: "#7aa2f7" },
  { id: "purple", label: "Purple", value: "#bb9af7" },
  { id: "cyan", label: "Cyan", value: "#7dcfff" },
  { id: "green", label: "Green", value: "#9ece6a" },
] as const;

const BG_OPTIONS = [
  {
    id: "default",
    label: "Default",
    bg: "#1a1b26",
    panel: "#16161e",
    elevated: "#1f2335",
    hover: "#292e42",
  },
  {
    id: "deeper",
    label: "Deeper",
    bg: "#13141c",
    panel: "#0f1017",
    elevated: "#181a24",
    hover: "#242938",
  },
  {
    id: "softer",
    label: "Softer",
    bg: "#1e1f2e",
    panel: "#1a1b28",
    elevated: "#242637",
    hover: "#2f3448",
  },
] as const;

const DEFAULT_APPEARANCE: Appearance = {
  font: "sans",
  accent: "blue",
  bg: "default",
};

function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

type ExportFormat = "latex" | "math-ml" | "ascii-math" | "math-json";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          ref?: React.Ref<MathfieldElement>;
          class?: string;
        },
        MathfieldElement
      >;
    }
  }
}

const SNIPPETS = [
  { label: "frac", src: "\\frac{a}{b}" },
  { label: "sqrt", src: "\\sqrt{x}" },
  { label: "sum", src: "\\sum_{k=1}^{n} k" },
  { label: "int", src: "\\int_{a}^{b} f(x)\\,dx" },
  { label: "lim", src: "\\lim_{x \\to 0} f(x)" },
  { label: "matrix", src: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "cases", src: "\\begin{cases} a & x > 0 \\\\ b & x \\le 0 \\end{cases}" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function newProblem(mode: "single" | "notebook" = "notebook"): Problem {
  return {
    id: uid(),
    title: "Untitled problem",
    mode,
    latex: "",
    notes: "",
    cells:
      mode === "notebook"
        ? [newCell("text", ""), newCell("math", "")]
        : [],
    updatedAt: Date.now(),
  };
}

function loadProblems(): Problem[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => migrateProblem(p as Record<string, unknown>))
      .filter((p): p is Problem => p !== null);
  } catch {
    return [];
  }
}

/* ---------------- Math cell (isolated <math-field>) ---------------- */

function MathCell({
  value,
  onChange,
  onFocus,
  autoFocus,
  large,
  computeReady,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  large?: boolean;
  computeReady: boolean;
}) {
  const ref = useRef<MathfieldElement | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<{
    kind: "ok" | "err";
    exact?: string;
    numeric?: string;
    message?: string;
  } | null>(null);

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
    if (mf.value !== value) mf.value = value;
    const onInput = () => onChange(mf.value);
    const onFocusEvt = () => onFocus?.();
    mf.addEventListener("input", onInput);
    mf.addEventListener("focus", onFocusEvt);
    if (autoFocus) mf.focus();
    return () => {
      mf.removeEventListener("input", onInput);
      mf.removeEventListener("focus", onFocusEvt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Push external changes into the field.
  useEffect(() => {
    const mf = ref.current;
    if (!mf) return;
    if (mf.value !== value) mf.value = value;
  }, [value]);

  const run = async () => {
    if (!computeReady) {
      setResult({
        kind: "err",
        message: "Compute engine is still loading — try again in a moment.",
      });
      return;
    }
    try {
      const { ComputeEngine } = await import("@cortex-js/compute-engine");
      const ce = new ComputeEngine();
      const expr = ce.parse(value || "0");
      const evald = expr.evaluate();
      const numeric = expr.N();
      const exactLatex = evald.latex;
      const numLatex = numeric.latex;
      setResult({
        kind: "ok",
        exact: exactLatex,
        numeric: numLatex !== exactLatex ? numLatex : undefined,
      });
    } catch (err) {
      setResult({
        kind: "err",
        message: err instanceof Error ? err.message : "Evaluation failed",
      });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {ready ? (
            <math-field
              ref={ref}
              class="mat-mathfield"
              style={{
                display: "block",
                width: "100%",
                minHeight: large ? "120px" : "56px",
                padding: large ? "14px 16px" : "10px 12px",
                background: "var(--bg-panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: large ? "22px" : "18px",
                outline: "none",
              }}
            />
          ) : (
            <div
              className="animate-pulse rounded-sm border border-border bg-bg-panel"
              style={{ minHeight: large ? "120px" : "56px" }}
            />
          )}
        </div>
        <button
          onClick={run}
          title="Evaluate (Compute Engine)"
          className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-bg-panel px-2 py-1 font-mono text-[10.5px] text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Play className="h-3 w-3" strokeWidth={1.5} />
          run
        </button>
      </div>
      {result && (
        <div
          className={
            "rounded-sm border px-3 py-1.5 font-mono text-[11.5px] " +
            (result.kind === "ok"
              ? "border-border bg-bg-elevated text-fg"
              : "border-danger/40 bg-bg-elevated text-danger")
          }
        >
          {result.kind === "ok" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-fg-subtle">=</span>
              <span className="text-syntax-num">{result.exact}</span>
              {result.numeric && (
                <>
                  <span className="text-fg-subtle">≈</span>
                  <span className="text-fg-muted">{result.numeric}</span>
                </>
              )}
            </div>
          ) : (
            <span>{result.message}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Main IDE ---------------- */

export function WorkspaceIDE() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mfReady, setMfReady] = useState(false);
  const [computeReady, setComputeReady] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("latex");
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<{
    problems: Problem[];
    selectedId: string | null;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Which latex source feeds the right-side Output pane. In single mode it's
  // the main field; in notebook mode it's the last-focused math cell.
  const [activeLatex, setActiveLatex] = useState("");
  const [singleRunResult, setSingleRunResult] = useState<{
    kind: "ok" | "err";
    exact?: string;
    numeric?: string;
    message?: string;
  } | null>(null);

  const mainMfRef = useRef<MathfieldElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Resizable panels
  const leftPanel = useResizable("mat:panel:left", {
    initial: 240,
    min: 180,
    max: 480,
    axis: "x",
    from: "start",
  });
  const rightPanel = useResizable("mat:panel:right", {
    initial: 300,
    min: 220,
    max: 520,
    axis: "x",
    from: "end",
  });
  const singleSplit = useResizable("mat:split:single", {
    initial: 320,
    min: 160,
    max: 800,
    axis: "y",
    from: "start",
  });

  useEffect(() => {
    try {
      setLeftCollapsed(localStorage.getItem(LEFT_COLLAPSED_KEY) === "1");
      setRightCollapsed(localStorage.getItem(RIGHT_COLLAPSED_KEY) === "1");
    } catch { }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const font =
      FONT_OPTIONS.find((f) => f.id === appearance.font) ?? FONT_OPTIONS[0];
    const accent =
      ACCENT_OPTIONS.find((a) => a.id === appearance.accent) ?? ACCENT_OPTIONS[0];
    const bg = BG_OPTIONS.find((b) => b.id === appearance.bg) ?? BG_OPTIONS[0];
    root.style.setProperty("--font-sans", font.stack);
    root.style.setProperty("--accent", accent.value);
    root.style.setProperty("--bg", bg.bg);
    root.style.setProperty("--bg-panel", bg.panel);
    root.style.setProperty("--bg-elevated", bg.elevated);
    root.style.setProperty("--bg-hover", bg.hover);
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    } catch { }
  }, [appearance]);

  useEffect(() => {
    const stored = loadProblems();
    if (stored.length === 0) {
      const seed = newProblem("notebook");
      seed.title = "Welcome — start here";
      seed.cells = [
        newCell(
          "text",
          "This is a notebook. Add math cells for equations and text cells for commentary — like a Jupyter notebook, but for math homework.",
        ),
        newCell("math", "1 + 1"),
        newCell("text", "Press ‘run’ next to any math cell to evaluate it."),
      ];
      setProblems([seed]);
      setSelectedId(seed.id);
    } else {
      setProblems(stored);
      const savedSel = localStorage.getItem(SELECTED_KEY);
      const firstActive = stored.find((p) => !p.archivedAt) ?? stored[0];
      setSelectedId(
        savedSel &&
          stored.some((p) => p.id === savedSel && !p.archivedAt)
          ? savedSel
          : (firstActive?.id ?? null),
      );
    }
  }, []);

  // Debounced autosave + per-problem history snapshotting.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (problems.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
        setSavedAt(new Date().toLocaleTimeString());
        setPdfError(null);
        // Snapshot the currently-selected problem (rate-limited inside).
        const sel = problems.find((p) => p.id === selectedId);
        if (sel && !sel.archivedAt) pushSnapshot(sel);
      } catch {
        setSavedAt(null);
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [problems, selectedId]);

  useEffect(() => {
    if (selectedId) {
      try {
        localStorage.setItem(SELECTED_KEY, selectedId);
      } catch { }
    }
  }, [selectedId]);

  // Persist collapsed panel states.
  useEffect(() => {
    try {
      localStorage.setItem(LEFT_COLLAPSED_KEY, leftCollapsed ? "1" : "0");
    } catch { }
  }, [leftCollapsed]);
  useEffect(() => {
    try {
      localStorage.setItem(RIGHT_COLLAPSED_KEY, rightCollapsed ? "1" : "0");
    } catch { }
  }, [rightCollapsed]);

  // Register mathlive + compute engine once on the client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("mathlive");
      if (cancelled) return;
      mod.MathfieldElement.fontsDirectory =
        "https://unpkg.com/mathlive@0.110.0/dist/fonts";
      mod.MathfieldElement.soundsDirectory =
        "https://unpkg.com/mathlive@0.110.0/dist/sounds";
      setMfReady(true);
      try {
        const { ComputeEngine } = await import("@cortex-js/compute-engine");
        if (cancelled) return;
        // Attaching the engine unlocks MathJSON export & evaluation.
        (mod.MathfieldElement as unknown as {
          computeEngine: unknown;
        }).computeEngine = new ComputeEngine();
        setComputeReady(true);
      } catch { }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => problems.find((p) => p.id === selectedId) ?? null,
    [problems, selectedId],
  );

  // Keep active latex in sync with selected problem for single mode.
  useEffect(() => {
    if (!selected) return;
    if (selected.mode === "single") setActiveLatex(selected.latex);
    else {
      const firstMath = selected.cells.find((c) => c.type === "math");
      setActiveLatex(firstMath?.value ?? "");
    }
    setSingleRunResult(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- single-mode main math field ---------- */

  useEffect(() => {
    if (!mfReady || !selected || selected.mode !== "single") return;
    const mf = mainMfRef.current;
    if (!mf) return;
    if (mf.value !== selected.latex) mf.value = selected.latex;
  }, [mfReady, selectedId, selected?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mfReady || !selected || selected.mode !== "single") return;
    const mf = mainMfRef.current;
    if (!mf) return;
    const onInput = () => {
      const v = mf.value;
      setActiveLatex(v);
      setProblems((prev) =>
        prev.map((p) =>
          p.id === selectedId ? { ...p, latex: v, updatedAt: Date.now() } : p,
        ),
      );
    };
    mf.addEventListener("input", onInput);
    return () => mf.removeEventListener("input", onInput);
  }, [mfReady, selectedId, selected?.mode]);

  function insertSnippet(src: string) {
    const mf = mainMfRef.current;
    if (mf) {
      mf.executeCommand(["insert", src]);
      mf.focus();
    }
  }

  async function runSingle() {
    if (!computeReady || !selected) return;
    try {
      const { ComputeEngine } = await import("@cortex-js/compute-engine");
      const ce = new ComputeEngine();
      const expr = ce.parse(selected.latex || "0");
      const evald = expr.evaluate();
      const numeric = expr.N();
      const exactLatex = evald.latex;
      const numLatex = numeric.latex;
      setSingleRunResult({
        kind: "ok",
        exact: exactLatex,
        numeric: numLatex !== exactLatex ? numLatex : undefined,
      });
    } catch (err) {
      setSingleRunResult({
        kind: "err",
        message: err instanceof Error ? err.message : "Evaluation failed",
      });
    }
  }

  /* ---------- problem CRUD ---------- */

  function addProblem(mode: "single" | "notebook" = "notebook") {
    const p = newProblem(mode);
    setProblems((prev) => [p, ...prev]);
    setSelectedId(p.id);
  }

  function archiveProblem(id: string) {
    setProblems((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, archivedAt: Date.now() } : p,
      );
      if (id === selectedId) {
        const nextActive = next.find((p) => !p.archivedAt);
        setSelectedId(nextActive?.id ?? null);
      }
      return next;
    });
  }

  function restoreProblem(id: string) {
    setProblems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, archivedAt: undefined, updatedAt: Date.now() } : p,
      ),
    );
  }

  function deleteProblemPermanent(id: string) {
    setProblems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (id === selectedId) {
        const nextActive = next.find((p) => !p.archivedAt);
        setSelectedId(nextActive?.id ?? null);
      }
      return next;
    });
    try {
      localStorage.removeItem(`mat:history:${id}`);
    } catch { }
  }

  const updateSelected = useCallback(
    (patch: Partial<Problem>) => {
      setProblems((prev) =>
        prev.map((p) =>
          p.id === selectedId ? { ...p, ...patch, updatedAt: Date.now() } : p,
        ),
      );
    },
    [selectedId],
  );

  const updateCell = useCallback(
    (cellId: string, patch: Partial<Cell>) => {
      setProblems((prev) =>
        prev.map((p) =>
          p.id === selectedId
            ? {
              ...p,
              cells: p.cells.map((c) =>
                c.id === cellId ? { ...c, ...patch } : c,
              ),
              updatedAt: Date.now(),
            }
            : p,
        ),
      );
    },
    [selectedId],
  );

  function insertCell(afterId: string | null, type: Cell["type"]) {
    setProblems((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        const next = [...p.cells];
        const idx = afterId ? next.findIndex((c) => c.id === afterId) : -1;
        const cell = newCell(type);
        next.splice(idx + 1, 0, cell);
        return { ...p, cells: next, updatedAt: Date.now() };
      }),
    );
  }

  function removeCell(cellId: string) {
    setProblems((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? {
            ...p,
            cells: p.cells.filter((c) => c.id !== cellId),
            updatedAt: Date.now(),
          }
          : p,
      ),
    );
  }

  function moveCell(cellId: string, dir: -1 | 1) {
    setProblems((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        const idx = p.cells.findIndex((c) => c.id === cellId);
        if (idx < 0) return p;
        const j = idx + dir;
        if (j < 0 || j >= p.cells.length) return p;
        const next = [...p.cells];
        [next[idx], next[j]] = [next[j], next[idx]];
        return { ...p, cells: next, updatedAt: Date.now() };
      }),
    );
  }

  function setMode(mode: "single" | "notebook") {
    if (!selected || selected.mode === mode) return;
    let cells = selected.cells;
    if (mode === "notebook" && cells.length === 0) {
      // Wrap legacy single content into cells.
      cells = [];
      if (selected.notes.trim()) cells.push(newCell("text", selected.notes));
      if (selected.latex.trim()) cells.push(newCell("math", selected.latex));
      if (cells.length === 0)
        cells = [newCell("text", ""), newCell("math", "")];
    }
    updateSelected({ mode, cells });
  }

  /* ---------- export pane ---------- */

  const exported = useMemo(() => {
    if (!activeLatex) return "";
    if (format === "latex") return activeLatex;
    if (format === "ascii-math") {
      // MathLive's built-in getValue needs a mathfield; fall back to LaTeX
      // when nothing is mounted. We render an offscreen field on the fly.
      return convertViaField(activeLatex, "ascii-math");
    }
    if (format === "math-ml") return convertViaField(activeLatex, "math-ml");
    if (format === "math-json") {
      try {
        const raw = convertViaField(activeLatex, "math-json");
        // Ensure pretty JSON if it came back stringified already.
        try {
          return JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          return raw;
        }
      } catch {
        return "";
      }
    }
    return activeLatex;
  }, [activeLatex, format, mfReady, computeReady]);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { }
  }

  /* ---------- import / export ---------- */

  function handleExport() {
    downloadWorkspace(problems, selectedId);
  }

  function triggerImport() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const wf = parseWorkspaceFile(text);
      if (wf.problems.length === 0) {
        setImportError("No problems found in that file.");
        return;
      }
      setImportPending({ problems: wf.problems, selectedId: wf.selectedId });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  function applyImport(mode: "replace" | "merge") {
    if (!importPending) return;
    if (mode === "replace") {
      setProblems(importPending.problems);
      setSelectedId(
        importPending.selectedId &&
          importPending.problems.some((p) => p.id === importPending.selectedId)
          ? importPending.selectedId
          : (importPending.problems[0]?.id ?? null),
      );
    } else {
      setProblems((prev) => mergeWorkspace(prev, importPending.problems));
    }
    setImportPending(null);
  }

  return (
    <div className="grid h-screen grid-rows-[36px_1fr_24px] bg-bg text-fg">
      {/* Top toolbar */}
      <header className="flex h-9 items-center justify-between border-b border-border bg-bg-panel px-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
            <span
              aria-hidden
              className="text-[14px] leading-none text-accent"
              style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}
            >
              Σ
            </span>
            Suma Notebook
          </span>
          <span className="h-4 w-px bg-border" />
          <button
            onClick={triggerImport}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
            title="Import workspace (.matws.json)"
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
            import
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
            title="Export workspace as JSON"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            export
          </button>
          <button
            onClick={async () => {
              setPdfBusy(true);
              setPdfError(null);
              try {
                await exportWorkspacePdf(problems);
              } catch (err) {
                setPdfError(err instanceof Error ? err.message : "PDF export failed.");
              } finally {
                setPdfBusy(false);
              }
            }}
            disabled={pdfBusy}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg disabled:opacity-40"
            title="Export as PDF"
          >
            <FileDown className="h-3.5 w-3.5" strokeWidth={1.5} />
            {pdfBusy ? "exporting…" : "pdf"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.matws.json,application/json"
            className="hidden"
            onChange={onImportFile}
          />
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => {
                setThemeMenuOpen((v) => !v);
                setHelpOpen(false);
              }}
              aria-label="Appearance"
              title="Appearance"
              className="grid h-7 w-7 place-items-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
            >
              <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            {themeMenuOpen && (
              <div
                className="absolute right-0 top-full z-20 mt-1 w-[260px] rounded-sm border border-border bg-bg-elevated py-2 shadow-lg"
                onMouseLeave={() => setThemeMenuOpen(false)}
              >
                <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                  font
                </div>
                <div className="flex flex-col">
                  {FONT_OPTIONS.map((f) => {
                    const active = appearance.font === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() =>
                          setAppearance((a) => ({ ...a, font: f.id }))
                        }
                        className={
                          "flex items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-hover " +
                          (active ? "text-fg" : "text-fg-muted")
                        }
                        style={{ fontFamily: f.stack }}
                      >
                        <span>{f.label}</span>
                        {active && <span className="text-accent">●</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-border" />
                <div className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                  accent
                </div>
                <div className="flex gap-2 px-3 py-1">
                  {ACCENT_OPTIONS.map((a) => {
                    const active = appearance.accent === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() =>
                          setAppearance((prev) => ({ ...prev, accent: a.id }))
                        }
                        title={a.label}
                        aria-label={a.label}
                        className={
                          "h-6 w-6 rounded-full border transition-transform " +
                          (active
                            ? "scale-110 border-fg"
                            : "border-border hover:scale-105")
                        }
                        style={{ background: a.value }}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-border" />
                <div className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                  background
                </div>
                <div className="flex flex-col">
                  {BG_OPTIONS.map((b) => {
                    const active = appearance.bg === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() =>
                          setAppearance((prev) => ({ ...prev, bg: b.id }))
                        }
                        className={
                          "flex items-center justify-between px-3 py-1.5 text-left font-mono text-[12px] transition-colors hover:bg-bg-hover " +
                          (active ? "text-fg" : "text-fg-muted")
                        }
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-6 rounded-sm border border-border"
                            style={{ background: b.bg }}
                          />
                          {b.label}
                        </span>
                        {active && <span className="text-accent">●</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-border" />
                <button
                  onClick={() => setAppearance(DEFAULT_APPEARANCE)}
                  className="mx-3 mt-2 rounded-sm border border-border px-2 py-1 font-mono text-[10.5px] text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
                >
                  reset to defaults
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setHelpOpen((v) => !v);
              setThemeMenuOpen(false);
            }}
            aria-label="Help"
            title="Shortcuts & help"
            className="grid h-7 w-7 place-items-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Import confirmation */}
      {importPending && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-bg/70 backdrop-blur-sm"
          onClick={() => setImportPending(null)}
        >
          <div
            className="w-[420px] rounded-sm border border-border bg-bg-elevated p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">
              import workspace
            </div>
            <div className="mb-4 text-[13px] text-fg">
              Found <span className="text-accent">{importPending.problems.length}</span>{" "}
              problem{importPending.problems.length === 1 ? "" : "s"}. Merge or
              replace?
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => applyImport("merge")}
                className="rounded-sm border border-border-strong bg-bg-panel px-3 py-2 text-left font-mono text-[12px] text-fg transition-colors hover:bg-bg-hover"
              >
                merge — append imported problems
              </button>
              <button
                onClick={() => applyImport("replace")}
                className="rounded-sm border border-border bg-bg-panel px-3 py-2 text-left font-mono text-[12px] text-fg-muted transition-colors hover:border-danger hover:text-danger"
              >
                replace — discard current workspace
              </button>
              <button
                onClick={() => setImportPending(null)}
                className="mt-1 rounded-sm px-3 py-1.5 text-center font-mono text-[11px] text-fg-subtle transition-colors hover:text-fg"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help popover */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-bg/70 backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-[460px] rounded-sm border border-border bg-bg-elevated p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">
              how it works
            </div>
            <ul className="space-y-1.5 font-mono text-[12px] text-fg-muted">
              <li>
                <span className="text-fg">notebook mode</span> — mix math cells
                and text cells like a Jupyter notebook.
              </li>
              <li>
                <span className="text-fg">single mode</span> — one big equation
                + one big notes area, best for a single expression.
              </li>
              <li>
                <span className="text-fg">run</span> — evaluate any math cell
                via MathLive's Compute Engine.
              </li>
              <li>
                <span className="text-fg">panels</span> — drag the vertical
                dividers between problems / editor / output.
              </li>
              <li>
                <span className="text-fg">appearance</span> — Palette icon,
                top-right: font, accent, background.
              </li>
              <li>
                <span className="text-fg">workspace file</span> — import /
                export the whole thing as one .matws.json.
              </li>
            </ul>
            <button
              onClick={() => setHelpOpen(false)}
              className="mt-4 rounded-sm border border-border px-3 py-1 font-mono text-[11px] text-fg-muted transition-colors hover:text-fg"
            >
              close
            </button>
          </div>
        </div>
      )}

      {importError && (
        <div className="fixed left-1/2 top-14 z-40 -translate-x-1/2 rounded-sm border border-danger bg-bg-elevated px-3 py-2 font-mono text-[11.5px] text-danger shadow-lg">
          {importError}
          <button
            onClick={() => setImportError(null)}
            className="ml-3 text-fg-subtle hover:text-fg"
          >
            ×
          </button>
        </div>
      )}

      {pdfError && (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-sm border border-danger bg-bg-elevated px-3 py-2 font-mono text-[11.5px] text-danger shadow-lg">
          {pdfError}
          <button
            onClick={() => setPdfError(null)}
            className="ml-3 text-fg-subtle hover:text-fg"
          >
            ×
          </button>
        </div>
      )}

      {/* Body */}
      <div
        className="grid h-full min-h-0 overflow-hidden"
        style={{
          gridTemplateColumns: `48px ${leftCollapsed ? 32 : leftPanel.size}px ${leftCollapsed ? 0 : 4}px minmax(0,1fr) ${rightCollapsed ? 0 : 4}px ${rightCollapsed ? 32 : rightPanel.size}px`,
        }}
      >
        {/* Activity bar */}
        <nav
          aria-label="Activity"
          className="flex h-full w-12 flex-col items-center justify-between border-r border-border bg-bg-panel py-2"
        >
          <div className="flex flex-col items-center gap-1">
            <button
              aria-label="Problems"
              title="Problems"
              className="relative grid h-9 w-9 place-items-center rounded-sm text-fg after:absolute after:left-0 after:h-8 after:w-[2px] after:bg-accent"
            >
              <Sigma className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          </div>
          {/* settings removed — all config is in-app */}
        </nav>

        {/* Explorer */}
        {leftCollapsed ? (
          <aside className="flex h-full w-full flex-col items-center border-r border-border bg-bg-elevated py-2">
            <button
              onClick={() => setLeftCollapsed(false)}
              title="Expand problems"
              aria-label="Expand problems"
              className="grid h-7 w-7 place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
            >
              <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <div
              className="mt-3 font-mono text-[10px] uppercase tracking-widest text-fg-subtle"
              style={{ writingMode: "vertical-rl" }}
            >
              problems
            </div>
          </aside>
        ) : (
          <aside className="flex h-full min-w-0 flex-col overflow-hidden border-r border-border bg-bg-elevated">
            <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {showArchived ? "archived" : "problems"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  title={
                    showArchived ? "Back to active" : "View archived"
                  }
                  aria-label="Toggle archived"
                  className="grid h-5 w-5 place-items-center text-fg-subtle transition-colors hover:text-fg"
                >
                  <Archive className="h-3 w-3" strokeWidth={1.5} />
                </button>
                {!showArchived && (
                  <button
                    onClick={() => addProblem("notebook")}
                    title="New notebook"
                    className="inline-flex items-center gap-1 text-fg-subtle transition-colors hover:text-fg"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    new
                  </button>
                )}
                <button
                  onClick={() => setLeftCollapsed(true)}
                  title="Collapse problems"
                  aria-label="Collapse problems"
                  className="grid h-5 w-5 place-items-center text-fg-subtle transition-colors hover:text-fg"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1">
              {(() => {
                const visible = problems.filter((p) =>
                  showArchived ? !!p.archivedAt : !p.archivedAt,
                );
                if (visible.length === 0) {
                  return (
                    <div className="px-3 py-4 text-center font-mono text-[11.5px] text-fg-subtle">
                      {showArchived ? (
                        <em>no archived problems</em>
                      ) : (
                        <>
                          <em>no problems yet</em> — click{" "}
                          <span className="text-fg">new</span>.
                        </>
                      )}
                    </div>
                  );
                }
                return (
                  <ul className="flex flex-col">
                    {visible.map((p) => {
                      const active = p.id === selectedId && !showArchived;
                      return (
                        <li key={p.id} className="min-w-0">
                          <div
                            className={
                              "group flex min-w-0 items-center gap-2 border-l-2 px-3 py-1.5 font-mono text-[12px] transition-colors " +
                              (active
                                ? "border-accent bg-bg-hover text-fg"
                                : "border-transparent text-fg-muted hover:bg-bg-hover hover:text-fg")
                            }
                          >
                            <button
                              onClick={() => {
                                if (!showArchived) setSelectedId(p.id);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                              title={p.title}
                              disabled={showArchived}
                            >
                              <span className="shrink-0 text-fg-subtle">
                                {p.mode === "notebook" ? "▤" : "§"}
                              </span>
                              <span className="min-w-0 truncate">
                                {p.title || "untitled"}
                              </span>
                            </button>
                            {showArchived ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  onClick={() => restoreProblem(p.id)}
                                  aria-label="Restore"
                                  title="Restore"
                                  className="text-fg-subtle transition-colors hover:text-accent"
                                >
                                  <ArchiveRestore
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.5}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Permanently delete "${p.title || "untitled"}"? This cannot be undone.`,
                                      )
                                    )
                                      deleteProblemPermanent(p.id);
                                  }}
                                  aria-label="Delete permanently"
                                  title="Delete permanently"
                                  className="text-fg-subtle transition-colors hover:text-danger"
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.5}
                                  />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => archiveProblem(p.id)}
                                aria-label="Archive problem"
                                title="Archive"
                                className="hidden shrink-0 text-fg-subtle transition-colors hover:text-danger group-hover:inline-flex"
                              >
                                <Archive
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.5}
                                />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
            <div className="shrink-0 truncate border-t border-border px-3 py-2 font-mono text-[10.5px] text-fg-subtle">
              {problems.filter((p) => !p.archivedAt).length} active ·{" "}
              {problems.filter((p) => !!p.archivedAt).length} archived
            </div>
          </aside>
        )}

        {/* Left resize gutter */}
        {leftCollapsed ? (
          <div />
        ) : (
          <div
            onPointerDown={leftPanel.onPointerDown}
            className="h-full cursor-col-resize bg-border/40 transition-colors hover:bg-accent"
            role="separator"
            aria-orientation="vertical"
          />
        )}

        {/* Editor */}
        <main className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-border bg-bg-panel px-3 font-mono text-[11px] text-fg-subtle">
            <span className="min-w-0 truncate">
              {selected
                ? `${selected.title}.${selected.mode === "notebook" ? "nb" : "tex"}`
                : "no problem selected"}
            </span>
            {selected && (
              <div className="flex shrink-0 items-center gap-0.5 rounded-sm border border-border bg-bg-elevated p-0.5">
                {(["single", "notebook"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={
                      "rounded-sm px-2 py-0.5 text-[10.5px] transition-colors " +
                      (selected.mode === m
                        ? "bg-bg-hover text-fg"
                        : "text-fg-subtle hover:text-fg")
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selected ? (
            selected.mode === "single" ? (
              <SingleView
                selected={selected}
                mfReady={mfReady}
                mainMfRef={mainMfRef}
                onTitleChange={(v) => updateSelected({ title: v })}
                onNotesChange={(v) => updateSelected({ notes: v })}
                onInsertSnippet={insertSnippet}
                onRun={runSingle}
                runResult={singleRunResult}
                splitHeight={singleSplit.size}
                onSplitPointerDown={singleSplit.onPointerDown}
                computeReady={computeReady}
              />
            ) : (
              <NotebookView
                selected={selected}
                onTitleChange={(v) => updateSelected({ title: v })}
                onCellChange={(id, v) => updateCell(id, { value: v })}
                onCellFocus={(id) => {
                  const c = selected.cells.find((cc) => cc.id === id);
                  if (c?.type === "math") setActiveLatex(c.value);
                }}
                onInsert={insertCell}
                onRemove={removeCell}
                onMove={moveCell}
                onToggleType={(id) => {
                  const c = selected.cells.find((cc) => cc.id === id);
                  if (c)
                    updateCell(id, {
                      type: c.type === "math" ? "text" : "math",
                    });
                }}
                computeReady={computeReady}
              />
            )
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center">
              <div className="text-center font-mono text-[12px] text-fg-subtle">
                <div className="mb-2">no problem open</div>
                <button
                  onClick={() => addProblem("notebook")}
                  className="rounded-sm border border-border-strong bg-bg-elevated px-3 py-1.5 text-fg transition-colors hover:bg-bg-hover"
                >
                  + new problem
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right resize gutter */}
        {rightCollapsed ? (
          <div />
        ) : (
          <div
            onPointerDown={rightPanel.onPointerDown}
            className="h-full cursor-col-resize bg-border/40 transition-colors hover:bg-accent"
            role="separator"
            aria-orientation="vertical"
          />
        )}

        {/* Output */}
        {rightCollapsed ? (
          <aside className="flex h-full w-full flex-col items-center border-l border-border bg-bg-elevated py-2">
            <button
              onClick={() => setRightCollapsed(false)}
              title="Expand output"
              aria-label="Expand output"
              className="grid h-7 w-7 place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
            >
              <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <div
              className="mt-3 font-mono text-[10px] uppercase tracking-widest text-fg-subtle"
              style={{ writingMode: "vertical-rl" }}
            >
              output
            </div>
          </aside>
        ) : (
          <aside className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border bg-bg-elevated">
            <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
              <span className="truncate">output</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={copyExport}
                  className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                >
                  {copied ? "copied" : "copy"}
                </button>
                <button
                  onClick={() => setRightCollapsed(true)}
                  title="Collapse output"
                  aria-label="Collapse output"
                  className="grid h-5 w-5 place-items-center text-fg-subtle transition-colors hover:text-fg"
                >
                  <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-3 py-2">
              {(["latex", "math-ml", "ascii-math", "math-json"] as ExportFormat[]).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={
                      "rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] transition-colors " +
                      (format === f
                        ? "bg-bg-hover text-fg"
                        : "text-fg-subtle hover:text-fg")
                    }
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
            <pre className="min-w-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[11.5px] leading-[1.55] text-fg-muted">
              {exported || " "}
            </pre>
          </aside>
        )}
      </div>

      {/* Status bar */}
      <footer className="flex h-6 items-center justify-between gap-3 border-t border-border bg-bg-panel px-3 font-mono text-[11px] text-fg-subtle">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-fg">workspace</span>
          <span className="shrink-0">›</span>
          <span className="min-w-0 truncate text-fg">
            {selected?.title ?? "—"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {savedAt && <span>saved {savedAt}</span>}
          <span title="Compute engine status">
            ce: {computeReady ? "ready" : "…"}
          </span>
          <span>
            {BG_OPTIONS.find((b) => b.id === appearance.bg)?.label.toLowerCase() ??
              "default"}
          </span>
          {/* auth removed — all data is local */}
        </div>
      </footer>
    </div>
  );
}

/* ---------------- helper: offscreen mathfield conversion ---------------- */

// Cache one offscreen field for cheap format conversion.
let _convertField: MathfieldElement | null = null;
function convertViaField(latex: string, target: ExportFormat): string {
  if (typeof document === "undefined") return latex;
  try {
    if (!_convertField) {
      _convertField = document.createElement(
        "math-field",
      ) as MathfieldElement;
      _convertField.style.position = "absolute";
      _convertField.style.left = "-99999px";
      _convertField.style.top = "0";
      _convertField.setAttribute("read-only", "");
      document.body.appendChild(_convertField);
    }
    _convertField.value = latex;
    const v = _convertField.getValue(target as unknown as never);
    return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  } catch {
    return latex;
  }
}

/* ---------------- Single mode view ---------------- */

function SingleView(props: {
  selected: Problem;
  mfReady: boolean;
  mainMfRef: React.RefObject<MathfieldElement | null>;
  onTitleChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onInsertSnippet: (src: string) => void;
  onRun: () => void;
  runResult: {
    kind: "ok" | "err";
    exact?: string;
    numeric?: string;
    message?: string;
  } | null;
  splitHeight: number;
  onSplitPointerDown: (e: React.PointerEvent) => void;
  computeReady: boolean;
}) {
  const {
    selected,
    mfReady,
    mainMfRef,
    onTitleChange,
    onNotesChange,
    onInsertSnippet,
    onRun,
    runResult,
    splitHeight,
    onSplitPointerDown,
    computeReady,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-8 pt-6">
        <input
          value={selected.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Problem title"
          className="w-full border-0 border-b border-transparent bg-transparent pb-2 text-2xl font-semibold tracking-tight text-fg outline-none transition-colors focus:border-border"
        />
      </div>

      {/* Equation section */}
      <section
        className="flex min-h-0 flex-col overflow-hidden px-8 pt-5"
        style={{ height: splitHeight }}
      >
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">
            equation · live latex
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {SNIPPETS.map((s) => (
              <button
                key={s.label}
                onClick={() => onInsertSnippet(s.src)}
                className="rounded-sm border border-border bg-bg-panel px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={onRun}
              disabled={!computeReady}
              title="Evaluate"
              className="ml-1 inline-flex items-center gap-1 rounded-sm border border-border bg-bg-panel px-2 py-0.5 font-mono text-[10.5px] text-fg-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Play className="h-3 w-3" strokeWidth={1.5} />
              run
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {mfReady ? (
            <math-field
              ref={mainMfRef}
              class="mat-mathfield"
              style={{
                display: "block",
                width: "100%",
                minHeight: "100%",
                padding: "16px 18px",
                background: "var(--bg-panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "24px",
                outline: "none",
              }}
            />
          ) : (
            <div className="h-full animate-pulse rounded-sm border border-border bg-bg-panel" />
          )}
        </div>
        {runResult && (
          <div
            className={
              "mt-2 shrink-0 rounded-sm border px-3 py-1.5 font-mono text-[11.5px] " +
              (runResult.kind === "ok"
                ? "border-border bg-bg-elevated text-fg"
                : "border-danger/40 bg-bg-elevated text-danger")
            }
          >
            {runResult.kind === "ok" ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-fg-subtle">=</span>
                <span className="text-syntax-num">{runResult.exact}</span>
                {runResult.numeric && (
                  <>
                    <span className="text-fg-subtle">≈</span>
                    <span className="text-fg-muted">{runResult.numeric}</span>
                  </>
                )}
              </div>
            ) : (
              runResult.message
            )}
          </div>
        )}
      </section>

      {/* Vertical split gutter */}
      <div
        onPointerDown={onSplitPointerDown}
        role="separator"
        aria-orientation="horizontal"
        className="mx-8 my-2 h-1 shrink-0 cursor-row-resize rounded-full bg-border transition-colors hover:bg-accent"
      />

      {/* Notes */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 pb-6">
        <div className="mb-2 shrink-0 font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">
          notes
        </div>
        <textarea
          value={selected.notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Write your reasoning, references, or a solution sketch…"
          className="min-h-0 flex-1 resize-none rounded-sm border border-border bg-bg-panel px-3 py-2 font-mono text-[13px] leading-[1.6] text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
        />
      </section>
    </div>
  );
}

/* ---------------- Notebook mode view ---------------- */

function NotebookView(props: {
  selected: Problem;
  onTitleChange: (v: string) => void;
  onCellChange: (id: string, v: string) => void;
  onCellFocus: (id: string) => void;
  onInsert: (afterId: string | null, type: Cell["type"]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleType: (id: string) => void;
  computeReady: boolean;
}) {
  const {
    selected,
    onTitleChange,
    onCellChange,
    onCellFocus,
    onInsert,
    onRemove,
    onMove,
    onToggleType,
    computeReady,
  } = props;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 px-8 py-6">
        <input
          value={selected.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Notebook title"
          className="w-full border-0 border-b border-transparent bg-transparent pb-2 text-2xl font-semibold tracking-tight text-fg outline-none transition-colors focus:border-border"
        />

        <div className="flex flex-col gap-3">
          {selected.cells.length === 0 && (
            <div className="rounded-sm border border-dashed border-border p-4 text-center font-mono text-[11.5px] text-fg-subtle">
              empty notebook — add a cell below.
            </div>
          )}
          {selected.cells.map((cell, idx) => (
            <div
              key={cell.id}
              className="group flex flex-col gap-1.5 rounded-sm border border-border bg-bg-elevated p-2"
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                <span className="flex items-center gap-2">
                  <span className="text-fg-subtle">
                    [{String(idx + 1).padStart(2, "0")}]
                  </span>
                  <span
                    className={
                      cell.type === "math" ? "text-accent" : "text-fg-muted"
                    }
                  >
                    {cell.type}
                  </span>
                </span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onToggleType(cell.id)}
                    title={
                      cell.type === "math" ? "Switch to text" : "Switch to math"
                    }
                    className="grid h-5 w-5 place-items-center rounded-sm text-fg-subtle hover:bg-bg-hover hover:text-fg"
                  >
                    {cell.type === "math" ? (
                      <Type className="h-3 w-3" strokeWidth={1.5} />
                    ) : (
                      <FunctionSquare
                        className="h-3 w-3"
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => onMove(cell.id, -1)}
                    title="Move up"
                    className="grid h-5 w-5 place-items-center rounded-sm text-fg-subtle hover:bg-bg-hover hover:text-fg"
                  >
                    <ArrowUp className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => onMove(cell.id, 1)}
                    title="Move down"
                    className="grid h-5 w-5 place-items-center rounded-sm text-fg-subtle hover:bg-bg-hover hover:text-fg"
                  >
                    <ArrowDown className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => onRemove(cell.id)}
                    title="Delete cell"
                    className="grid h-5 w-5 place-items-center rounded-sm text-fg-subtle hover:bg-bg-hover hover:text-danger"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              {cell.type === "math" ? (
                <MathCell
                  value={cell.value}
                  onChange={(v) => {
                    onCellChange(cell.id, v);
                    onCellFocus(cell.id);
                  }}
                  onFocus={() => onCellFocus(cell.id)}
                  computeReady={computeReady}
                />
              ) : (
                <textarea
                  value={cell.value}
                  onChange={(e) => onCellChange(cell.id, e.target.value)}
                  placeholder="Commentary, steps, or context…"
                  rows={Math.max(2, cell.value.split("\n").length)}
                  className="w-full resize-y rounded-sm border border-border bg-bg-panel px-3 py-2 font-mono text-[13px] leading-[1.6] text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
                />
              )}
              <div className="flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    onClick={() => onInsert(cell.id, "math")}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={1.5} />
                    math
                  </button>
                  <button
                    onClick={() => onInsert(cell.id, "text")}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle transition-colors hover:border-border-strong hover:text-fg"
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={1.5} />
                    text
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => onInsert(null, "math")}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg-panel px-3 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            math cell
          </button>
          <button
            onClick={() => onInsert(null, "text")}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg-panel px-3 py-1.5 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            text cell
          </button>
        </div>
      </div>
    </div>
  );
}
