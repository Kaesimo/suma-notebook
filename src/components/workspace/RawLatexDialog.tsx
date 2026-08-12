import { useState } from "react";
import { X } from "lucide-react";

/**
 * Advanced raw-LaTeX editor. Edits the underlying text-mode content string
 * directly; applying re-parses it into the mathfield.
 */
export function RawLatexDialog({
  initial,
  onApply,
  onClose,
}: {
  initial: string;
  onApply: (raw: string) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(initial);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-lg border border-border bg-bg-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="text-[13px] font-medium text-fg">Raw LaTeX</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          className="h-[40vh] w-full resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
          <p className="text-[12px] text-fg-subtle">
            Prose is plain text; math uses <code>$…$</code> and <code>\[…\]</code>.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-border px-3.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(raw)}
              className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
