import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { TopBar } from "./TopBar";
import { PageSidebar } from "./PageSidebar";
import { HomeGrid } from "./HomeGrid";
import { DocumentSheet } from "./DocumentSheet";
import { ImportDialog } from "./ImportDialog";

function WorkspaceInner() {
  const ws = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Selecting or creating a page always returns to the document view.
  useEffect(() => {
    setShowAll(false);
  }, [ws.selectedId]);

  // Opening a page explicitly leaves the "All pages" grid, even when the page
  // is already the selected one (selectedId wouldn't change in that case).
  const openPage = (id: string) => {
    ws.setSelectedId(id);
    setShowAll(false);
  };

  const triggerImport = () => fileInputRef.current?.click();

  return (
    <WorkspaceProvider value={ws}>
      <div className="flex h-screen flex-col">
        <TopBar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onShowAll={() => setShowAll(true)}
          onImportClick={triggerImport}
        />

        <div className="flex min-h-0 flex-1">
          <PageSidebar
            open={sidebarOpen}
            onShowAll={() => setShowAll(true)}
            showAll={showAll}
            onOpenPage={openPage}
          />
          <main className="min-h-0 flex-1 overflow-y-auto bg-bg">
            {showAll ? <HomeGrid onOpenPage={openPage} /> : <DocumentSheet />}
          </main>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.matws.json,application/json"
          className="hidden"
          onChange={ws.onImportFile}
        />

        <ImportDialog />

        {ws.importError && (
          <div className="fixed right-4 top-16 z-40 flex items-center gap-2 rounded-lg border border-danger/40 bg-bg-elevated px-3 py-2 text-[13px] text-danger shadow-lg">
            <span>{ws.importError}</span>
            <button
              onClick={() => ws.setImportError(null)}
              aria-label="Dismiss"
              className="text-fg-subtle transition-colors hover:text-fg"
            >
              ×
            </button>
          </div>
        )}
        {ws.pdfError && (
          <div className="fixed right-4 top-24 z-40 flex items-center gap-2 rounded-lg border border-danger/40 bg-bg-elevated px-3 py-2 text-[13px] text-danger shadow-lg">
            <span>{ws.pdfError}</span>
            <button
              onClick={() => ws.setPdfError(null)}
              aria-label="Dismiss"
              className="text-fg-subtle transition-colors hover:text-fg"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </WorkspaceProvider>
  );
}

export function AppShell() {
  return <WorkspaceInner />;
}
