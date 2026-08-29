import type { Problem } from "./workspace-io";

export type Snapshot = {
  ts: number;
  title: string;
  content: string;
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
    if (last && last.title === p.title && last.content === p.content) {
      return;
    }
    const snap: Snapshot = {
      ts: Date.now(),
      title: p.title,
      content: p.content,
    };
    const next = [snap, ...existing].slice(0, MAX);
    localStorage.setItem(key(p.id), JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
}
