/**
 * Firebase-ready analytics event logger.
 * Logs to console in dev; replace body with Firebase SDK calls when ready.
 */

type EventName = "OrderPlaced" | "BillGenerated" | "LoginSuccess" | "KOTSent" | "VoidCreated" | string;

export function logEvent(name: EventName, params?: Record<string, unknown>) {
  // Firebase integration point — uncomment when SDK is added:
  // import { getAnalytics, logEvent as fbLog } from "firebase/analytics";
  // fbLog(getAnalytics(), name, params);

  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${name}`, params ?? "");
  }
}
