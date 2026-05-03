// ── Audio notification engine with volume control ──

let audioContext: AudioContext | null = null;
let globalVolume = 0.5; // 0 to 1

export function setNotificationVolume(v: number) {
  globalVolume = Math.max(0, Math.min(1, v));
}

export function getNotificationVolume() {
  return globalVolume;
}

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  if (globalVolume === 0) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    const effectiveVol = volume * globalVolume;
    gain.gain.setValueAtTime(effectiveVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

/** Loud bell for new orders — chef/KDS */
export function playLoudBell() {
  playTone(800, 0.3, "triangle", 0.5);
  setTimeout(() => playTone(1000, 0.3, "triangle", 0.5), 200);
  setTimeout(() => playTone(1200, 0.4, "triangle", 0.5), 400);
}

/** Soft ding for order ready — waiter */
export function playSoftDing() {
  playTone(1200, 0.15, "sine", 0.25);
  setTimeout(() => playTone(1500, 0.2, "sine", 0.2), 100);
}

/** Warning tone for voids */
export function playWarningTone() {
  playTone(400, 0.2, "square", 0.3);
  setTimeout(() => playTone(300, 0.3, "square", 0.3), 250);
}

/** Payment received — cheerful double ding for owner */
export function playPaymentSound() {
  playTone(1000, 0.15, "sine", 0.3);
  setTimeout(() => playTone(1400, 0.2, "sine", 0.3), 120);
  setTimeout(() => playTone(1800, 0.25, "sine", 0.25), 240);
}

export async function primeNotificationEngine() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
  } catch {}

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
}

export function sendBrowserNotif(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag, icon: "/favicon.ico" });
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([120, 60, 120]);
      }
    } catch {}
  } else if (Notification.permission !== "denied") {
    void Notification.requestPermission();
  }
}
