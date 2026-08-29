import { useWorkspaceContext } from "./workspace-context";

/** Import/restore dialog. */
export function ImportDialog() {
  const ws = useWorkspaceContext();
  if (!ws.importPending) return null;

  const count = ws.importPending.problems.length;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={() => ws.setImportPending(null)}
    >
      <div
        className="w-full max-w-[400px] rounded-lg border border-border bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-fg">Restore from backup</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">
          Found {count} page{count === 1 ? "" : "s"} in that file. What would you like to do?
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => ws.applyImport("merge")}
            className="rounded-md bg-accent px-4 py-2.5 text-left text-[13.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            Keep my pages and add the imported ones
          </button>
          <button
            onClick={() => ws.applyImport("replace")}
            className="rounded-md border border-border px-4 py-2.5 text-left text-[13.5px] text-fg-muted transition-colors hover:border-danger hover:text-danger"
          >
            Replace everything with the backup
          </button>
          <button
            onClick={() => ws.setImportPending(null)}
            className="rounded-md px-4 py-2 text-center text-[13px] text-fg-subtle transition-colors hover:text-fg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
