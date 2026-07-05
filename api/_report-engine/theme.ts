/**
 * Design tokens ported 1:1 from the validated reportlab prototype.
 * Changing a report's look means changing values here — never inline
 * colors inside a template file.
 */

export const INK = "#0A0A0B";
export const GREY = "#6B6B6E";
export const LINE = "#E5E4E0";
export const MIST = "#F5F5F3";
export const GREEN = "#3E8E5B";
export const RED = "#C24A4A";
export const GOLD = "#C08A1E";
export const HONEY_DEEP = "#B87400";

export const PRO_GREEN = "#1F7A54";
export const PRO_GREEN_LIGHT = "#5CB88A";

export const NAVY = "#12162B";
export const NAVY_LIGHT = "#232A4D";
export const NAVY_BAND = "#161B33";
export const PLAT_GOLD = "#C9A227";

export const DECISION_COLORS: Record<string, string> = {
  GO: GREEN,
  WAIT: GOLD,
  PIVOT: "#B8590B",
  STOP: RED,
};

export interface TierTheme {
  accent: string;
  accentLight: string;
  ink: string;
  muted: string;
  line: string;
  pageBg: string;
  cardBg: string;
}

export const THEME: Record<"pro" | "platinum", TierTheme> = {
  pro: {
    accent: PRO_GREEN,
    accentLight: PRO_GREEN_LIGHT,
    ink: INK,
    muted: GREY,
    line: LINE,
    pageBg: "#FFFFFF",
    cardBg: "#FFFFFF",
  },
  platinum: {
    accent: PLAT_GOLD,
    accentLight: PLAT_GOLD,
    ink: INK,
    muted: GREY,
    line: LINE,
    pageBg: "#FFFFFF", // content pages stay light/readable; only the cover is dark
    cardBg: "#FFFFFF",
  },
};

export const FONT_STACK =
  "Helvetica, Arial, 'Helvetica Neue', sans-serif";
