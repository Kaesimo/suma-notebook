import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { TopBar } from "./TopBar";
import { PageSidebar } from "./PageSidebar";
import { HomeGrid } from "./HomeGrid";
import { DocumentSheet } from "./DocumentSheet";
import { ImportDialog } from "./ImportDialog";

function ErrorToast({
  message,
  top,
  onDismiss,
}: {
  message: string;
  top: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`fixed right-4 z-40 flex items-center gap-2 rounded-lg border border-danger/40 bg-bg-elevated px-3 py-2 text-[13px] text-danger shadow-lg`}
      style={{ top }}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-fg-subtle transition-colors hover:text-fg"
      >
        ×
      </button>
    </div>
  );
}

function WorkspaceInner() {
  const ws = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setShowAll(false);
  }, [ws.selectedId]);

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
          <ErrorToast
            message={ws.importError}
            top="4rem"
            onDismiss={() => ws.setImportError(null)}
          />
        )}
        {ws.pdfError && (
          <ErrorToast message={ws.pdfError} top="6rem" onDismiss={() => ws.setPdfError(null)} />
        )}
      </div>
    </WorkspaceProvider>
  );
}

export function AppShell() {
  return <WorkspaceInner />;
}
