import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { filterGlobalSearchResults, type GlobalSearchResult } from "./GlobalSearch";

interface GlobalSearchDialogProps {
  readonly onClose: () => void;
  readonly results: readonly GlobalSearchResult[];
}

export function GlobalSearchDialog({ onClose, results: allResults }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const results = filterGlobalSearchResults(allResults, query).slice(0, 8);

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        closeRef.current,
        inputRef.current,
        ...(query.trim() === "" ? [] : [document.getElementById("mobile-global-search-clear")]),
        ...resultRefs.current.slice(0, results.length),
      ].filter((element): element is HTMLElement => element !== null);
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
  }, [onClose, query, results.length]);

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
    }
  };

  return (
    <div className="global-search-dialog-backdrop" role="presentation">
      <section
        aria-labelledby="mobile-global-search-title"
        aria-modal="true"
        className="global-search-dialog"
        role="dialog"
      >
        <div className="global-search-dialog__header">
          <h1 id="mobile-global-search-title">Ricerca globale</h1>
          <button
            aria-label="Chiudi ricerca globale"
            className="icon-button"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <label className="sr-only" htmlFor="mobile-global-search">
          Ricerca globale
        </label>
        <div className="global-search-dialog__field">
          <span aria-hidden="true" className="search-symbol">
            ⌕
          </span>
          <input
            aria-activedescendant={
              activeIndex >= 0 ? `mobile-global-search-result-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls="mobile-global-search-results"
            aria-expanded={query.trim() !== ""}
            id="mobile-global-search"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Cerca conti, categorie, tag e movimenti"
            ref={inputRef}
            type="search"
            value={query}
          />
          {query.trim() === "" ? null : (
            <button
              aria-label="Cancella ricerca"
              className="global-search-clear"
              id="mobile-global-search-clear"
              onClick={() => {
                setQuery("");
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              type="button"
            >
              ×
            </button>
          )}
        </div>
        <div
          aria-live="polite"
          className="global-search-dialog__results"
          id="mobile-global-search-results"
        >
          {query.trim() === "" ? (
            <p>Digita per cercare nei dati locali.</p>
          ) : results.length === 0 ? (
            <p role="status">Nessun risultato locale.</p>
          ) : (
            <ul aria-label="Risultati ricerca" role="listbox">
              {results.map((result, index) => (
                <li key={result.id}>
                  <a
                    aria-selected={index === activeIndex}
                    id={`mobile-global-search-result-${index}`}
                    onClick={onClose}
                    ref={(element) => {
                      resultRefs.current[index] = element;
                    }}
                    role="option"
                    href={result.href}
                  >
                    <strong>{result.label}</strong>
                    <small>{result.detail}</small>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
