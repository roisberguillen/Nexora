import { type RefObject } from "react";

import { NavIcon } from "./NavIcon";
import type { NavigationRoute } from "./SidebarNavigation";

const labels: Partial<Record<NavigationRoute, string>> = {
  analytics: "Analisi",
  overview: "Nexora",
  profile: "Profilo",
  transactions: "Movimenti",
};

export function MobileHeader({
  activeRoute,
  onOpenSearch,
  searchTriggerRef,
}: {
  readonly activeRoute: NavigationRoute;
  readonly onOpenSearch: () => void;
  readonly searchTriggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="mobile-header">
      <a aria-label="Apri profilo" className="mobile-header-icon" href="./#profile">
        <NavIcon name="profile" />
      </a>
      <strong>{labels[activeRoute] ?? "Nexora"}</strong>
      <button
        aria-label="Apri ricerca globale"
        className="mobile-header-icon"
        onClick={onOpenSearch}
        ref={searchTriggerRef}
        type="button"
      >
        <span aria-hidden="true">⌕</span>
      </button>
      <a aria-label="Apri notifiche" className="mobile-header-icon" href="./#notifications">
        <NavIcon name="bell" />
      </a>
    </header>
  );
}
