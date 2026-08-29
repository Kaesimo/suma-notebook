import { useState } from "react";
import {
  Check,
  Download,
  FileDown,
  HelpCircle,
  Palette,
  PanelLeft,
  Plus,
  Upload,
} from "lucide-react";
import { useWorkspaceContext } from "./workspace-context";
import { AppearanceMenu } from "./AppearanceMenu";
import { HelpSheet } from "./HelpSheet";

export function TopBar({
  onToggleSidebar,
  onShowAll,
  onImportClick,
}: {
  onToggleSidebar: () => void;
  onShowAll: () => void;
  onImportClick: () => void;
}) {
  const ws = useWorkspaceContext();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const iconBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-bg-panel px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle the pages panel"
          title="Toggle the pages panel"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg"
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          onClick={onShowAll}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[13.5px] font-medium tracking-tight text-fg transition-colors hover:bg-bg-hover"
        >
          Suma
        </button>
        {ws.savedAt && (
          <span className="hidden items-center gap-1.5 rounded-md bg-success/10 px-2 py-0.5 text-[11px] text-success md:inline-flex">
            <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
            Saved
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => ws.addProblem()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          New page
        </button>
        <button
          onClick={ws.exportPdf}
          disabled={ws.pdfBusy}
          title="Export this notebook as a PDF (print dialog)"
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1 text-[13px] font-medium text-fg transition-colors hover:bg-bg-hover disabled:opacity-50"
        >
          <FileDown className="h-3.5 w-3.5" strokeWidth={1.75} />
          {ws.pdfBusy ? "Exporting…" : "PDF"}
        </button>
        <button
          onClick={onImportClick}
          className={iconBtn}
          title="Restore from a backup (.suma.json)"
          aria-label="Restore from a backup"
        >
          <Upload className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          onClick={ws.handleExport}
          className={iconBtn}
          title="Back up all pages (.suma.json)"
          aria-label="Back up all pages"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setAppearanceOpen((v) => !v);
              setHelpOpen(false);
            }}
            className={iconBtn}
            title="Appearance"
            aria-label="Appearance"
          >
            <Palette className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <AppearanceMenu open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
        </div>
        <button
          onClick={() => {
            setHelpOpen(true);
            setAppearanceOpen(false);
          }}
          className={iconBtn}
          title="How it works"
          aria-label="How it works"
        >
          <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </header>
  );
}
