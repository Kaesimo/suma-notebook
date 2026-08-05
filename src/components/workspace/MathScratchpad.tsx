import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";

const STORAGE_KEY = "mat:scratchpad:v2";

const SAMPLES: { label: string; src: string }[] = [
  { label: "fraction", src: "\\frac{a}{b}" },
  { label: "sum", src: "\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}" },
  { label: "integral", src: "\\int_0^{\\pi} \\sin(x)\\,dx = 2" },
  { label: "matrix", src: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "limit", src: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
  { label: "sqrt", src: "\\sqrt{x^2 + y^2}" },
];

const DEFAULT_SRC = "e^{i\\pi} + 1 = 0";

type ExportFormat = "latex" | "math-ml" | "ascii-math" | "math-json";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & {
          ref?: React.Ref<MathfieldElement>;
          class?: string;
        },
        MathfieldElement
      >;
    }
  }
}

export function MathScratchpad() {
  const mfRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState<string>(DEFAULT_SRC);
  const [ready, setReady] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("latex");
  const [copied, setCopied] = useState(false);

  // Dynamically register the custom element on the client only.
  useEffect(() => {
    let cancelled = false;
    import("mathlive").then((mod) => {
      if (cancelled) return;
      // Point virtual keyboard fonts/sounds at the CDN so the bundled worker
      // doesn't need extra asset wiring.
      mod.MathfieldElement.fontsDirectory =
        "https://unpkg.com/mathlive@0.110.0/dist/fonts";
      mod.MathfieldElement.soundsDirectory =
        "https://unpkg.com/mathlive@0.110.0/dist/sounds";
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load persisted LaTeX.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setLatex(saved);
    } catch {}
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, latex);
    } catch {}
  }, [latex]);

  // Wire the mathfield instance.
  useEffect(() => {
    if (!ready) return;
    const mf = mfRef.current;
    if (!mf) return;

    mf.value = latex;

    const onInput = () => setLatex(mf.value);
    mf.addEventListener("input", onInput);
    return () => {
      mf.removeEventListener("input", onInput);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Push external edits (snippets, clear) into the mathfield.
  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    if (mf.value !== latex) mf.value = latex;
  }, [latex]);

  const insertSnippet = (src: string) => {
    const mf = mfRef.current;
    if (mf) {
      mf.executeCommand(["insert", src]);
      mf.focus();
    } else {
      setLatex((prev) => (prev ? prev + " " + src : src));
    }
  };

  const exported = (() => {
    const mf = mfRef.current;
    if (!mf) return latex;
    try {
      const v = mf.getValue(format);
      return typeof v === "string" ? v : JSON.stringify(v, null, 2);
    } catch {
      return latex;
    }
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const chars = latex.length;

  return (
    <aside className="flex h-full flex-col border-r border-border bg-bg-elevated">
      <div className="flex h-8 items-center justify-between border-b border-border px-3 font-mono text-[11px] uppercase tracking-widest text-fg-subtle">
        <span>mathfield.tex</span>
        <button
          onClick={() => setLatex("")}
          className="text-fg-subtle transition-colors hover:text-fg"
          title="Clear"
        >
          clear
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-bg px-3 py-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            editor · live preview
          </div>
          {ready ? (
            <math-field
              ref={mfRef}
              class="mat-mathfield"
              style={{
                display: "block",
                width: "100%",
                minHeight: "72px",
                padding: "8px 10px",
                background: "var(--bg-panel)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                fontSize: "18px",
                outline: "none",
              }}
            />
          ) : (
            <div className="h-[72px] animate-pulse rounded-sm border border-border bg-bg-panel" />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <div className="flex gap-1">
              {(["latex", "math-ml", "ascii-math", "math-json"] as ExportFormat[]).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={
                      "rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] transition-colors " +
                      (format === f
                        ? "bg-bg-hover text-fg"
                        : "text-fg-subtle hover:text-fg")
                    }
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={copy}
              className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11.5px] leading-[1.55] text-fg-muted">
            {exported || " "}
          </pre>
        </div>

        <div className="border-t border-border px-3 py-2">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            snippets
          </div>
          <div className="flex flex-wrap gap-1">
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                onClick={() => insertSnippet(s.src)}
                className="rounded-sm border border-border bg-bg-panel px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-1 font-mono text-[10.5px] text-fg-subtle">
          <span>{chars} ch</span>
          <span className="text-success">✓ mathlive</span>
        </div>
      </div>
    </aside>
  );
}
