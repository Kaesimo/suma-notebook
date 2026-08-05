import type { Problem } from "./workspace-io";

// Renders a printable HTML tree from active problems, then rasterizes it with
// html2canvas and stitches slices into a jsPDF A4 document. Print theme is
// light-on-white — the app theme is not used.
export async function exportWorkspacePdf(
  problems: Problem[],
): Promise<void> {
  const active = problems.filter((p) => !p.archivedAt);
  if (active.length === 0) throw new Error("Nothing to export — no active problems.");

  const [{ default: jsPDF }, { default: html2canvas }, katex] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
    import("katex"),
  ]);
  // Ensure KaTeX CSS is present (KaTeX HTML relies on it for accurate glyph metrics).
  await ensureKatexCss();

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = "780px"; // ~ A4 minus margins @ 96dpi
  container.style.background = "#ffffff";
  container.style.color = "#111111";
  container.style.fontFamily =
    '"Iowan Old Style", "Charter", Georgia, Cambria, serif';
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.55";
  container.style.padding = "0";

  const renderMath = (latex: string, display = true) => {
    try {
      return katex.default.renderToString(latex || "", {
        throwOnError: false,
        displayMode: display,
        output: "html",
      });
    } catch {
      return `<code>${escapeHtml(latex)}</code>`;
    }
  };

  const date = new Date().toLocaleDateString();
  const cover = document.createElement("section");
  cover.style.padding = "40px 0 24px 0";
  cover.style.borderBottom = "1px solid #ddd";
  cover.innerHTML = `
    <div style="font-size:64px;line-height:1;color:#111;font-family:'Iowan Old Style',Georgia,serif;">Σ</div>
    <h1 style="margin:16px 0 4px 0;font-size:28px;font-weight:600;color:#111;">Suma Notebook</h1>
    <div style="font-size:12px;color:#666;font-family:ui-monospace,monospace;">
      exported ${date} · ${active.length} problem${active.length === 1 ? "" : "s"}
    </div>
  `;
  container.appendChild(cover);

  active.forEach((p, i) => {
    const sec = document.createElement("section");
    sec.style.padding = "24px 0";
    sec.style.borderBottom = i === active.length - 1 ? "none" : "1px solid #eee";
    sec.style.pageBreakInside = "avoid";

    const head = document.createElement("h2");
    head.style.margin = "0 0 12px 0";
    head.style.fontSize = "20px";
    head.style.fontWeight = "600";
    head.style.color = "#111";
    head.textContent = p.title || "Untitled";
    sec.appendChild(head);

    if (p.mode === "single") {
      if (p.latex.trim()) {
        const eq = document.createElement("div");
        eq.style.margin = "12px 0";
        eq.style.textAlign = "center";
        eq.innerHTML = renderMath(p.latex, true);
        sec.appendChild(eq);
      }
      if (p.notes.trim()) {
        const notes = document.createElement("div");
        notes.style.margin = "12px 0";
        notes.style.whiteSpace = "pre-wrap";
        notes.style.color = "#333";
        notes.textContent = p.notes;
        sec.appendChild(notes);
      }
    } else {
      for (const c of p.cells) {
        if (c.type === "math") {
          const eq = document.createElement("div");
          eq.style.margin = "10px 0";
          eq.style.textAlign = "center";
          eq.innerHTML = renderMath(c.value, true);
          sec.appendChild(eq);
        } else {
          const t = document.createElement("div");
          t.style.margin = "8px 0";
          t.style.whiteSpace = "pre-wrap";
          t.style.color = "#333";
          t.textContent = c.value;
          sec.appendChild(t);
        }
      }
    }

    container.appendChild(sec);
  });

  document.body.appendChild(container);
  try {
    // Small settle for KaTeX fonts.
    await new Promise((r) => setTimeout(r, 100));
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 780,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    const imgH = (canvas.height * contentW) / canvas.width;

    let remaining = imgH;
    let position = margin;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, "JPEG", margin, margin, contentW, imgH);
    } else {
      // Split across pages by shifting Y offset.
      let yOffset = 0;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", margin, position - yOffset, contentW, imgH);
        remaining -= pageH - margin * 2;
        if (remaining > 0) {
          pdf.addPage();
          yOffset += pageH - margin * 2;
          position = margin;
        }
      }
    }

    const date2 = new Date().toISOString().slice(0, 10);
    pdf.save(`suma-notebook-${date2}.pdf`);
  } finally {
    container.remove();
  }
}

let katexCssPromise: Promise<void> | null = null;
function ensureKatexCss(): Promise<void> {
  if (katexCssPromise) return katexCssPromise;
  katexCssPromise = new Promise((resolve) => {
    if (document.querySelector('link[data-katex-pdf]')) return resolve();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    link.setAttribute("data-katex-pdf", "1");
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return katexCssPromise;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
