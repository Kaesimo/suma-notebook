import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Suma Notebook" },
      {
        name: "description",
        content:
          "Suma Notebook is a notebook for writing math homework: live LaTeX, evaluation, notes, and local autosave.",
      },
      {
        property: "og:title",
        content: "Suma Notebook",
      },
      {
        property: "og:description",
        content:
          "Notebook for writing math homework.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      {/* Top bar */}
      <header className="hairline-b flex h-11 items-center justify-between bg-bg-panel px-4 font-mono text-xs text-fg-muted">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="font-serif text-[18px] leading-none text-accent"
            style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}
          >
            Σ
          </span>
          <span className="tracking-wide text-fg"></span>
        </div>
        <div className="flex items-center gap-4" />
      </header>

      {/* Body */}
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <section className="flex w-full max-w-xl flex-col items-center text-center">
          <span
            aria-hidden
            className="font-serif text-[72px] leading-none text-accent"
            style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}
          >
            Σ
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-fg">
            Suma Notebook
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-muted">
            A notebook for math homework. Live LaTeX, evaluation, and notes —
            saved locally, yours to keep.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/workspace"
              className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              Open notebook
              <span className="font-mono text-xs opacity-70">↵</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="hairline-t px-6 py-6 font-mono text-[11px] text-fg-subtle">
        <div className="mx-auto flex max-w-[1240px] items-center justify-center">
          <span>Suma Notebook · v0.1</span>
        </div>
      </footer>
    </div>
  );
}
