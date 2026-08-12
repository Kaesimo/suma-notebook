import { useState } from "react";
import { X } from "lucide-react";

/**
 * Dismissible onboarding hint shown while a page is still empty. Explains the
 * two moves a newcomer needs: entering math zones, and Solve.
 */
export function WelcomeCard() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem("mat:welcome-dismissed") !== "1",
  );

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-md border border-accent/25 bg-accent/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-fg">Welcome to Suma</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-fg-muted">
            Write prose normally. To write an equation, focus an empty line and click the{" "}
            <span className="font-medium text-fg">Math</span> button that appears — or press{" "}
            <span className="font-medium text-fg">Ctrl/Cmd + M</span>. The line turns into math.
            Press <span className="font-medium text-fg">Enter</span> to return to prose, or{" "}
            <span className="font-medium text-fg">Ctrl/Cmd + M</span> to convert the line under your
            cursor. Click inside an equation and press{" "}
            <span className="font-medium text-fg">Solve</span> when it appears.
          </p>
        </div>
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
