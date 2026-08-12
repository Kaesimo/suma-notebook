import { createContext, useContext } from "react";
import type { Workspace } from "@/hooks/use-workspace";

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspaceContext(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used inside WorkspaceProvider");
  return ctx;
}
