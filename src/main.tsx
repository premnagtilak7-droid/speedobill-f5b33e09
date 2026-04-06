// Polyfill requestIdleCallback for Safari
if (typeof window !== "undefined" && !("requestIdleCallback" in window)) {
  (window as any).requestIdleCallback = (cb: Function) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
  (window as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

import { installGlobalErrorHandlers } from "./lib/startup-error-logger";
installGlobalErrorHandlers();

import { createRoot } from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";

// Apply saved theme safely to prevent startup crashes on restricted browsers
let savedTheme = "dark";
try {
  savedTheme = localStorage.getItem("qb-theme") || "dark";
} catch {
  savedTheme = "dark";
}
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}
import App from "./App.tsx";
import "./index.css";

// Unregister service workers in preview/iframe contexts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <OfflineBanner />
    <App />
  </ErrorBoundary>
);
