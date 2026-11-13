import { Smartphone } from 'lucide-react';
import { cn } from '../lib/utils';

interface RotateDeviceOverlayProps {
  className?: string;
}

/**
 * Portrait-only nudge. Rendered as a fixed overlay at app level and again inside
 * the timer card, because a fullscreen element hides its siblings.
 */
export default function RotateDeviceOverlay({ className }: RotateDeviceOverlayProps) {
  return (
    <div
      className={cn(
        'bg-sleek-bg flex-col items-center justify-center p-6 text-center hidden [@media(orientation:landscape)_and_(max-height:600px)]:flex',
        className
      )}
    >
      <Smartphone size={48} className="text-sleek-muted animate-pulse mb-4 rotate-90" />
      <h2 className="text-xl font-bold mb-2">Please rotate your device</h2>
      <p className="text-sleek-muted text-sm max-w-xs">
        TempoTrack is designed to be used in portrait mode for the best experience.
      </p>
    </div>
  );
}
