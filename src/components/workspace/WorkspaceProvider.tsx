import type { ReactNode } from "react";
import type { Workspace } from "@/hooks/use-workspace";
import { WorkspaceContext } from "./workspace-context";

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
