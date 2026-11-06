import { colors } from "../../constants/colors";

export type ThemeMode = "light" | "dark" | "system";

export interface ColorTheme {
  background: string;
  card: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  text: string;
  textMuted: string;
  border: string;
  input: string;
  shadow: string;
  white: string;
  
  // Custom tokens
  surface: string;
  divider: string;
  disabled: string;
  placeholder: string;
}

export const lightThemeColors: ColorTheme = {
  background: colors.background,
  card: colors.card,
  primary: colors.primary,
  primaryDark: colors.primaryDark,
  primarySoft: colors.primarySoft,
  secondary: colors.secondary,
  secondarySoft: colors.secondarySoft,
  danger: colors.danger,
  dangerSoft: colors.dangerSoft,
  warning: colors.warning,
  warningSoft: colors.warningSoft,
  text: colors.text,
  textMuted: colors.textMuted,
  border: colors.border,
  input: colors.input,
  shadow: colors.shadow,
  white: colors.white,
  
  surface: "#FFFFFF",
  divider: "rgba(15, 23, 42, 0.06)",
  disabled: "#CBD5E1",
  placeholder: "#94A3B8"
};

export const darkThemeColors: ColorTheme = {
  background: "#0A0E1A",
  card: "#121829",
  primary: "#10B981",       // Crisp vibrant emerald adapted for dark surfaces
  primaryDark: "#059669",
  primarySoft: "#064E3B",
  secondary: "#34D399",
  secondarySoft: "#064E3B",
  danger: "#F87171",
  dangerSoft: "#450A0A",
  warning: "#FBBF24",
  warningSoft: "#451A03",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#1E293B",
  input: "#0F172A",
  shadow: "#000000",
  white: "#FFFFFF",
  
  surface: "#1A2238",
  divider: "rgba(255, 255, 255, 0.08)",
  disabled: "#334155",
  placeholder: "#64748B"
};
