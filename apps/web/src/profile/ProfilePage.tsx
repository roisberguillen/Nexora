import { NavIcon } from "@nexora/ui";

const groups = [
  {
    title: "Gestione finanziaria",
    rows: [
      ["Conti", "accounts", "./#accounts"],
      ["Categorie", "transactions", "./#categories"],
      ["Tag", "transactions", "./#tags"],
      ["Budget", "budget", "./#budgets"],
      ["Ricorrenze", "recurring", "./#recurring"],
    ],
  },
  {
    title: "Dati e documenti",
    rows: [
      ["Importa", "transactions", "./#imports"],
      ["Esporta", "transactions", "./#exports"],
      ["Backup", "settings", "./#backup"],
    ],
  },
] as const;

export function ProfilePage() {
  return (
    <div id="profile">
      <header className="profile-hero">
        <span aria-hidden="true" className="profile-avatar">
          <NavIcon name="profile" />
        </span>
        <div>
          <p className="eyebrow">Profilo locale</p>
          <h1>Nexora</h1>
        </div>
      </header>
      <div className="profile-groups">
        {groups.map((group) => (
          <section className="data-panel profile-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.rows.map(([label, icon, href]) => (
              <a className="profile-row" href={href} key={label}>
                <NavIcon name={icon} />
                <span>{label}</span>
                <small aria-hidden="true">›</small>
              </a>
            ))}
          </section>
        ))}
        <section className="data-panel profile-group">
          <h2>Applicazione</h2>
          <a className="profile-row" href="./#settings">
            <NavIcon name="settings" />
            <span>Impostazioni</span>
            <small aria-hidden="true">›</small>
          </a>
        </section>
      </div>
    </div>
  );
}
