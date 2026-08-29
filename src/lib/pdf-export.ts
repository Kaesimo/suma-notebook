import type { Problem } from "./workspace-io";
import { parseContent } from "./content";

const PRINT_ROOT_ID = "suma-print-root";
const PRINT_STYLE_ID = "suma-print-style";

export async function exportWorkspacePdf(problems: Problem[]): Promise<void> {
  const active = problems.filter((p) => !p.archivedAt);
  if (active.length === 0) throw new Error("Nothing to export — no active problems.");

  const [{ default: katex }] = await Promise.all([import("katex")]);

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
    const coverTitle = document.createElement("div");
    coverTitle.className = "cover-title";
    coverTitle.textContent = "Suma Notebook";
    const meta = document.createElement("div");
    meta.className = "cover-meta";
    meta.textContent = `${date}  ·  ${active.length} problem${active.length === 1 ? "" : "s"}`;
    cover.append(coverTitle, meta);
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
          t.className = "print-text";
          t.textContent = seg.value;
          sec.appendChild(t);
        } else {
          const mathWrap = document.createElement("div");
          mathWrap.className = "print-math";
          try {
            katex.render(seg.value, mathWrap, {
              throwOnError: false,
              displayMode: true,
            });
          } catch {
            mathWrap.textContent = seg.value;
          }
          sec.appendChild(mathWrap);
        }
      }
      root.appendChild(sec);
    });

    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 200));

    window.print();

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
  background: #fff;
  color: #1a1a1a;
}
@media print {
  @page { size: A4 portrait; margin: 22mm 24mm; }
  body > *:not(#suma-print-root) { display: none !important; }
  #suma-print-root {
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: auto !important;
    min-height: 0 !important;
  }

  /* ---- Cover ---- */
  #suma-print-root .print-cover {
    padding: 0 0 14px 0;
    margin: 0 0 36px 0;
    border-bottom: 1px solid #d0d0d0;
  }
  #suma-print-root .print-cover .cover-title {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #999;
    margin: 0;
  }
  #suma-print-root .print-cover .cover-meta {
    margin-top: 3px;
    font-size: 11px;
    color: #bbb;
  }

  /* ---- Pages ---- */
  #suma-print-root .print-page { break-before: page; }
  #suma-print-root .print-page.first { break-before: auto; }

  #suma-print-root .print-page h1 {
    margin: 0 0 28px 0;
    padding: 0 0 10px 0;
    border-bottom: 1px solid #e8e8e8;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.3;
    break-after: avoid;
    color: #1a1a1a;
  }

  /* Prose */
  #suma-print-root .print-text {
    font-size: 14px;
    line-height: 1.75;
    color: #333;
    margin: 0 0 0.1em 0;
  }
  #suma-print-root .print-text:empty {
    height: 0.9em;
  }

  /* Math via KaTeX */
  #suma-print-root .print-math {
    margin: 14px 0;
    break-inside: avoid;
  }
  #suma-print-root .print-math .katex-display {
    margin: 0;
    padding: 0;
  }
  #suma-print-root .print-math .katex {
    font-size: 1.15em;
    color: #1a1a1a;
  }
}
`;
