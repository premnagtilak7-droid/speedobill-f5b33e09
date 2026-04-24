/**
 * Global audio notification provider.
 *
 * Browsers block audio playback until a user gesture. This provider:
 *  1. Owns a single AudioContext + decoded bell buffer (web audio is gesture-locked).
 *  2. Tracks `isAudioEnabled` — flipped to true after the user clicks the
 *     "Start Shift & Enable Audio" button on the Dashboard, which plays a
 *     0.5s silent .mp3 to satisfy the gesture-unlock requirement.
 *  3. Persists the bell sound URL (overridable from Settings, default is the
 *     bundled /sounds/kitchen_bell.mp3).
 *
 * Components import the `useAudioNotification` hook to play the bell or
 * read enable state — never instantiate a second AudioContext.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY_ENABLED = "audio_enabled_v1";
const STORAGE_KEY_BELL_URL = "audio_bell_url_v1";
const DEFAULT_BELL_URL = "/sounds/kitchen_bell.mp3";
const SILENT_UNLOCK_URL = "/sounds/silent.mp3";

interface AudioNotificationContextValue {
  isAudioEnabled: boolean;
  bellUrl: string;
  setBellUrl: (url: string) => void;
  /** Call from a user gesture. Plays a 0.5s silent file to unlock audio. */
  enableAudio: () => Promise<boolean>;
  /** Play the configured bell. Silently no-ops if audio not yet enabled. */
  playBell: () => Promise<void>;
  /** Always-attempt play for the explicit "Test Sound" button. */
  testBell: () => Promise<void>;
}

const AudioNotificationContext = createContext<AudioNotificationContextValue | null>(null);

function readBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1" || v === "true";
  } catch {
    return fallback;
  }
}

function readString(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function AudioNotificationProvider({ children }: { children: React.ReactNode }) {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() =>
    readBool(STORAGE_KEY_ENABLED, false),
  );
  const [bellUrl, setBellUrlState] = useState<string>(() =>
    readString(STORAGE_KEY_BELL_URL, DEFAULT_BELL_URL),
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const bellBufferRef = useRef<AudioBuffer | null>(null);
  const lastBellUrlRef = useRef<string>("");

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      try {
        audioCtxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  const loadBellBuffer = useCallback(
    async (url: string): Promise<AudioBuffer | null> => {
      const ctx = getCtx();
      if (!ctx) return null;
      if (bellBufferRef.current && lastBellUrlRef.current === url) {
        return bellBufferRef.current;
      }
      try {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed to fetch bell: ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        bellBufferRef.current = buf;
        lastBellUrlRef.current = url;
        return buf;
      } catch (e) {
        console.warn("Bell sound load failed:", e);
        return null;
      }
    },
    [getCtx],
  );

  const enableAudio = useCallback(async (): Promise<boolean> => {
    const ctx = getCtx();
    if (!ctx) return false;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      // Play a tiny silent <audio> tag — this satisfies iOS Safari + Android
      // policies that require an HTMLMediaElement gesture for background tabs.
      try {
        const el = new Audio(SILENT_UNLOCK_URL);
        el.volume = 0;
        await el.play().catch(() => {});
      } catch {}
      // Pre-warm the bell buffer so the first real ping is instant.
      await loadBellBuffer(bellUrl);

      setIsAudioEnabled(true);
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, "1");
      } catch {}
      return true;
    } catch (e) {
      console.warn("enableAudio failed:", e);
      return false;
    }
  }, [bellUrl, getCtx, loadBellBuffer]);

  const internalPlay = useCallback(
    async (force: boolean) => {
      if (!force && !isAudioEnabled) return;
      const ctx = getCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch {}
      }
      const buf = await loadBellBuffer(bellUrl);
      if (!buf) {
        // Fallback: <audio> tag
        try {
          const el = new Audio(bellUrl);
          el.volume = 1;
          await el.play();
        } catch (e) {
          console.warn("Audio fallback failed:", e);
        }
        return;
      }
      try {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 1;
        src.connect(gain).connect(ctx.destination);
        src.start();
      } catch (e) {
        console.warn("Bell play failed:", e);
      }
    },
    [bellUrl, getCtx, isAudioEnabled, loadBellBuffer],
  );

  const playBell = useCallback(() => internalPlay(false), [internalPlay]);
  const testBell = useCallback(() => internalPlay(true), [internalPlay]);

  const setBellUrl = useCallback((url: string) => {
    const next = url.trim() || DEFAULT_BELL_URL;
    setBellUrlState(next);
    try { localStorage.setItem(STORAGE_KEY_BELL_URL, next); } catch {}
    // Invalidate cached buffer so the new URL is fetched next play
    bellBufferRef.current = null;
    lastBellUrlRef.current = "";
  }, []);

  // Resume the context whenever the tab becomes visible again — Chrome
  // throttles AudioContext when the tab is backgrounded.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        const ctx = audioCtxRef.current;
        if (ctx?.state === "suspended") void ctx.resume();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const value = useMemo<AudioNotificationContextValue>(
    () => ({ isAudioEnabled, bellUrl, setBellUrl, enableAudio, playBell, testBell }),
    [isAudioEnabled, bellUrl, setBellUrl, enableAudio, playBell, testBell],
  );

  return (
    <AudioNotificationContext.Provider value={value}>
      {children}
    </AudioNotificationContext.Provider>
  );
}

export function useAudioNotification(): AudioNotificationContextValue {
  const ctx = useContext(AudioNotificationContext);
  if (!ctx) {
    throw new Error("useAudioNotification must be used inside <AudioNotificationProvider>");
  }
  return ctx;
}

export const DEFAULT_BELL_SOUND_URL = DEFAULT_BELL_URL;
