/**
 * Light haptic feedback for mobile devices using Vibration API.
 */
export function hapticLight() {
  try {
    navigator?.vibrate?.(15);
  } catch {}
}

export function hapticMedium() {
  try {
    navigator?.vibrate?.(30);
  } catch {}
}

export function hapticSuccess() {
  try {
    navigator?.vibrate?.([15, 50, 15]);
  } catch {}
}
