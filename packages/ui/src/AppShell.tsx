import { type PropsWithChildren, useEffect, useRef, useState } from "react";

import { SidebarNavigation, type NavigationRoute } from "./SidebarNavigation";
import type { GlobalSearchResult } from "./GlobalSearch";
import { TopHeader } from "./TopHeader";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { MobileHeader } from "./MobileHeader";
import { QuickActionSheet, type QuickAction } from "./QuickActionSheet";
import { OfflineBanner } from "./OfflineBanner";

interface AppShellProps extends PropsWithChildren {
  readonly activeRoute?: NavigationRoute;
  readonly quickActions?: readonly QuickAction[];
  readonly searchResults?: readonly GlobalSearchResult[];
}

export function AppShell({
  activeRoute = "overview",
  children,
  quickActions = [],
  searchResults = [],
}: AppShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const quickActionTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    requestAnimationFrame(() => {
      navigationRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavigationOpen(false);
        requestAnimationFrame(() => navigationTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || navigationRef.current === null) {
        return;
      }
      const focusable = [...navigationRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
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
  }, [isNavigationOpen]);

  const closeNavigation = () => {
    setIsNavigationOpen(false);
    requestAnimationFrame(() => navigationTriggerRef.current?.focus());
  };
  const closeQuickActions = () => {
    setIsQuickActionsOpen(false);
    requestAnimationFrame(() => quickActionTriggerRef.current?.focus());
  };

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Vai al contenuto
      </a>
      <SidebarNavigation
        activeRoute={activeRoute}
        isCollapsed={isNavigationCollapsed}
        isOpen={isNavigationOpen}
        navigationRef={navigationRef}
        onClose={closeNavigation}
        onToggleCollapsed={() => setIsNavigationCollapsed((isCollapsed) => !isCollapsed)}
      />
      <button
        aria-label="Chiudi navigazione"
        className={`sidebar-backdrop${isNavigationOpen ? " is-visible" : ""}`}
        onClick={closeNavigation}
        tabIndex={isNavigationOpen ? 0 : -1}
        type="button"
      />
      <div className={`app-workspace${isNavigationCollapsed ? " is-sidebar-collapsed" : ""}`}>
        <OfflineBanner />
        <MobileHeader activeRoute={activeRoute} />
        <TopHeader
          isNavigationOpen={isNavigationOpen}
          onToggleNavigation={() => {
            setIsNavigationOpen((isOpen) => !isOpen);
          }}
          navigationTriggerRef={navigationTriggerRef}
          searchResults={searchResults}
        />
        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
        <MobileBottomNavigation
          activeRoute={activeRoute}
          onQuickAction={() => setIsQuickActionsOpen(true)}
          quickActionRef={quickActionTriggerRef}
        />
      </div>
      {isQuickActionsOpen ? (
        <QuickActionSheet actions={quickActions} onClose={closeQuickActions} />
      ) : null}
    </div>
  );
}
