/* oxlint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(
  null,
);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("kdms-theme") === "light" ? "light" : "dark",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("kdms-theme", theme);
  }, [theme]);
  const value = useMemo(
    () => ({
      theme,
      toggle: () =>
        setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme harus berada dalam ThemeProvider");
  return value;
}
