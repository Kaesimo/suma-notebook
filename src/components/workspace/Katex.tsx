import { useEffect, useRef } from "react";

export function Katex({
  tex,
  display = false,
  className,
}: {
  tex: string;
  display?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("katex").then(({ default: katex }) => {
      if (cancelled || !ref.current) return;
      try {
        katex.render(tex || "", ref.current, {
          throwOnError: false,
          displayMode: display,
        });
      } catch {
        /* leave empty on render failure */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tex, display]);

  return <span ref={ref} className={className} />;
}
