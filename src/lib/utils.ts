import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function triggerHaptic(duration = 15) {
  if (typeof window !== 'undefined' && navigator && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // Ignore vibration errors as they are non-essential and restricted in some sandboxed frames
    }
  }
}
