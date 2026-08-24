import { type KeyboardEvent, type RefObject, useRef, useState } from "react";

import { filterGlobalSearchResults, type GlobalSearchResult } from "./GlobalSearch";

interface TopHeaderProps {
  readonly isNavigationOpen: boolean;
  readonly navigationTriggerRef?: RefObject<HTMLButtonElement | null>;
  readonly onToggleNavigation: () => void;
  readonly searchResults: readonly GlobalSearchResult[];
}

export function TopHeader({
  isNavigationOpen,
  navigationTriggerRef,
  onToggleNavigation,
  searchResults,
}: TopHeaderProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const results = filterGlobalSearchResults(searchResults, query).slice(0, 8);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
    } else if (event.key === "Escape") {
      setQuery("");
      setActiveIndex(-1);
    }
  };
  return (
    <header className="top-header">
      <button
        aria-controls="primary-navigation"
        aria-expanded={isNavigationOpen}
        className="icon-button menu-trigger"
        onClick={onToggleNavigation}
        ref={navigationTriggerRef}
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
          aria-activedescendant={
            activeIndex >= 0 ? `global-search-result-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-expanded={query.trim() !== ""}
          id="global-search"
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Cerca conti, categorie, tag e movimenti"
          value={query}
          type="search"
          role="combobox"
        />
        {query.trim() === "" ? null : (
          <button
            aria-label="Cancella ricerca"
            className="global-search-clear"
            onClick={() => {
              setQuery("");
              setActiveIndex(-1);
            }}
            type="button"
          >
            ×
          </button>
        )}
        {query.trim() === "" ? null : (
          <div aria-live="polite" className="global-search-results" id="global-search-results">
            {results.length === 0 ? (
              <p role="status">Nessun risultato locale.</p>
            ) : (
              <ul aria-label="Risultati ricerca" role="listbox">
                {results.map((result, index) => (
                  <li key={result.id}>
                    <a
                      aria-selected={index === activeIndex}
                      href={result.href}
                      id={`global-search-result-${index}`}
                      onClick={() => setQuery("")}
                      ref={(element) => {
                        resultRefs.current[index] = element;
                      }}
                      role="option"
                    >
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
    </header>
  );
}
