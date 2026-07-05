import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ColorTheme, ThemeMode, lightThemeColors, darkThemeColors } from "../constants/theme";

interface ThemeContextValue {
  themeMode: ThemeMode;
  theme: ColorTheme;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "@budgetbuddy_theme_mode";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    const loadStoredTheme = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
          setThemeModeState(storedMode);
        }
      } catch (error) {
        console.error("Failed to load theme mode:", error);
      } finally {
        setThemeLoaded(true);
      }
    };
    loadStoredTheme();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error("Failed to save theme mode:", error);
    }
  }, []);

  const activeMode = themeMode === "system" ? (systemColorScheme || "light") : themeMode;
  const theme = activeMode === "dark" ? darkThemeColors : lightThemeColors;
  const isDark = activeMode === "dark";
  const contextValue = useMemo(
    () => ({ themeMode, theme, isDark, setThemeMode }),
    [themeMode, theme, isDark, setThemeMode]
  );

  if (!themeLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
