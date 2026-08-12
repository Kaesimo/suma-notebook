import { Plus } from "lucide-react";
import { useWorkspaceContext } from "./workspace-context";
import { WelcomeCard } from "./WelcomeCard";
import { DocumentEditor } from "./DocumentEditor";
import { PageMenu } from "./PageMenu";

/**
 * The main canvas: a continuous document page (no block cards, no per-equation
 * boxes). The whole page is one MathLive field in text mode — prose and math
 * zones live together, and only a contextual Solve control appears when the
 * caret is inside math.
 */
export function DocumentSheet() {
  const ws = useWorkspaceContext();

  if (!ws.selected) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center">
          <div className="font-serif text-4xl text-accent">Σ</div>
          <h2 className="mt-3 text-lg font-semibold text-fg">No page is open</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-fg-muted">
            Pick a page from the sidebar, or start a brand-new one.
          </p>
          <button
            onClick={() => ws.addProblem()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
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
