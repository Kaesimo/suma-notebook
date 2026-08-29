import { createFileRoute, Link } from "@tanstack/react-router";
import { Katex } from "@/components/workspace/Katex";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Suma Notebook — write and solve math" },
      {
        name: "description",
        content:
          "A notebook for math homework: write equations, see them solved, add notes, and export a PDF — all saved automatically.",
      },
      { property: "og:title", content: "Suma Notebook — write and solve math" },
      {
        property: "og:description",
        content:
          "Write equations, see them solved, add notes, and export a PDF — all saved automatically.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
        <span className="text-[13px] font-medium tracking-tight text-fg-muted">Suma</span>
        <Link
          to="/workspace"
          className="rounded-md bg-accent px-3 py-1 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Open notebook
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-[520px]">
          <h1 className="text-[15px] font-medium text-fg">
            A notebook for writing and solving mathematics.
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">
            Write prose and equations on the same page. Press Solve to evaluate. Everything saves
            locally — nothing leaves your browser.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-md border border-border bg-sheet px-4 py-3">
              <div className="text-[14px]">
                <Katex tex="\int_0^{\infty} e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}" display />
              </div>
            </div>

            <div className="rounded-md border border-border bg-sheet px-4 py-3">
              <div className="text-[14px]">
                <Katex tex="\frac{d}{dx}\left[x^n\right] = nx^{n-1}" display />
              </div>
            </div>

            <div className="rounded-md border border-border bg-sheet px-4 py-3">
              <div className="text-[14px]">
                <Katex tex="\sum_{k=1}^{n} k = \frac{n(n+1)}{2}" display />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link
              to="/workspace"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-[14px] font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              Start writing
            </Link>
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-fg-subtle">
            Text and math live together on a single document. Use Ctrl/Cmd + M to insert an
            equation. The Solve button evaluates it. Export to PDF when you're done.
          </p>
        </div>
      </main>

      <footer className="shrink-0 border-t border-border px-6 py-4 text-center text-[12px] text-fg-subtle">
        All data stays on your device.
      </footer>
    </div>
  );
}
