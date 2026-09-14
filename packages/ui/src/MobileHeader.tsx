import { type RefObject } from "react";

import { NavIcon } from "./NavIcon";

export function MobileHeader({
  isNavigationOpen,
  navigationTriggerRef,
  onOpenSearch,
  onToggleNavigation,
  searchTriggerRef,
}: {
  readonly isNavigationOpen: boolean;
  readonly navigationTriggerRef?: RefObject<HTMLButtonElement | null>;
  readonly onOpenSearch: () => void;
  readonly onToggleNavigation: () => void;
  readonly searchTriggerRef?: RefObject<HTMLInputElement | null>;
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
      <label className="mobile-search-field">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Ricerca globale"
          onClick={onOpenSearch}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpenSearch();
          }}
          placeholder="Cerca…"
          readOnly
          ref={searchTriggerRef}
          type="search"
        />
      </label>
      <a aria-label="Apri notifiche" className="mobile-header-icon" href="./#notifications">
        <NavIcon name="bell" />
      </a>
    </header>
  );
}
