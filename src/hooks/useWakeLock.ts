import { useEffect, useRef } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

/**
 * Hold a screen wake lock while `shouldHold` is true. Re-acquires the lock when
 * the document becomes visible again, because the browser drops it on hide.
 */
export function useWakeLock(shouldHold: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let disposed = false;

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };

    const acquire = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      const wakeLock = (navigator as Navigator & WakeLockNavigator).wakeLock;
      if (!wakeLock) return;

      wakeLock.request('screen').then((sentinel) => {
        if (disposed) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      }).catch((error: unknown) => {
        // A denied permission is a normal outcome (desktop browsers, policy),
        // not a failure worth shouting about.
        if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        const expected = message.toLowerCase();
        if (!expected.includes('permissions policy') && !expected.includes('not allowed')) {
          console.error('Wake Lock failed:', error);
        }
      });
    };

    if (!shouldHold) {
      release();
      return;
    }

    acquire();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [shouldHold]);
}
