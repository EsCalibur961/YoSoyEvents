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
  background: "#07111F", card: "#0D1C2E", cardAlt: "#11243A",
  text: "#F7F9FC", secondary: "#B8C5D8", muted: "#7487A3",
  primary: "#3F7CFF", primaryDark: "#2459C8", onPrimary: "#FFFFFF",
  accentGold: "#E7B84B", border: "#203650", input: "#0A1728",
  danger: "#FF5B62", success: "#3CCB8A", warning: "#F5B84B",
  placeholder: "#70839F",
};

const LIGHT_COLORS: ThemeColors = {
  background: "#F3F6FA", card: "#FFFFFF", cardAlt: "#F7F9FC",
  text: "#10233E", secondary: "#5E6F86", muted: "#8997A9",
  primary: "#2868E8", primaryDark: "#174EBA", onPrimary: "#FFFFFF",
  accentGold: "#C99527", border: "#DCE4EE", input: "#F7F9FC",
  danger: "#D9474F", success: "#238A61", warning: "#B97A16",
  placeholder: "#8A98AA",
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
