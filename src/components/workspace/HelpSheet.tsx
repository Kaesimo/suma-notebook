import { X } from "lucide-react";

export function HelpSheet({ onClose }: { onClose: () => void }) {
  const items: { title: string; body: string }[] = [
    {
      title: "Write math",
      body: "Write prose normally. To add an equation, focus an empty line and click Math (or press Ctrl/Cmd + M). The line becomes a math field. Press Enter to return to prose.",
    },
    {
      title: "Solve",
      body: "Click inside an equation and press Solve. Suma shows the exact answer plus a decimal approximation.",
    },
    {
      title: "Raw LaTeX",
      body: "Use the LaTeX button to see and edit the full page as source code.",
    },
    {
      title: "Export",
      body: "Export to PDF via the print dialog, or back up all pages as a .suma.json file.",
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
          <h2 className="text-[15px] font-medium text-fg">How it works</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {items.map((s) => (
            <div key={s.title}>
              <div className="text-[13.5px] font-medium text-fg">{s.title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{s.body}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md bg-accent px-4 py-2 text-[13.5px] font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
