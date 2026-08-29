import type { MathfieldElement } from "mathlive";

export type ExportFormat = "latex" | "math-ml" | "ascii-math" | "math-json";

export type EvalResult =
  { kind: "ok"; exact?: string; numeric?: string } | { kind: "err"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ce: any = null;

async function getCE() {
  if (!_ce) {
    const { ComputeEngine } = await import("@cortex-js/compute-engine");
    _ce = new ComputeEngine();
  }
  return _ce;
}

export async function evaluateLatex(latex: string): Promise<EvalResult> {
  const ce = await getCE();
  const expr = ce.parse(latex || "0");
  const evald = expr.evaluate();
  const numeric = expr.N();
  const exactLatex = evald.latex;
  const numLatex = numeric.latex;
  return {
    kind: "ok",
    exact: exactLatex,
    numeric: numLatex !== exactLatex ? numLatex : undefined,
  };
}

// Cache one offscreen mathfield for format conversion.
let _convertField: MathfieldElement | null = null;

export function convertFormat(latex: string, target: ExportFormat): string {
  if (typeof document === "undefined") return latex;
  if (!_convertField) {
    _convertField = document.createElement("math-field") as MathfieldElement;
    _convertField.style.position = "absolute";
    _convertField.style.left = "-99999px";
    _convertField.style.top = "0";
    _convertField.setAttribute("read-only", "");
    document.body.appendChild(_convertField);
  }
  _convertField.value = latex;
  const v = _convertField.getValue(target as unknown as never);
  if (v === undefined || v === null) {
    throw new Error(`Conversion to ${target} failed`);
  }
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

export function formatLabel(f: ExportFormat): string {
  switch (f) {
    case "latex":
      return "LaTeX";
    case "math-ml":
      return "MathML";
    case "ascii-math":
      return "ASCIIMath";
    case "math-json":
      return "Math JSON";
  }
}
