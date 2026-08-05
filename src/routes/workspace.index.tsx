import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceIDE } from "@/components/workspace/WorkspaceIDE";

export const Route = createFileRoute("/workspace/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Suma Notebook" },
      {
        name: "description",
        content:
          "Write, evaluate, and organize math problems with live LaTeX and notes.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Suma Notebook" },
      {
        property: "og:description",
        content:
          "Write, evaluate, and organize math problems with live LaTeX and notes.",
      },
    ],
  }),
  component: WorkspaceIDE,
});
