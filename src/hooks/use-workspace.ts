import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadWorkspace,
  parseWorkspaceFile,
  mergeWorkspace,
  migrateProblem,
  type Problem,
} from "@/lib/workspace-io";
import { exportWorkspacePdf } from "@/lib/pdf-export";
import { pushSnapshot } from "@/lib/history";

const STORAGE_KEY = "mat:problems:v2";
const LEGACY_STORAGE_KEY = "mat:problems:v1";
const SELECTED_KEY = "mat:problems:selected:v1";
const APPEARANCE_KEY = "mat:appearance:v1";

export type Appearance = { font: string; accent: string };

export const FONT_OPTIONS = [
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

export const ACCENT_OPTIONS = [
  { id: "blue", label: "Blue", value: "#7aa2f7" },
  { id: "purple", label: "Purple", value: "#bb9af7" },
  { id: "cyan", label: "Cyan", value: "#7dcfff" },
  { id: "green", label: "Green", value: "#9ece6a" },
] as const;

export const DEFAULT_APPEARANCE: Appearance = {
  font: "sans",
  accent: "blue",
};

export type ImportPending = {
  problems: Problem[];
  selectedId: string | null;
};

function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return {
      font: typeof parsed.font === "string" ? parsed.font : DEFAULT_APPEARANCE.font,
      accent: typeof parsed.accent === "string" ? parsed.accent : DEFAULT_APPEARANCE.accent,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function newProblem(): Problem {
  return {
    id: uid(),
    title: "Untitled page",
    content: "",
    updatedAt: Date.now(),
  };
}

function loadProblems(): Problem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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

/**
 * Single source of truth for the workspace. Owns every piece of persisted
 * state, the MathLive / Compute Engine bootstrap, autosave, history
 * snapshots, page CRUD, and import / export. The UI layer renders whatever
 * this hook exposes.
 */
export function useWorkspace() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [computeReady, setComputeReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<ImportPending | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Apply the selected appearance: font and accent live on the root.
  useEffect(() => {
    const root = document.documentElement;
    const font = FONT_OPTIONS.find((f) => f.id === appearance.font) ?? FONT_OPTIONS[0];
    const accent = ACCENT_OPTIONS.find((a) => a.id === appearance.accent) ?? ACCENT_OPTIONS[0];
    root.style.setProperty("--font-sans", font.stack);
    root.style.setProperty("--accent", accent.value);
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [appearance]);

  // Initial load + seed a welcome page on first run.
  useEffect(() => {
    const stored = loadProblems();
    if (stored.length === 0) {
      const seed = newProblem();
      seed.title = "Welcome to Suma";
      seed.content =
        "Hi there! This is your notebook — a page for writing and solving math.\n\n" +
        "Write prose here, just like any document. To add an equation, start a fresh line and type $ — the line turns into math, so ^, / and \\sqrt all work. Press Enter to return to prose.\n\n" +
        "\\[\n\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}\n\\]\n\n" +
        "Click inside the equation above and press Solve when it appears.";
      setProblems([seed]);
      setSelectedId(seed.id);
    } else {
      setProblems(stored);
      const savedSel = localStorage.getItem(SELECTED_KEY);
      const firstActive = stored.find((p) => !p.archivedAt) ?? stored[0];
      setSelectedId(
        savedSel && stored.some((p) => p.id === savedSel && !p.archivedAt)
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
      } catch {
        /* storage unavailable — ignore */
      }
    }
  }, [selectedId]);

  // Register mathlive + compute engine once on the client.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("mathlive");
      if (cancelled) return;
      mod.MathfieldElement.fontsDirectory = "https://unpkg.com/mathlive@0.110.0/dist/fonts";
      mod.MathfieldElement.soundsDirectory = "https://unpkg.com/mathlive@0.110.0/dist/sounds";
      try {
        const { ComputeEngine } = await import("@cortex-js/compute-engine");
        if (cancelled) return;
        // Attaching the engine unlocks MathJSON export & evaluation.
        (
          mod.MathfieldElement as unknown as {
            computeEngine: unknown;
          }
        ).computeEngine = new ComputeEngine();
        setComputeReady(true);
      } catch {
        /* storage unavailable — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => problems.find((p) => p.id === selectedId) ?? null,
    [problems, selectedId],
  );

  /* ---------- page CRUD ---------- */

  function addProblem() {
    const p = newProblem();
    setProblems((prev) => [p, ...prev]);
    setSelectedId(p.id);
  }

  function archiveProblem(id: string) {
    setProblems((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, archivedAt: Date.now() } : p));
      if (id === selectedId) {
        const nextActive = next.find((p) => !p.archivedAt);
        setSelectedId(nextActive?.id ?? null);
      }
      return next;
    });
  }

  function restoreProblem(id: string) {
    setProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archivedAt: undefined, updatedAt: Date.now() } : p)),
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
    } catch {
      /* storage unavailable — ignore */
    }
  }

  const updateSelected = useCallback(
    (patch: Partial<Problem>) => {
      setProblems((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, ...patch, updatedAt: Date.now() } : p)),
      );
    },
    [selectedId],
  );

  /* ---------- import / export ---------- */

  function handleExport() {
    downloadWorkspace(problems, selectedId);
  }

  async function exportPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await exportWorkspacePdf(problems);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setPdfBusy(false);
    }
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

  return {
    problems,
    selectedId,
    setSelectedId,
    selected,
    computeReady,
    savedAt,
    importPending,
    setImportPending,
    importError,
    setImportError,
    appearance,
    setAppearance,
    pdfBusy,
    pdfError,
    setPdfError,
    addProblem,
    archiveProblem,
    restoreProblem,
    deleteProblemPermanent,
    updateSelected,
    handleExport,
    exportPdf,
    onImportFile,
    applyImport,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
