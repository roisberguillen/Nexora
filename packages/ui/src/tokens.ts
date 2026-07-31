/** Canonical visual tokens shared by browser and future Tauri shells. */
export const nexoraTokens = Object.freeze({
  color: Object.freeze({
    border: "#D8DDEA",
    danger: "#C32626",
    dangerSoft: "#FFE2DF",
    focus: "#1648D8",
    primary: "#1648D8",
    primaryHover: "#103DBC",
    primarySoft: "#E9EFFF",
    sidebar: "#1F3147",
    success: "#08745A",
    successSoft: "#DDF6EE",
    surface: "#F6F7FB",
    surfaceRaised: "#FFFFFF",
    textPrimary: "#0B1C30",
    textSecondary: "#5B6678",
    warning: "#A86400",
    warningSoft: "#FFF0D6",
  }),
  radius: Object.freeze({ large: "16px", medium: "12px", pill: "999px", small: "8px" }),
  space: Object.freeze({
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  }),
  viewport: Object.freeze({ desktop: 1440, mobile: 390, minimum: 320, tablet: 768 }),
});

export type NexoraTokens = typeof nexoraTokens;
