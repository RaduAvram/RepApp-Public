import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface FullscreenState {
  isFullscreen: boolean;
  isSupported: boolean;
  toggle: () => void;
}

/**
 * Fullscreen handling for a container, including the back-button handling that
 * exits fullscreen instead of leaving the app. Supported is feature-detected
 * rather than sniffed from the user agent.
 */
export function useFullscreen(containerRef: RefObject<HTMLElement | null>): FullscreenState {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(Boolean(document.fullscreenEnabled));
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const element = containerRef.current;
      setIsFullscreen(Boolean(element) && document.fullscreenElement === element);
      if (!document.fullscreenElement && window.history.state?.fullscreen) {
        window.history.back();
      }
    };

    const handlePopState = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [containerRef]);

  const toggle = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }

    if (typeof element.requestFullscreen !== 'function') return;
    void element.requestFullscreen().then(() => {
      window.history.pushState({ fullscreen: true }, '');
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error attempting to enable fullscreen: ${message}`);
    });
  }, [containerRef]);

  return { isFullscreen, isSupported, toggle };
}
