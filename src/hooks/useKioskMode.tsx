import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/safe-storage";
import { getScopedStorageKey } from "@/lib/backend-cache";

/**
 * Kiosk / Staff Mode
 *
 * When active:
 *   - The admin sidebar, top bar, and bottom nav are hidden.
 *   - The current staff member is locked into the single screen for their role
 *     (chef → /kds, waiter → /tables, manager → /dashboard).
 *   - The mode survives refresh / app close via localStorage.
 *   - Exiting requires the Owner's Supabase account password (re-auth).
 */

const KIOSK_FLAG_KEY = getScopedStorageKey("qb_kiosk_mode");
const KIOSK_OWNER_KEY = getScopedStorageKey("qb_kiosk_owner_email");

interface KioskContextType {
  isKiosk: boolean;
  ownerEmail: string | null;
  /** Activate Staff/Kiosk mode. Pass the owner's email so we can verify on exit. */
  enterKiosk: (ownerEmail: string) => void;
  /** Verify password against Supabase and exit if valid. Returns true on success. */
  exitKiosk: (password: string) => Promise<boolean>;
}

const KioskContext = createContext<KioskContextType>({
  isKiosk: false,
  ownerEmail: null,
  enterKiosk: () => {},
  exitKiosk: async () => false,
});

export const useKioskMode = () => useContext(KioskContext);

const readPersisted = (): { isKiosk: boolean; ownerEmail: string | null } => {
  try {
    const flag = safeStorage.getItem(KIOSK_FLAG_KEY) === "1";
    const ownerEmail = safeStorage.getItem(KIOSK_OWNER_KEY);
    return { isKiosk: flag, ownerEmail };
  } catch {
    return { isKiosk: false, ownerEmail: null };
  }
};

export const KioskProvider = ({ children }: { children: React.ReactNode }) => {
  const initial = readPersisted();
  const [isKiosk, setIsKiosk] = useState<boolean>(initial.isKiosk);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(initial.ownerEmail);

  // Re-sync if storage is changed in another tab
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KIOSK_FLAG_KEY || e.key === KIOSK_OWNER_KEY) {
        const next = readPersisted();
        setIsKiosk(next.isKiosk);
        setOwnerEmail(next.ownerEmail);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const enterKiosk = useCallback((email: string) => {
    try {
      safeStorage.setItem(KIOSK_FLAG_KEY, "1");
      safeStorage.setItem(KIOSK_OWNER_KEY, email);
    } catch {}
    setOwnerEmail(email);
    setIsKiosk(true);
  }, []);

  const exitKiosk = useCallback(async (password: string): Promise<boolean> => {
    if (!ownerEmail) return false;
    try {
      // Re-verify by calling signInWithPassword with the owner's email.
      // This does not disrupt the current session because Supabase will
      // simply refresh the token for the same user if the password matches.
      const { error } = await supabase.auth.signInWithPassword({
        email: ownerEmail,
        password,
      });
      if (error) return false;

      try {
        safeStorage.removeItem(KIOSK_FLAG_KEY);
        safeStorage.removeItem(KIOSK_OWNER_KEY);
      } catch {}
      setIsKiosk(false);
      setOwnerEmail(null);
      return true;
    } catch {
      return false;
    }
  }, [ownerEmail]);

  const value = useMemo(
    () => ({ isKiosk, ownerEmail, enterKiosk, exitKiosk }),
    [isKiosk, ownerEmail, enterKiosk, exitKiosk]
  );

  return <KioskContext.Provider value={value}>{children}</KioskContext.Provider>;
};
