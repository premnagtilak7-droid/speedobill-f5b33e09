import { useCallback, useMemo, useSyncExternalStore } from "react";
import { safeStorage } from "@/lib/safe-storage";

type Theme = "light" | "dark";

// Singleton theme store — avoids re-renders across the tree
let currentTheme: Theme = (() => {
  try {
    return (safeStorage.getItem("qb-theme") as Theme) || "dark";
  } catch {
    return "dark";
  }
})();

const listeners = new Set<() => void>();

function setThemeValue(t: Theme) {
  currentTheme = t;
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  safeStorage.setItem("qb-theme", t);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return currentTheme;
}

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggleTheme = useCallback(() => {
    setThemeValue(theme === "dark" ? "light" : "dark");
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeValue(t), []);

  return useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
};