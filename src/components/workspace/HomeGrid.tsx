import { FileText } from "lucide-react";
import { useWorkspaceContext } from "./workspace-context";

function previewText(content: string): string {
  const plain = content
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ")
    .replace(/[{}]/g, " ");
  return (
    plain
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l) || ""
  );
}

function timeAgo(ts: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function HomeGrid({ onOpenPage }: { onOpenPage: (id: string) => void }) {
  const ws = useWorkspaceContext();
  const active = ws.problems.filter((p) => !p.archivedAt);

  return (
    <div className="mx-auto max-w-[860px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">All pages</h1>
      <p className="mt-1 text-[14px] text-fg-muted">
        {active.length === 0
          ? "Your notebook is ready when you are."
          : `${active.length} page${active.length === 1 ? "" : "s"}, saved locally.`}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-[14px] leading-relaxed text-fg-muted">
              Your notebook is empty. Create your first page to start writing.
            </p>
          </div>
        )}

        {active.map((p) => (
          <button
            key={p.id}
            onClick={() => onOpenPage(p.id)}
            className="group rounded-lg border border-border bg-sheet p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)]"
          >
            <div className="flex items-center gap-2 text-fg-subtle">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[12px]">{timeAgo(p.updatedAt)}</span>
            </div>
            <div className="mt-2 truncate text-[15px] font-semibold text-fg group-hover:text-accent">
              {p.title || "Untitled page"}
            </div>
            <div className="mt-1 line-clamp-2 min-h-[2.5em] text-[13px] leading-relaxed text-fg-muted">
              {previewText(p.content) || "Empty page — click to start writing."}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
