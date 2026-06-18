import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AppTheme = "dark" | "light";

type ThemeColors = {
  background: string;
  card: string;
  cardAlt: string;
  text: string;
  secondary: string;
  muted: string;
  primary: string;
  primaryDark: string;
  onPrimary: string;
  accentGold: string;
  border: string;
  input: string;
  danger: string;
  success: string;
  warning: string;
  placeholder: string;
};

type ThemeContextValue = {
  theme: AppTheme;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: AppTheme) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const DARK_COLORS: ThemeColors = {
  background: "#061A36",
  card: "#0B2A57",
  cardAlt: "#081F43",
  text: "#FFFFFF",
  secondary: "#D8E1F2",
  muted: "#8FA4C7",
  primary: "#0B3A75",
  primaryDark: "#0B3A75",
  onPrimary: "#FFFFFF",
  accentGold: "#D9B44A",
  border: "#1B3975",
  input: "#061A36",
  danger: "#FF3B30",
  success: "#47D16C",
  warning: "#FFB547",
  placeholder: "#8FA4C7",
};

const LIGHT_COLORS: ThemeColors = {
  background: "#F5F8FC",
  card: "#FFFFFF",
  cardAlt: "#DCE8F8",
  text: "#061A36",
  secondary: "#52627A",
  muted: "#7E8CA3",
  primary: "#0B3A75",
  primaryDark: "#0B3A75",
  onPrimary: "#FFFFFF",
  accentGold: "#C9A13A",
  border: "#0B3A75",
  input: "#FFFFFF",
  danger: "#D93630",
  success: "#21884C",
  warning: "#C88416",
  placeholder: "#7E8CA3",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const saved = await AsyncStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setThemeState(saved);
  };

  const setTheme = async (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    await AsyncStorage.setItem("theme", nextTheme);
  };

  const toggleTheme = async () => setTheme(theme === "dark" ? "light" : "dark");

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", colors: theme === "dark" ? DARK_COLORS : LIGHT_COLORS, setTheme, toggleTheme }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
