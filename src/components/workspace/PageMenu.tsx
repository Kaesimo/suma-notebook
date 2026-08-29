import { useState } from "react";
import { Archive, MoreHorizontal } from "lucide-react";
import { useWorkspaceContext } from "./workspace-context";

export function PageMenu() {
  const ws = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  if (!ws.selected) return null;

  const item =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg";

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Page actions"
        className="grid h-8 w-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
      >
        <MoreHorizontal className="h-4.5 w-4.5" strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-border bg-bg-elevated py-1 shadow-lg">
            <button
              onClick={() => {
                ws.archiveProblem(ws.selected!.id);
                setOpen(false);
              }}
              className={item}
            >
              <Archive className="h-3.5 w-3.5" /> Archive page
            </button>
          </div>
        </>
      )}
    </div>
  );
}
