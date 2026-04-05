import { useState, useEffect, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

/** Returns true when the browser has network connectivity. */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
