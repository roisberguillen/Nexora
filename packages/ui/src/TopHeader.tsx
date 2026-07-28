import { useState } from "react";

import { filterGlobalSearchResults, type GlobalSearchResult } from "./GlobalSearch";

interface TopHeaderProps {
  readonly isNavigationOpen: boolean;
  readonly isOnline: boolean;
  readonly onToggleNavigation: () => void;
  readonly searchResults: readonly GlobalSearchResult[];
}

export function TopHeader({
  isNavigationOpen,
  isOnline,
  onToggleNavigation,
  searchResults,
}: TopHeaderProps) {
  const [query, setQuery] = useState("");
  const results = filterGlobalSearchResults(searchResults, query).slice(0, 8);
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
          id="global-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Cerca conti, categorie, tag e movimenti"
          type="search"
        />
        {query.trim() === "" ? null : (
          <div aria-live="polite" className="global-search-results" id="global-search-results">
            {results.length === 0 ? (
              <p>Nessun risultato locale.</p>
            ) : (
              <ul>
                {results.map((result) => (
                  <li key={result.id}>
                    <a href={result.href} onClick={() => setQuery("")}>
                      <strong>{result.label}</strong>
                      <small>{result.detail}</small>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite" className={`connectivity ${isOnline ? "is-online" : "is-offline"}`}>
        <span aria-hidden="true" className="status-dot" />
        <span>{isOnline ? "Online" : "Offline"}</span>
      </div>
    </header>
  );
}
