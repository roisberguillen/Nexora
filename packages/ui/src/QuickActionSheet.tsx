import { useEffect, useRef } from "react";

import { NavIcon, type NavIconName } from "./NavIcon";

export interface QuickAction {
  readonly description?: string;
  readonly icon: NavIconName;
  readonly label: string;
  readonly onSelect: () => void;
}

export function QuickActionSheet({
  actions,
  onClose,
}: {
  readonly actions: readonly QuickAction[];
  readonly onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || dialogRef.current === null) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);
  return (
    <div className="quick-action-overlay" onMouseDown={onClose} role="presentation">
      <section
        aria-labelledby="quick-action-title"
        aria-modal="true"
        className="quick-action-sheet"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <span aria-hidden="true" className="quick-action-handle" />
        <h2 id="quick-action-title">Nuova operazione</h2>
        <div className="quick-action-list">
          {actions.map((action, index) => (
            <button
              className={`quick-action-item${index === 0 ? " is-primary" : ""}`}
              key={action.label}
              onClick={() => {
                action.onSelect();
                onClose();
              }}
              type="button"
            >
              <span className="quick-action-icon">
                <NavIcon name={action.icon} />
              </span>
              <span>
                <strong>{action.label}</strong>
                {action.description === undefined ? null : <small>{action.description}</small>}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
