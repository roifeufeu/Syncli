import { createContext, useContext } from "react";

export const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme doit être utilisé dans ThemeProvider");
  }

  return context;
}
