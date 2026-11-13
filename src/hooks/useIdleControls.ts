import { useCallback, useEffect, useRef, useState } from 'react';

interface IdleControls {
  isVisible: boolean;
  /** Container ref for the controls that hide themselves. */
  isSuppressed: () => boolean;
}

/**
 * Auto-hides controls after `idleMs` of inactivity while `active`. Any activity
 * reveals them again. Actions that start from the reveal gesture itself are
 * ignored briefly, so a tap that only wakes the controls cannot also press a
 * button that was invisible a moment ago.
 */
export function useIdleControls(active: boolean, idleMs = 10000): IdleControls {
  const [isVisible, setIsVisible] = useState(true);
  const visibleRef = useRef(true);
  const suppressUntilRef = useRef(0);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleHide = () => {
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      if (!activeRef.current) return;
      hideTimer = setTimeout(() => {
        visibleRef.current = false;
        setIsVisible(false);
      }, idleMs);
    };

    const handleActivity = () => {
      if (!visibleRef.current) {
        visibleRef.current = true;
        setIsVisible(true);
        suppressUntilRef.current = performance.now() + 350;
      }
      scheduleHide();
    };

    if (activeRef.current) {
      scheduleHide();
    } else if (!visibleRef.current) {
      // Paused or idle sessions always show their controls.
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      visibleRef.current = true;
      setIsVisible(true);
    } else if (hideTimer !== undefined) {
      clearTimeout(hideTimer);
    }

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'] as const;
    events.forEach((event) => document.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      events.forEach((event) => document.removeEventListener(event, handleActivity));
    };
  }, [active, idleMs]);

  const isSuppressed = useCallback(() => performance.now() < suppressUntilRef.current, []);

  return { isVisible, isSuppressed };
}
