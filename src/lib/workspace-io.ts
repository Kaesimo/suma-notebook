export type Problem = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  archivedAt?: number;
};

export type WorkspaceFile = {
  format: "project-mat.workspace";
  version: 4;
  exportedAt: string;
  problems: Problem[];
  selectedId: string | null;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Escape plain text so it reads as a text zone inside a text-mode field. */
function textToContent(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/([\\$])/g, "\\$1"))
    .join("\n\n");
}

/** Wrap a legacy standalone math block as a display equation. */
function mathToContent(latex: string): string {
  const inner = latex.trim();
  if (!inner) return "";
  return `\\[\n${inner}\n\\]`;
}

/**
 * Migrate any persisted problem shape (v1–v3: cells / latex / notes) into the
 * single mixed text+math document (v4). The `content` field uses text-mode
 * semantics: prose is plain text, inline math is `$…$`, display math is
 * `\[…\]`.
 */
export function migrateProblem(p: Record<string, unknown>): Problem | null {
  if (!p || typeof p !== "object") return null;
  const id = typeof p.id === "string" ? p.id : uid();
  const title = typeof p.title === "string" ? p.title : "Untitled";
  const updatedAt = typeof p.updatedAt === "number" ? p.updatedAt : Date.now();
  const archivedAt = typeof p.archivedAt === "number" ? p.archivedAt : undefined;

  let content = "";
  if (typeof p.content === "string") {
    content = p.content;
  } else {
    const rawCells = Array.isArray(p.cells) ? p.cells : [];
    const cells: { type: string; value: string }[] = [];
    for (const c of rawCells) {
      if (c && typeof c === "object") {
        const cc = c as Record<string, unknown>;
        if ((cc.type === "math" || cc.type === "text") && typeof cc.value === "string") {
          cells.push({ type: cc.type, value: cc.value });
        }
      }
    }
    if (cells.length > 0) {
      const parts: string[] = [];
      for (const cell of cells) {
        if (cell.type === "math") parts.push(mathToContent(cell.value));
        else if (cell.value.trim()) parts.push(textToContent(cell.value));
      }
      content = parts.join("\n\n");
    } else {
      const latex = typeof p.latex === "string" ? p.latex : "";
      const notes = typeof p.notes === "string" ? p.notes : "";
      const chunks = [mathToContent(latex), notes.trim() ? textToContent(notes) : ""].filter(
        Boolean,
      );
      content = chunks.join("\n\n");
    }
  }

  return { id, title, content, updatedAt, archivedAt };
}

export function buildWorkspaceFile(problems: Problem[], selectedId: string | null): WorkspaceFile {
  return {
    format: "project-mat.workspace",
    version: 4,
    exportedAt: new Date().toISOString(),
    problems,
    selectedId,
  };
}

export function downloadWorkspace(problems: Problem[], selectedId: string | null) {
  const payload = buildWorkspaceFile(problems, selectedId);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `suma-${date}.suma.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseWorkspaceFile(raw: string): WorkspaceFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Unexpected file shape.");
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== "project-mat.workspace") throw new Error("Not a Suma workspace file.");
  if (obj.version !== 1 && obj.version !== 2 && obj.version !== 3 && obj.version !== 4)
    throw new Error("Unsupported workspace version.");
  if (!Array.isArray(obj.problems)) throw new Error("Missing problems array.");
  const problems: Problem[] = [];
  for (const item of obj.problems) {
    const migrated = migrateProblem(item as Record<string, unknown>);
    if (migrated) problems.push(migrated);
  }
  const selectedId = typeof obj.selectedId === "string" ? obj.selectedId : null;
  return {
    format: "project-mat.workspace",
    version: 4,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    problems,
    selectedId,
  };
}

export function mergeWorkspace(current: Problem[], incoming: Problem[]): Problem[] {
  const existing = new Set(current.map((p) => p.id));
  const remapped = incoming.map((p) =>
    existing.has(p.id) ? { ...p, id: uid(), updatedAt: Date.now() } : p,
  );
  return [...remapped, ...current];
}
