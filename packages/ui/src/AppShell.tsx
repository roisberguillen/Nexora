import { type PropsWithChildren, useEffect, useState } from "react";

import { SidebarNavigation, type NavigationRoute } from "./SidebarNavigation";
import type { GlobalSearchResult } from "./GlobalSearch";
import { TopHeader } from "./TopHeader";

interface AppShellProps extends PropsWithChildren {
  readonly activeRoute?: NavigationRoute;
  readonly searchResults?: readonly GlobalSearchResult[];
}

export function AppShell({
  activeRoute = "overview",
  children,
  searchResults = [],
}: AppShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
        <TopHeader
          isNavigationOpen={isNavigationOpen}
          isOnline={isOnline}
          onToggleNavigation={() => {
            setIsNavigationOpen((isOpen) => !isOpen);
          }}
          searchResults={searchResults}
        />
        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
