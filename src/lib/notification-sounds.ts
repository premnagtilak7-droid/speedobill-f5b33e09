// ── Audio notification engine ──

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

export function playLoudBell() {
  playTone(800, 0.3, "triangle", 0.5);
  setTimeout(() => playTone(1000, 0.3, "triangle", 0.5), 200);
  setTimeout(() => playTone(1200, 0.4, "triangle", 0.5), 400);
}

export function playSoftDing() {
  playTone(1200, 0.15, "sine", 0.2);
}

export function playWarningTone() {
  playTone(400, 0.2, "square", 0.3);
  setTimeout(() => playTone(300, 0.3, "square", 0.3), 250);
}

export async function primeNotificationEngine() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch {}

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {}
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
