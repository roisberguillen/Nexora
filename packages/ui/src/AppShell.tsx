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
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const quickActionTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavigationOpen(false);
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
        isOpen={isNavigationOpen}
        onClose={closeNavigation}
      />
      <button
        aria-label="Chiudi navigazione"
        className={`sidebar-backdrop${isNavigationOpen ? " is-visible" : ""}`}
        onClick={closeNavigation}
        tabIndex={isNavigationOpen ? 0 : -1}
        type="button"
      />
      <div className="app-workspace">
        <OfflineBanner />
        <MobileHeader activeRoute={activeRoute} />
        <TopHeader
          isNavigationOpen={isNavigationOpen}
          onToggleNavigation={() => {
            setIsNavigationOpen((isOpen) => !isOpen);
          }}
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
