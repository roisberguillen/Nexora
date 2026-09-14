import { useEffect, useRef } from "react";

import { NavIcon } from "./NavIcon";
import { navigationGroups, type NavigationRoute } from "./SidebarNavigation";

export function MobileNavigationSheet({
  activeRoute,
  onClose,
}: {
  readonly activeRoute: NavigationRoute;
  readonly onClose: () => void;
}) {
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || sheetRef.current === null) return;
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>("button, a[href]")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="mobile-navigation-overlay" onMouseDown={onClose} role="presentation">
      <section
        aria-labelledby="mobile-navigation-title"
        aria-modal="true"
        className="mobile-navigation-sheet"
        onMouseDown={(event) => event.stopPropagation()}
        ref={sheetRef}
        role="dialog"
      >
        <div className="mobile-navigation-header">
          <div>
            <span className="mobile-navigation-eyebrow">Nexora</span>
            <h2 id="mobile-navigation-title">Menu</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
            <span className="sr-only">Chiudi menu</span>
          </button>
        </div>
        <nav aria-label="Sezioni dell’app" className="mobile-navigation-groups">
          {navigationGroups.map((group) => (
            <section className="mobile-navigation-group" key={group.label}>
              <h3>{group.label}</h3>
              <div className="mobile-navigation-links">
                {group.items.map((item) => {
                  const isActive =
                    item.route === activeRoute ||
                    (item.route === "transactions" && activeRoute === "new-transaction");
                  return (
                    <a
                      aria-current={isActive ? "page" : undefined}
                      className={`mobile-navigation-link${isActive ? " is-active" : ""}`}
                      href={`./#${item.route}`}
                      key={item.route}
                      onClick={onClose}
                    >
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </section>
    </div>
  );
}
