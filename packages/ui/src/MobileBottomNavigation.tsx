import type { RefObject } from "react";

import { NavIcon } from "./NavIcon";
import type { NavigationRoute } from "./SidebarNavigation";

const mobileItems: readonly {
  readonly icon: "overview" | "transactions" | "accounts" | "budget" | "profile";
  readonly label: string;
  readonly route: NavigationRoute;
}[] = [
  { icon: "overview", label: "Home", route: "overview" },
  { icon: "transactions", label: "Movimenti", route: "transactions" },
  { icon: "accounts", label: "Conti", route: "accounts" },
  { icon: "budget", label: "Analisi", route: "analytics" },
  { icon: "profile", label: "Profilo", route: "profile" },
];

export function MobileBottomNavigation({
  activeRoute,
  onQuickAction,
  quickActionRef,
}: {
  readonly activeRoute: NavigationRoute;
  readonly onQuickAction: () => void;
  readonly quickActionRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <nav aria-label="Navigazione mobile" className="mobile-bottom-navigation">
      {mobileItems.slice(0, 2).map((item) => (
        <a
          aria-current={activeRoute === item.route ? "page" : undefined}
          className={`mobile-nav-item${activeRoute === item.route ? " is-active" : ""}`}
          href={`./#${item.route}`}
          key={item.route}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
      <button
        aria-label="Nuova operazione"
        className="mobile-quick-action"
        onClick={onQuickAction}
        ref={quickActionRef}
        type="button"
      >
        <NavIcon name="plus" />
      </button>
      {mobileItems.slice(2).map((item) => (
        <a
          aria-current={activeRoute === item.route ? "page" : undefined}
          className={`mobile-nav-item${activeRoute === item.route ? " is-active" : ""}`}
          href={`./#${item.route}`}
          key={item.route}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
