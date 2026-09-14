import { type RefObject } from "react";

import { NavIcon } from "./NavIcon";
import type { NavigationRoute } from "./SidebarNavigation";

const labels: Partial<Record<NavigationRoute, string>> = {
  analytics: "Analisi",
  overview: "Panoramica",
  accounts: "Conti",
  backup: "Backup",
  budgets: "Budget",
  categories: "Categorie",
  exports: "Esporta",
  imports: "Importa",
  investments: "Investimenti",
  journal: "Diario finanziario",
  loans: "Prestiti",
  notifications: "Notifiche",
  "privacy-security": "Privacy e sicurezza",
  profile: "Profilo",
  recurring: "Ricorrenze e allocazioni",
  settings: "Impostazioni e cestino",
  tags: "Tag",
  transactions: "Movimenti",
};

export function MobileHeader({
  activeRoute,
  isNavigationOpen,
  navigationTriggerRef,
  onOpenSearch,
  onToggleNavigation,
  searchTriggerRef,
}: {
  readonly activeRoute: NavigationRoute;
  readonly isNavigationOpen: boolean;
  readonly navigationTriggerRef?: RefObject<HTMLButtonElement | null>;
  readonly onOpenSearch: () => void;
  readonly onToggleNavigation: () => void;
  readonly searchTriggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="mobile-header">
      <button
        aria-controls="primary-navigation"
        aria-expanded={isNavigationOpen}
        aria-label={isNavigationOpen ? "Chiudi menu completo" : "Apri menu completo"}
        className="mobile-header-icon mobile-navigation-trigger"
        onClick={onToggleNavigation}
        ref={navigationTriggerRef}
        type="button"
      >
        <span aria-hidden="true" className="menu-lines">
          <span />
          <span />
          <span />
        </span>
      </button>
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
