import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
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
      {
        property: "og:title",
        content: "Suma Notebook — write and solve math",
      },
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="font-serif text-[22px] leading-none text-accent">
            Σ
          </span>
          Suma Notebook
        </div>
        <Link
          to="/workspace"
          className="rounded-full bg-accent px-4 py-1.5 text-[13.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Open notebook
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <section className="w-full max-w-2xl text-center">
          <span aria-hidden className="font-serif text-[64px] leading-none text-accent">
            Σ
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-tight text-fg sm:text-[44px]">
            Write math like a notebook.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed text-fg-muted">
            Suma Notebook is a place to write equations, watch them get solved, and keep your math
            work organized — saved automatically, right in your browser.
          </p>

          <div className="mt-7 flex justify-center">
            <Link
              to="/workspace"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-[15px] font-medium text-accent-fg shadow-[0_6px_20px_color-mix(in_oklab,var(--accent)_35%,transparent)] transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              Start writing
            </Link>
          </div>

          <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-sheet p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-center py-2 text-[20px]">
              <Katex tex="\sum_{k=1}^{n} k = \frac{n(n+1)}{2}" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 border-t border-border pt-3 text-[13px] text-fg-muted">
              Type it, press Solve, see the answer.
            </div>
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-border px-6 py-6 text-center text-[12px] text-fg-subtle">
        Suma Notebook — your math work stays on your device
      </footer>
    </div>
  );
}
