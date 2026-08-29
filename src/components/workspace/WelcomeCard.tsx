import { useState } from "react";
import { X } from "lucide-react";

export function WelcomeCard() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem("mat:welcome-dismissed") !== "1",
  );

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-md border border-accent/25 bg-accent/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] leading-relaxed text-fg-muted">
          Press <span className="font-medium text-fg">Ctrl/Cmd + M</span> on an empty line to start
          writing math.
        </p>
        <button
          onClick={() => {
            localStorage.setItem("mat:welcome-dismissed", "1");
            setVisible(false);
          }}
          aria-label="Dismiss welcome message"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
