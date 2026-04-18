/**
 * Platform detection utilities for SpeedoBill.
 *
 * - isPWA(): true when launched as an installed PWA (standalone display mode)
 * - isMobileViewport(): true when screen width is <= 768px
 *
 * These are deliberately framework-free so they can be called from
 * routing logic, hooks, and event handlers alike.
 */

export const isPWA = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    // iOS Safari standalone flag
    if ((window.navigator as any).standalone === true) return true;
  } catch {
    // ignore
  }
  return false;
};

export const isMobileViewport = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768;
};

/**
 * Where to send the user after they log out.
 * - PWA → /auth (no landing page in installed app)
 * - Mobile browser → /auth (per spec)
 * - Desktop browser → / (landing page)
 */
export const getPostLogoutPath = (): string => {
  if (isPWA()) return "/auth";
  if (isMobileViewport()) return "/auth";
  return "/";
};
