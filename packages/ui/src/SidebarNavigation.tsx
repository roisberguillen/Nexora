import { type RefObject } from "react";

import { NavIcon, type NavIconName } from "./NavIcon";

interface NavigationItem {
  readonly label: string;
  readonly icon: NavIconName;
  readonly route: NavigationRoute;
}

interface NavigationGroup {
  readonly items: readonly NavigationItem[];
  readonly label: string;
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
  | "exports"
  | "backup"
  | "journal"
  | "analytics"
  | "profile"
  | "settings"
  | "notifications"
  | "privacy-security"
  | "new-transaction";

const navigationGroups: readonly NavigationGroup[] = [
  {
    label: "Principale",
    items: [
      { label: "Panoramica", icon: "overview", route: "overview" },
      { label: "Movimenti", icon: "transactions", route: "transactions" },
      { label: "Conti", icon: "accounts", route: "accounts" },
    ],
  },
  {
    label: "Pianificazione",
    items: [
      { label: "Budget", icon: "budget", route: "budgets" },
      { label: "Ricorrenze e allocazioni", icon: "recurring", route: "recurring" },
      { label: "Prestiti", icon: "accounts", route: "loans" },
    ],
  },
  {
    label: "Patrimonio",
    items: [{ label: "Investimenti", icon: "accounts", route: "investments" }],
  },
  {
    label: "Approfondimenti",
    items: [
      { label: "Analisi", icon: "overview", route: "analytics" },
      { label: "Diario finanziario", icon: "budget", route: "journal" },
    ],
  },
  {
    label: "Organizzazione",
    items: [
      { label: "Categorie", icon: "transactions", route: "categories" },
      { label: "Tag", icon: "transactions", route: "tags" },
    ],
  },
  {
    label: "Dati",
    items: [
      { label: "Importa", icon: "transactions", route: "imports" },
      { label: "Esporta", icon: "transactions", route: "exports" },
      { label: "Backup", icon: "settings", route: "backup" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Notifiche", icon: "bell", route: "notifications" },
      { label: "Impostazioni e cestino", icon: "settings", route: "settings" },
      { label: "Profilo", icon: "profile", route: "profile" },
      { label: "Privacy e sicurezza", icon: "settings", route: "privacy-security" },
    ],
  },
];

interface SidebarNavigationProps {
  readonly activeRoute: NavigationRoute;
  readonly isCollapsed: boolean;
  readonly isOpen: boolean;
  readonly navigationRef?: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly onToggleCollapsed: () => void;
}

export function SidebarNavigation({
  activeRoute,
  isCollapsed,
  isOpen,
  navigationRef,
  onClose,
  onToggleCollapsed,
}: SidebarNavigationProps) {
  return (
    <aside
      aria-label="Pannello di navigazione"
      className={`app-sidebar${isOpen ? " is-open" : ""}${isCollapsed ? " is-collapsed" : ""}`}
      id="primary-navigation"
      ref={navigationRef}
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
        <button
          aria-label={isCollapsed ? "Espandi menu" : "Riduci menu"}
          aria-pressed={isCollapsed}
          className="icon-button sidebar-collapse"
          onClick={onToggleCollapsed}
          type="button"
        >
          <span aria-hidden="true">{isCollapsed ? "›" : "‹"}</span>
        </button>
      </div>

      <nav aria-label="Navigazione principale">
        {navigationGroups.map((group) => (
          <section className="navigation-group" key={group.label}>
            <h2>{group.label}</h2>
            <ul className="navigation-list">
              {group.items.map((item) => {
                const isActive =
                  item.route === activeRoute ||
                  (item.route === "transactions" && activeRoute === "new-transaction");
                return (
                  <li key={item.route}>
                    <a
                      aria-current={isActive ? "page" : undefined}
                      className={`navigation-item${isActive ? " is-active" : ""}`}
                      href={`./#${item.route}`}
                      onClick={onClose}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
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
