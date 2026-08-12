import type { Problem } from "./workspace-io";

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string };

const PRINT_ROOT_ID = "suma-print-root";
const PRINT_STYLE_ID = "suma-print-style";

/**
 * Split a document into lines the same way the editor does: plain-text lines
 * (each newline starts a new line) and `\[…\]` display-math blocks. Text is
 * plain characters — like on the site, `$` is just a character.
 */
export function parseContent(content: string): Segment[] {
  const segs: Segment[] = [];
  let text = "";
  const flush = () => {
    if (text.length > 0) {
      segs.push({ kind: "text", value: text });
      text = "";
    }
  };
  let i = 0;
  while (i < content.length) {
    if (content.startsWith("\\[", i)) {
      const end = content.indexOf("\\]", i + 2);
      if (end >= 0) {
        flush();
        segs.push({ kind: "math", value: content.slice(i + 2, end).trim() });
        i = end + 2;
        if (content[i] === "\n") i++;
        continue;
      }
    }
    if (content[i] === "\n") {
      // Empty lines are kept so blank space between paragraphs survives.
      segs.push({ kind: "text", value: text });
      text = "";
      i++;
      continue;
    }
    text += content[i];
    i++;
  }
  flush();
  return segs;
}

/**
 * Export by printing the site's own rendering: a dedicated, print-only
 * container in the document is filled with real MathLive math fields (the same
 * engine the editor uses) and plain prose lines, then the browser's print
 * dialog produces the PDF. This keeps the math pixel-identical to what is on
 * the site and the browser never cuts a page through an equation.
 */
export async function exportWorkspacePdf(problems: Problem[]): Promise<void> {
  const active = problems.filter((p) => !p.archivedAt);
  if (active.length === 0) throw new Error("Nothing to export — no active problems.");

  // Make sure the site's math engine is loaded and its fonts are configured.
  const mod = await import("mathlive");
  const MFE = mod.MathfieldElement as unknown as {
    fontsDirectory?: string;
    soundsDirectory?: string;
  };
  if (!MFE.fontsDirectory) {
    MFE.fontsDirectory = "https://unpkg.com/mathlive@0.110.0/dist/fonts";
    MFE.soundsDirectory = "https://unpkg.com/mathlive@0.110.0/dist/sounds";
  }

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  const styleEl = document.createElement("style");
  styleEl.id = PRINT_STYLE_ID;
  styleEl.textContent = PRINT_CSS;
  document.head.appendChild(styleEl);
  document.body.appendChild(root);

  try {
    const bodyFont =
      getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim() ||
      '"Inter", ui-sans-serif, system-ui, sans-serif';
    root.style.fontFamily = bodyFont;

    const date = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const cover = document.createElement("section");
    cover.className = "print-cover";
    const wordmark = document.createElement("div");
    wordmark.className = "cover-wordmark";
    wordmark.textContent = "Σ";
    const coverTitle = document.createElement("h1");
    coverTitle.className = "cover-title";
    coverTitle.textContent = "Suma Notebook";
    const meta = document.createElement("div");
    meta.className = "cover-meta";
    meta.textContent = `Exported ${date} · ${active.length} problem${active.length === 1 ? "" : "s"}`;
    cover.append(wordmark, coverTitle, meta);
    root.appendChild(cover);

    active.forEach((p, i) => {
      const sec = document.createElement("section");
      sec.className = `print-page${i === 0 ? " first" : ""}`;
      const h1 = document.createElement("h1");
      h1.textContent = p.title || "Untitled";
      sec.appendChild(h1);
      for (const seg of parseContent(p.content)) {
        if (seg.kind === "text") {
          const t = document.createElement("div");
          t.className = "suma-text-line print-text";
          t.textContent = seg.value;
          sec.appendChild(t);
        } else {
          const mf = document.createElement("math-field");
          mf.className = "suma-document suma-math-line print-math";
          mf.setAttribute("readonly", "");
          mf.value = seg.value;
          sec.appendChild(mf);
        }
      }
      root.appendChild(sec);
    });

    // Let MathLive render and webfonts finish before printing.
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 400));

    window.print();

    // Resolve once the print dialog is dismissed (Chrome's print() blocks,
    // Firefox fires `afterprint`); a timeout guards against it never firing.
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      window.addEventListener("afterprint", done, { once: true });
      setTimeout(done, 30000);
    });
  } finally {
    root.remove();
    styleEl.remove();
  }
}

const PRINT_CSS = `
#suma-print-root {
  position: fixed;
  left: -99999px;
  top: 0;
  width: 780px;
  background: #ffffff;
  color: #111111;
}
@media print {
  @page { size: A4 portrait; margin: 18mm 16mm; }
  body > *:not(#suma-print-root) { display: none !important; }
  #suma-print-root {
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: auto !important;
    min-height: 0 !important;
    color: #111111 !important;
  }

  /* ---- Letterhead (top of the first page) ---- */
  #suma-print-root .print-cover {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 12px;
    padding: 0 0 14px 0;
    margin: 0 0 24px 0;
    border-bottom: 2px solid #111111;
  }
  #suma-print-root .print-cover .cover-wordmark {
    font-size: 34px;
    line-height: 1;
    font-weight: 300;
    color: #111111;
  }
  #suma-print-root .print-cover .cover-title {
    font-size: 28px;
    font-weight: 650;
    letter-spacing: -0.02em;
    margin: 0;
    color: #111111;
  }
  #suma-print-root .print-cover .cover-meta {
    margin-left: auto;
    font-size: 13px;
    color: #666666;
  }

  /* ---- Problem pages ---- */
  #suma-print-root .print-page { break-before: page; }
  #suma-print-root .print-page.first { break-before: auto; }
  #suma-print-root .print-page h1 {
    margin: 0 0 20px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2e2e2;
    font-size: 32px;
    font-weight: 650;
    letter-spacing: -0.015em;
    line-height: 1.25;
    break-after: avoid;
    color: #111111;
  }

  /* Prose: generously sized, tight enough to read, comfortable spacing. */
  #suma-print-root .suma-text-line {
    font-size: 20px;
    line-height: 1.55;
    color: #111111 !important;
    padding: 0;
    margin: 0;
    min-height: 0;
  }
  /* A blank source line becomes an empty div — keep it as paragraph space. */
  #suma-print-root .suma-text-line:empty {
    min-height: 0.9em;
  }

  /* Display math: clearly larger than prose, never split across pages. */
  #suma-print-root math-field.suma-math-line {
    font-size: 30px;
    line-height: 1.4;
    min-height: 0;
    margin: 18px 0;
    color: #111111 !important;
  }
  #suma-print-root math-field.suma-math-line::part(content) {
    padding: 0;
  }
  #suma-print-root .print-math { break-inside: avoid; }
}
`;
