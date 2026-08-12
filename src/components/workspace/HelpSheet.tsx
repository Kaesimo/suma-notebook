import { X } from "lucide-react";

/**
 * Friendly "How it works" sheet — plain language, no developer jargon.
 */
export function HelpSheet({ onClose }: { onClose: () => void }) {
  const steps: { title: string; body: string }[] = [
    {
      title: "Write math",
      body: "Write prose normally. To write an equation, focus an empty line and click the Math button that appears (or press Ctrl/Cmd + M) — the line turns into math. Fractions, powers, symbols, and equals signs all work like a paper worksheet. Press Enter to get back to prose.",
    },
    {
      title: "Solve",
      body: "Click inside an equation and press the Solve pill that appears beneath it. Suma works out the exact answer plus a decimal approximation.",
    },
    {
      title: "Raw LaTeX",
      body: "Press Esc to hide the tools, or use the LaTeX pill to see the whole page as source code.",
    },
    {
      title: "Export",
      body: "Download a PDF of your pages, or back up everything to a .suma.json file and restore it later.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-lg border border-border bg-bg-elevated p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-fg">How it works</h2>
            <p className="mt-0.5 text-[13.5px] text-fg-muted">
              Four things to know. Everything saves automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="mt-4 flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-[12.5px] font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <div className="text-[14px] font-medium text-fg">{s.title}</div>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-accent px-4 py-2 text-[13.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
