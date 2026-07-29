import { NavIcon } from "./NavIcon";
import type { NavigationRoute } from "./SidebarNavigation";

const labels: Partial<Record<NavigationRoute, string>> = {
  analytics: "Analisi",
  overview: "Nexora",
  profile: "Profilo",
  transactions: "Movimenti",
};

export function MobileHeader({ activeRoute }: { readonly activeRoute: NavigationRoute }) {
  return (
    <header className="mobile-header">
      <a aria-label="Apri profilo" className="mobile-header-icon" href="./#profile">
        <NavIcon name="profile" />
      </a>
      <strong>{labels[activeRoute] ?? "Nexora"}</strong>
      <a aria-label="Apri notifiche" className="mobile-header-icon" href="./#notifications">
        <NavIcon name="bell" />
      </a>
    </header>
  );
}
