import { Plus } from "lucide-react";
import { useWorkspaceContext } from "./workspace-context";
import { WelcomeCard } from "./WelcomeCard";
import { DocumentEditor } from "./DocumentEditor";
import { PageMenu } from "./PageMenu";

export function DocumentSheet() {
  const ws = useWorkspaceContext();

  if (!ws.selected) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center">
          <p className="text-[14px] text-fg-muted">
            No page is open. Pick one from the sidebar, or create a new one.
          </p>
          <button
            onClick={() => ws.addProblem()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            New page
          </button>
        </div>
      </div>
    );
  }

  const p = ws.selected;

  return (
    <div className="mx-auto max-w-[820px] px-5 pb-48 pt-10 sm:px-8 sm:pt-14">
      {!p.content.trim() && <WelcomeCard />}

      <header className="mb-8 flex items-start justify-between gap-3">
        <input
          value={p.title}
          onChange={(e) => ws.updateSelected({ title: e.target.value })}
          placeholder="Untitled page"
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight text-fg outline-none placeholder:text-fg-subtle"
        />
        <PageMenu />
      </header>

      <DocumentEditor
        value={p.content}
        onChange={(v) => ws.updateSelected({ content: v })}
        computeReady={ws.computeReady}
      />
    </div>
  );
}
