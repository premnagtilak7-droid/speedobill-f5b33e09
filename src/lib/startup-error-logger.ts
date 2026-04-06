/**
 * Global error listener that captures startup crashes and logs them
 * to the Supabase bug_reports table (unauthenticated-safe via a
 * lightweight insert). Also prevents white-screen on iOS by showing
 * a recovery UI.
 */

const SUPABASE_URL = "https://pkpefscbpyqpafogdbor.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrcGVmc2NicHlxcGFmb2dkYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTg5NDMsImV4cCI6MjA4OTU5NDk0M30.wXNGPD0KHv7A-gQmLt0Cn6585-3hCpdWoyjK3YW3GKU";

function getDeviceInfo(): string {
  try {
    return `${navigator.userAgent} | ${screen.width}x${screen.height} | ${navigator.language}`;
  } catch {
    return "unknown";
  }
}

function logToSupabase(message: string) {
  try {
    const body = JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000000",
      message: `[STARTUP CRASH] ${message}`.slice(0, 2000),
      page: window.location.pathname,
      device_info: getDeviceInfo(),
    });

    fetch(`${SUPABASE_URL}/rest/v1/bug_reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body,
    }).catch(() => {});
  } catch {
    // Silently fail — we're in crash territory
  }
}

function showRecoveryUI(errorMsg: string) {
  const root = document.getElementById("root");
  if (!root) return;
  // Only show if root is still empty (white screen)
  if (root.children.length > 0) return;

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;padding:24px;font-family:system-ui,-apple-system,sans-serif">
      <div style="text-align:center;max-width:360px">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px">SpeedoBill is loading…</h1>
        <p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:0 0 20px">If this screen persists, tap the button below to restart.</p>
        <button onclick="try{localStorage.clear();sessionStorage.clear()}catch(e){}location.reload()" style="background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;min-height:48px;width:100%">
          Clear Cache & Restart
        </button>
        <p style="color:#475569;font-size:11px;margin-top:16px">Speedo Bill v8.0.0 • © 2026 Mangal Multiproduct</p>
      </div>
    </div>
  `;
}

export function installGlobalErrorHandlers() {
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = `${message} at ${source}:${lineno}:${colno} — ${error?.stack || "no stack"}`;
    console.error("[GlobalErrorHandler]", msg);
    logToSupabase(msg);
    showRecoveryUI(String(message));
    return false;
  };

  window.addEventListener("unhandledrejection", (event) => {
    const msg = `Unhandled promise rejection: ${event.reason?.message || event.reason || "unknown"}`;
    console.error("[GlobalErrorHandler]", msg);
    logToSupabase(msg);
    showRecoveryUI(msg);
  });
}
