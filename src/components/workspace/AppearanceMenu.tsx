import { Check } from "lucide-react";
import { ACCENT_OPTIONS, DEFAULT_APPEARANCE, FONT_OPTIONS } from "@/hooks/use-workspace";
import { useWorkspaceContext } from "./workspace-context";

export function AppearanceMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useWorkspaceContext();

  return (
    <>
      {open && <div className="fixed inset-0 z-20" onClick={onClose} />}
      <div
        className={
          "absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-bg-elevated p-3 shadow-lg " +
          (open ? "" : "hidden")
        }
      >
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          Reading font
        </div>
        <div className="mt-1.5 flex flex-col">
          {FONT_OPTIONS.map((f) => {
            const active = ws.appearance.font === f.id;
            return (
              <button
                key={f.id}
                onClick={() => ws.setAppearance((a) => ({ ...a, font: f.id }))}
                className={
                  "flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors " +
                  (active ? "bg-bg-hover text-fg" : "text-fg-muted hover:text-fg")
                }
                style={{ fontFamily: f.stack }}
              >
                <span>{f.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 px-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          Accent color
        </div>
        <div className="mt-1.5 flex gap-2.5 px-1">
          {ACCENT_OPTIONS.map((a) => {
            const active = ws.appearance.accent === a.id;
            return (
              <button
                key={a.id}
                onClick={() => ws.setAppearance((prev) => ({ ...prev, accent: a.id }))}
                title={a.label}
                aria-label={a.label}
                className={
                  "h-7 w-7 rounded-full border-2 transition-transform " +
                  (active ? "scale-110 border-accent" : "border-transparent hover:scale-105")
                }
                style={{
                  background: a.value,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
                }}
              />
            );
          })}
        </div>

        <div className="mt-4 border-t border-border pt-2">
          <button
            onClick={() => ws.setAppearance(DEFAULT_APPEARANCE)}
            className="w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  );
}
