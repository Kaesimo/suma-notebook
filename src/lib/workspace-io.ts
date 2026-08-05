export type Cell = {
  id: string;
  type: "math" | "text";
  value: string;
};

export type Problem = {
  id: string;
  title: string;
  mode: "single" | "notebook";
  latex: string;
  notes: string;
  cells: Cell[];
  updatedAt: number;
  archivedAt?: number;
};

export type WorkspaceFile = {
  format: "project-mat.workspace";
  version: 3;
  exportedAt: string;
  problems: Problem[];
  selectedId: string | null;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function newCell(type: Cell["type"] = "math", value = ""): Cell {
  return { id: uid(), type, value };
}

export function migrateProblem(p: Record<string, unknown>): Problem | null {
  if (!p || typeof p !== "object") return null;
  const id = typeof p.id === "string" ? p.id : uid();
  const title = typeof p.title === "string" ? p.title : "Untitled";
  const latex = typeof p.latex === "string" ? p.latex : "";
  const notes = typeof p.notes === "string" ? p.notes : "";
  const mode: "single" | "notebook" =
    p.mode === "notebook" ? "notebook" : "single";
  const rawCells = Array.isArray(p.cells) ? p.cells : [];
  const cells: Cell[] = rawCells
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const cc = c as Record<string, unknown>;
      if (cc.type !== "math" && cc.type !== "text") return null;
      return {
        id: typeof cc.id === "string" ? cc.id : uid(),
        type: cc.type,
        value: typeof cc.value === "string" ? cc.value : "",
      };
    })
    .filter((x): x is Cell => x !== null);
  return {
    id,
    title,
    mode,
    latex,
    notes,
    cells,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : Date.now(),
    archivedAt:
      typeof p.archivedAt === "number" ? p.archivedAt : undefined,
  };
}

export function buildWorkspaceFile(
  problems: Problem[],
  selectedId: string | null,
): WorkspaceFile {
  return {
    format: "project-mat.workspace",
    version: 3,
    exportedAt: new Date().toISOString(),
    problems,
    selectedId,
  };
}

export function downloadWorkspace(
  problems: Problem[],
  selectedId: string | null,
) {
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
  if (!parsed || typeof parsed !== "object")
    throw new Error("Unexpected file shape.");
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== "project-mat.workspace")
    throw new Error("Not a Suma workspace file.");
  if (obj.version !== 1 && obj.version !== 2 && obj.version !== 3)
    throw new Error("Unsupported workspace version.");
  if (!Array.isArray(obj.problems)) throw new Error("Missing problems array.");
  const problems: Problem[] = [];
  for (const item of obj.problems) {
    const migrated = migrateProblem(item as Record<string, unknown>);
    if (migrated) problems.push(migrated);
  }
  const selectedId =
    typeof obj.selectedId === "string" ? obj.selectedId : null;
  return {
    format: "project-mat.workspace",
    version: 3,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    problems,
    selectedId,
  };
}

export function mergeWorkspace(
  current: Problem[],
  incoming: Problem[],
): Problem[] {
  const existing = new Set(current.map((p) => p.id));
  const remapped = incoming.map((p) =>
    existing.has(p.id) ? { ...p, id: uid(), updatedAt: Date.now() } : p,
  );
  return [...remapped, ...current];
}
