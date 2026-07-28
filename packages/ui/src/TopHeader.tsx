interface TopHeaderProps {
  readonly isNavigationOpen: boolean;
  readonly isOnline: boolean;
  readonly onToggleNavigation: () => void;
}

export function TopHeader({ isNavigationOpen, isOnline, onToggleNavigation }: TopHeaderProps) {
  return (
    <header className="top-header">
      <button
        aria-controls="primary-navigation"
        aria-expanded={isNavigationOpen}
        className="icon-button menu-trigger"
        onClick={onToggleNavigation}
        type="button"
      >
        <span aria-hidden="true" className="menu-lines">
          <span />
          <span />
          <span />
        </span>
        <span className="sr-only">
          {isNavigationOpen ? "Chiudi navigazione" : "Apri navigazione"}
        </span>
      </button>

      <div className="global-search">
        <label className="sr-only" htmlFor="global-search">
          Ricerca globale
        </label>
        <span aria-hidden="true" className="search-symbol">
          ⌕
        </span>
        <input
          aria-describedby="search-availability"
          disabled
          id="global-search"
          placeholder="Ricerca disponibile dalla Milestone 3"
          type="search"
        />
        <span className="sr-only" id="search-availability">
          La ricerca globale non è ancora disponibile.
        </span>
      </div>

      <div aria-live="polite" className={`connectivity ${isOnline ? "is-online" : "is-offline"}`}>
        <span aria-hidden="true" className="status-dot" />
        <span>{isOnline ? "Online" : "Offline"}</span>
      </div>
    </header>
  );
}
