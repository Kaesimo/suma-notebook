import type { Problem, Cell } from "./workspace-io";

export type Snapshot = {
  ts: number;
  title: string;
  mode: "single" | "notebook";
  latex: string;
  notes: string;
  cells: Cell[];
};

const MAX = 50;
const MIN_INTERVAL_MS = 5000;

function key(id: string) {
  return `mat:history:${id}`;
}

export function loadHistory(id: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushSnapshot(p: Problem): void {
  try {
    const existing = loadHistory(p.id);
    const last = existing[0];
    if (last && Date.now() - last.ts < MIN_INTERVAL_MS) return;
    // Skip if content is identical to last.
    if (
      last &&
      last.title === p.title &&
      last.mode === p.mode &&
      last.latex === p.latex &&
      last.notes === p.notes &&
      JSON.stringify(last.cells) === JSON.stringify(p.cells)
    ) {
      return;
    }
    const snap: Snapshot = {
      ts: Date.now(),
      title: p.title,
      mode: p.mode,
      latex: p.latex,
      notes: p.notes,
      cells: p.cells,
    };
    const next = [snap, ...existing].slice(0, MAX);
    localStorage.setItem(key(p.id), JSON.stringify(next));
  } catch {}
}

export function clearHistory(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {}
}
