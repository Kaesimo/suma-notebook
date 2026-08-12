import { useState } from "react";
import { Check, ChevronDown, Copy, X } from "lucide-react";
import { Katex } from "./Katex";
import { convertFormat, formatLabel, type EvalResult, type ExportFormat } from "@/lib/math";

const FORMATS: ExportFormat[] = ["latex", "math-ml", "ascii-math", "math-json"];

/**
 * Floating evaluation result shown beneath the solved math zone: exact +
 * numeric (KaTeX) with a "Copy as…" menu and a dismiss button.
 */
export function SolveResultPanel({
  result,
  sourceLatex,
  onClose,
}: {
  result: EvalResult;
  sourceLatex: string;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState<ExportFormat | null>(null);

  const copyAs = async (f: ExportFormat) => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(convertFormat(sourceLatex, f));
      setCopied(f);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // Clipboard unavailable — ignore.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 text-[17px] shadow-lg">
      <button
        onClick={onClose}
        aria-label="Dismiss result"
        className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-border bg-bg-elevated text-fg-subtle shadow transition-colors hover:text-fg"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>

      {result.kind === "err" ? (
        <span className="text-[13.5px] text-danger">{result.message}</span>
      ) : (
        <>
          <span className="font-serif leading-none text-fg-subtle">=</span>
          <Katex tex={result.exact ?? ""} className="text-fg" />
          {result.numeric && (
            <>
              <span className="font-serif leading-none text-fg-subtle">≈</span>
              <Katex tex={result.numeric} className="text-fg-muted" />
            </>
          )}

          <div className="relative ml-auto">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[12px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" strokeWidth={1.75} />
              )}
              {copied ? formatLabel(copied) : "Copy"}
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full right-0 z-30 mb-1 min-w-[140px] overflow-hidden rounded-md border border-border bg-bg-elevated py-1 shadow-lg">
                  {FORMATS.map((f) => (
                    <button
                      key={f}
                      onClick={() => copyAs(f)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
                    >
                      {formatLabel(f)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
