import { NavIcon } from "./NavIcon";
import type { NavigationRoute } from "./SidebarNavigation";

const mobileItems: readonly {
  readonly icon: "overview" | "transactions" | "accounts" | "budget" | "profile";
  readonly label: string;
  readonly route: NavigationRoute;
}[] = [
  { icon: "overview", label: "Panoramica", route: "overview" },
  { icon: "transactions", label: "Movimenti", route: "transactions" },
  { icon: "accounts", label: "Conti", route: "accounts" },
  { icon: "overview", label: "Analisi", route: "analytics" },
  { icon: "profile", label: "Profilo", route: "profile" },
];

export function MobileBottomNavigation({ activeRoute }: { readonly activeRoute: NavigationRoute }) {
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
