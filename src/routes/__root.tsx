import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center font-mono">
        <div className="text-xs uppercase tracking-widest text-fg-subtle">
          error · 404
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-fg">Route not found</h1>
        <p className="mt-2 text-sm text-fg-muted">
          No lesson, page, or resource resolves at this path.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-sm border border-border-strong bg-bg-elevated px-3 py-1.5 text-sm text-fg transition-colors hover:bg-bg-hover"
        >
          ← Return home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md font-mono">
        <div className="text-xs uppercase tracking-widest text-danger">
          runtime error
        </div>
        <h1 className="mt-3 text-xl font-semibold text-fg">
          This view failed to render.
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            Retry
          </button>
          <a
            href="/"
            className="rounded-sm border border-border-strong bg-bg-elevated px-3 py-1.5 text-sm text-fg transition-colors hover:bg-bg-hover"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#1a1b26" },
      { title: "Suma Notebook" },
      {
        name: "description",
        content:
          "A calm, keyboard-first notebook for writing math homework.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Suma Notebook" },
      {
        property: "og:description",
        content:
          "A calm, keyboard-first notebook for writing math homework.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "sum.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="tokyo-night">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
