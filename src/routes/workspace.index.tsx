import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";

export const Route = createFileRoute("/workspace/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Suma Notebook" },
      {
        name: "description",
        content:
          "A notebook for writing and solving math: live equations, evaluation, notes, and PDF export.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Suma Notebook" },
      {
        property: "og:description",
        content:
          "A notebook for writing and solving math: live equations, evaluation, notes, and PDF export.",
      },
    ],
  }),
  component: AppShell,
});
