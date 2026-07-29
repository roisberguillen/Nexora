export type NavIconName =
  | "overview"
  | "accounts"
  | "transactions"
  | "budget"
  | "recurring"
  | "settings"
  | "profile"
  | "bell"
  | "plus";

const iconPaths: Record<NavIconName, readonly string[]> = {
  overview: ["M4 4h6v6H4z", "M14 4h6v10h-6z", "M4 14h6v6H4z", "M14 18h6v2h-6z"],
  accounts: ["M3 7.5 12 3l9 4.5", "M5 9v9", "M9.5 9v9", "M14.5 9v9", "M19 9v9", "M3 21h18"],
  transactions: ["M4 7h14", "m15 4 3-4-3-4", "M20 17H6", "m9-4-3 4 3 4"],
  budget: [
    "M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5z",
    "M4 8h15",
    "M14 12h3v4h-3z",
  ],
  recurring: ["M18.5 8A7 7 0 1 0 19 15", "m18 4 .5 4-4-.5", "M12 8v4l2.5 1.5"],
  settings: [
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
    "M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8L10.5 2h-3l-.7 2-1.9.8L3 3.9.9 6l.9 1.9L1 9.8l-2 .7v3l2 .7.8 1.9-.9 1.9L3 20.1l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9.8-1.9z",
  ],
  profile: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  bell: ["M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  plus: ["M12 5v14", "M5 12h14"],
};

interface NavIconProps {
  readonly name: NavIconName;
}

export function NavIcon({ name }: NavIconProps) {
  return (
    <svg
      aria-hidden="true"
      className="nav-icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {iconPaths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
