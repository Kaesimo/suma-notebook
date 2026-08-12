import { useState } from "react";
import { ArchiveRestore, ChevronDown, ChevronRight, FileText, Grid, Trash2 } from "lucide-react";
import { useWorkspaceContext } from "./workspace-context";

/**
 * Minimal, page-oriented navigation — a clean list of notebooks, an "All
 * pages" grid view, and a collapsible Archive. No file tree.
 */
export function PageSidebar({
  open,
  onShowAll,
  showAll,
  onOpenPage,
}: {
  open: boolean;
  onShowAll: () => void;
  showAll: boolean;
  onOpenPage: (id: string) => void;
}) {
  const ws = useWorkspaceContext();
  const [archiveOpen, setArchiveOpen] = useState(true);

  if (!open) {
    return (
      <aside className="hidden shrink-0 flex-col items-center gap-2 border-r border-border bg-bg-panel py-3 md:flex">
        <button
          onClick={onShowAll}
          aria-label="All pages"
          title="All pages"
          className="grid h-9 w-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
        >
          <Grid className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>
      </aside>
    );
  }

  const active = ws.problems.filter((p) => !p.archivedAt);
  const archived = ws.problems.filter((p) => !!p.archivedAt);

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-bg-panel md:flex">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <button
          onClick={onShowAll}
          className={
            "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors " +
            (showAll ? "bg-bg-hover text-fg" : "text-fg-muted hover:bg-bg-hover hover:text-fg")
          }
        >
          <Grid className="h-4 w-4" strokeWidth={1.75} />
          All pages
        </button>

        <div className="mt-4 mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          Pages
        </div>
        <ul className="flex flex-col gap-0.5">
          {active.length === 0 && (
            <li className="px-2.5 py-2 text-[13px] text-fg-subtle">Nothing here yet.</li>
          )}
          {active.map((p) => {
            const isActive = p.id === ws.selectedId;
            return (
              <li key={p.id}>
                <button
                  onClick={() => onOpenPage(p.id)}
                  className={
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors " +
                    (isActive
                      ? "bg-bg-hover font-medium text-fg"
                      : "text-fg-muted hover:bg-bg-hover hover:text-fg")
                  }
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-fg-subtle" strokeWidth={1.75} />
                  <span className="min-w-0 truncate">{p.title || "Untitled page"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {archived.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setArchiveOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
            >
              {archiveOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Archive ({archived.length})
            </button>
            {archiveOpen && (
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {archived.map((p) => (
                  <li
                    key={p.id}
                    className="group flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-fg-subtle transition-colors hover:bg-bg-hover"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.title || "Untitled page"}</span>
                    <button
                      onClick={() => ws.restoreProblem(p.id)}
                      aria-label="Restore page"
                      title="Restore"
                      className="hidden text-fg-subtle transition-colors hover:text-accent group-hover:block"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Permanently delete "${p.title || "Untitled page"}"? This cannot be undone.`,
                          )
                        )
                          ws.deleteProblemPermanent(p.id);
                      }}
                      aria-label="Delete permanently"
                      title="Delete permanently"
                      className="hidden text-fg-subtle transition-colors hover:text-danger group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
