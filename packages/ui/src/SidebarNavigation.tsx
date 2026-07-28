import { NavIcon, type NavIconName } from "./NavIcon";

interface NavigationItem {
  readonly label: string;
  readonly icon: NavIconName;
  readonly available: boolean;
  readonly route: NavigationRoute;
}

export type NavigationRoute =
  | "overview"
  | "accounts"
  | "transactions"
  | "categories"
  | "tags"
  | "imports"
  | "budgets"
  | "loans"
  | "investments"
  | "recurring"
  | "exports";

const navigationItems: readonly NavigationItem[] = [
  { label: "Panoramica", icon: "overview", available: true, route: "overview" },
  { label: "Conti", icon: "accounts", available: true, route: "accounts" },
  { label: "Movimenti", icon: "transactions", available: true, route: "transactions" },
  { label: "Categorie", icon: "transactions", available: true, route: "categories" },
  { label: "Tag", icon: "transactions", available: true, route: "tags" },
  { label: "Importa", icon: "transactions", available: true, route: "imports" },
  { label: "Budget", icon: "budget", available: true, route: "budgets" },
  { label: "Prestiti", icon: "accounts", available: true, route: "loans" },
  { label: "Investimenti", icon: "accounts", available: true, route: "investments" },
  { label: "Ricorrenze", icon: "recurring", available: true, route: "recurring" },
  { label: "Esporta", icon: "transactions", available: true, route: "exports" },
  { label: "Impostazioni", icon: "settings", available: false, route: "overview" },
];

interface SidebarNavigationProps {
  readonly activeRoute: NavigationRoute;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function SidebarNavigation({ activeRoute, isOpen, onClose }: SidebarNavigationProps) {
  return (
    <aside
      aria-label="Pannello di navigazione"
      className={`app-sidebar${isOpen ? " is-open" : ""}`}
      id="primary-navigation"
    >
      <div className="sidebar-brand-row">
        <a className="brand" href="./#overview" onClick={onClose}>
          <span aria-hidden="true" className="brand-mark">
            N
          </span>
          <span>
            <strong>Nexora</strong>
            <small>Finanza personale</small>
          </span>
        </a>
        <button className="icon-button sidebar-close" onClick={onClose} type="button">
          <span aria-hidden="true">×</span>
          <span className="sr-only">Chiudi navigazione</span>
        </button>
      </div>

      <nav aria-label="Navigazione principale">
        <ul className="navigation-list">
          {navigationItems.map((item) => (
            <li key={item.label}>
              {item.available ? (
                <a
                  aria-current={item.route === activeRoute ? "page" : undefined}
                  className={`navigation-item${item.route === activeRoute ? " is-active" : ""}`}
                  href={`./#${item.route}`}
                  onClick={onClose}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="navigation-item is-disabled"
                  title="Disponibile in una milestone successiva"
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-status">
        <span aria-hidden="true" className="status-dot" />
        <span>
          <strong>Dati locali</strong>
          <small>Nessuna sincronizzazione attiva</small>
        </span>
      </div>
    </aside>
  );
}
