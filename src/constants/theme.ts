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
  background: "#000000",
  card: "#171717",
  primary: "#10B981",
  primaryDark: "#059669",
  primarySoft: "#064E3B",
  secondary: "#3B82F6",
  secondarySoft: "#1E3A8A",
  danger: "#EF4444",
  dangerSoft: "#7F1D1D",
  warning: "#F59E0B",
  warningSoft: "#78350F",
  text: "#F5F5F5",
  textMuted: "#A3A3A3",
  border: "#2A2A2A",
  input: "#101010",
  shadow: "#000000",
  white: "#FFFFFF",
  
  surface: "#1F1F1F",
  divider: "rgba(255, 255, 255, 0.1)",
  disabled: "#3A3A3A",
  placeholder: "#8A8A8A"
};
