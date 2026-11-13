import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { FpsLimit, Phase, Rep, Tempo } from '../types';
import {
  PHASE_META,
  RING_LENGTH,
  RING_RADIUS,
  THEMES,
  THEME_KEYS,
  repDuration
} from '../lib/phases';
import type { ThemeKey } from '../lib/phases';
import { cn, triggerHaptic } from '../lib/utils';
import { cueForPhase, playCue, primeAudio } from '../lib/audio';
import { usePhaseTimer } from '../hooks/usePhaseTimer';
import { useWakeLock } from '../hooks/useWakeLock';
import { useFullscreen } from '../hooks/useFullscreen';
import { useIdleControls } from '../hooks/useIdleControls';
import RotateDeviceOverlay from './RotateDeviceOverlay';

const CONTROL_SOLID = 'bg-timer-surface border border-timer-surface-border text-white';
const CONTROL_PRIMARY = 'bg-sleek-up border border-transparent text-black shadow-[0_0_30px_rgba(255,255,255,0.3)]';
const CONTROL_SHAPE = 'flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-10 py-3 sm:py-4 font-bold text-sm sm:text-base transition-colors';
/** Icon-only 1/4 button: no horizontal padding, or the icon gets squeezed at wider breakpoints. */
const CONTROL_ICON = 'flex items-center justify-center gap-2 font-bold text-sm sm:text-base transition-colors';

interface RepTimerProps {
  onRepComplete: (rep: Rep) => void;
  targetTempo: Tempo;
  targetReps?: number;
  targetSets?: number;
  reps?: Rep[];
  onReset: () => void;
  onRunningChange?: (running: boolean) => void;
  seamlessTransitions?: boolean;
  fpsLimit?: FpsLimit;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  isTimingsOpen?: boolean;
}

function formatTension(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export default function RepTimer({
  onRepComplete,
  targetTempo,
  targetReps = 12,
  targetSets = 3,
  reps = [],
  onReset,
  onRunningChange,
  seamlessTransitions = false,
  fpsLimit = 60,
  soundEnabled = true,
  onToggleSound,
  isTimingsOpen = false
}: RepTimerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  const timer = usePhaseTimer({
    tempo: targetTempo,
    targetReps,
    targetSets,
    fpsLimit,
    onRepComplete,
    onPhaseStart: (phase: Phase) => playCue(cueForPhase(phase), soundEnabled),
    onSetComplete: () => playCue('setComplete', soundEnabled),
    onFinish: () => playCue('finish', soundEnabled)
  });

  const { status, currentPhase, isLive, completedReps } = timer;
  const { isFullscreen, isSupported: isFullscreenSupported, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const { isVisible, isSuppressed } = useIdleControls(status === 'running' || status === 'countdown');

  useWakeLock(isLive && status !== 'paused');

  useEffect(() => {
    onRunningChange?.(isLive);
  }, [isLive, onRunningChange]);

  // Opening the timings modal mid-session pauses the clock underneath it.
  const { pause: pauseTimer } = timer;
  useEffect(() => {
    if (isTimingsOpen) pauseTimer();
  }, [isTimingsOpen, pauseTimer, status]);

  useEffect(() => () => {
    if (confirmTimerRef.current !== null) clearTimeout(confirmTimerRef.current);
  }, []);

  // Leaving the paused/set-break view cancels a pending "END?" confirmation.
  useEffect(() => {
    if (status === 'paused' || status === 'setBreak') return;
    setConfirmStop(false);
    if (confirmTimerRef.current !== null) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, [status]);

  const hiddenControls = !isVisible && (status === 'running' || status === 'countdown');
  const controlsClass = cn(
    'transition-opacity duration-300',
    hiddenControls ? 'opacity-0 pointer-events-none' : 'opacity-100'
  );

  const guard = useCallback((action: () => void) => () => {
    if (isSuppressed()) return;
    action();
  }, [isSuppressed]);

  const handleStart = guard(() => {
    primeAudio();
    timer.start();
  });

  const handleStartSet = guard(() => {
    primeAudio();
    timer.startSet();
  });

  const handleResume = guard(() => {
    primeAudio();
    timer.resume();
  });

  const handlePause = guard(() => {
    triggerHaptic(15);
    timer.pause();
  });

  const handleToggleFullscreen = guard(() => {
    triggerHaptic(15);
    toggleFullscreen();
  });

  const handleToggleSound = guard(() => {
    triggerHaptic(10);
    onToggleSound?.();
  });

  const requestStop = guard(() => {
    triggerHaptic(15);
    if (!confirmStop) {
      setConfirmStop(true);
      if (confirmTimerRef.current !== null) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmStop(false), 3000);
      return;
    }

    if (confirmTimerRef.current !== null) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = null;
    setConfirmStop(false);
    triggerHaptic(35);
    timer.stop();
    onReset();
  });

  const handleNewSession = useCallback(() => {
    triggerHaptic(20);
    onReset();
  }, [onReset]);

  const handleRingTap = useCallback(() => {
    if (status === 'paused') {
      primeAudio();
      timer.resume();
      return;
    }
    if (status === 'running' || status === 'countdown') {
      timer.pause();
    }
  }, [status, timer]);

  // Space mirrors the ring tap on desktop.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
      if (status !== 'running' && status !== 'countdown' && status !== 'paused') return;
      event.preventDefault();
      primeAudio();
      timer.togglePause();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, timer]);

  // Confetti fires once on the finished transition, on a canvas inside the card
  // so it also shows in fullscreen (A3/A4).
  const metricsRef = useRef({ tempo: targetTempo, targetReps, targetSets });
  useEffect(() => {
    metricsRef.current = { tempo: targetTempo, targetReps, targetSets };
  }, [targetTempo, targetReps, targetSets]);
  const wasFinishedRef = useRef(false);

  useEffect(() => {
    const finished = status === 'finished';
    if (finished && !wasFinishedRef.current) {
      const { tempo, targetReps: repsTarget, targetSets: setsTarget } = metricsRef.current;
      const particles = Math.min(400, Math.max(100, Math.floor(repDuration(tempo) * repsTarget * setsTarget * 0.5)));
      const canvas = confettiCanvasRef.current;
      const fire = canvas
        ? confetti.create(canvas, { resize: true, useWorker: true })
        : confetti;
      fire({
        particleCount: particles,
        spread: 80,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#ffffff', '#cbd5e1', '#94a3b8', '#64748b']
      });
    }
    wasFinishedRef.current = finished;
  }, [status]);

  const themeKey: ThemeKey = status === 'finished'
    ? 'finished'
    : status === 'countdown'
      ? 'countdown'
      : status === 'setBreak'
        ? 'pause_bottom'
        : currentPhase ?? 'idle';

  const ringColor = THEMES[themeKey].color;
  const showBackground = status !== 'idle' && status !== 'paused';
  const setInProgress = Math.min(Math.max(1, Math.floor(completedReps / Math.max(1, targetReps)) + 1), targetSets);
  const completedSet = Math.min(Math.max(0, Math.floor(completedReps / Math.max(1, targetReps))), targetSets);
  const setSegmentIndex = Math.min(Math.floor(completedReps / Math.max(1, targetReps)), targetSets - 1);
  const progressVisible = status === 'running' || status === 'paused' || status === 'countdown';

  const tension = useMemo(
    () => formatTension(reps.reduce((total, rep) => total + (rep.totalDuration || 0), 0)),
    [reps]
  );

  const isPaused = status === 'paused';
  const displayColor = isPaused ? undefined : ringColor;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col items-center justify-between p-6 sm:p-8 bg-sleek-card border border-sleek-border shadow-2xl w-full h-full relative overflow-hidden',
        isFullscreen ? 'border-none min-h-0' : 'min-h-[450px] sm:min-h-[550px]'
      )}
    >
      <RotateDeviceOverlay className="absolute inset-0 z-[70] pointer-events-auto" />

      {/* One stacked gradient per theme, cross-faded by opacity (B1). */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-timer-base" />
      {THEME_KEYS.map((key) => (
        <div
          key={key}
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${THEMES[key].gradient[0]} 0%, ${THEMES[key].gradient[1]} 100%)`,
            opacity: showBackground && themeKey === key ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: seamlessTransitions ? '1200ms' : '400ms',
            transitionTimingFunction: 'linear'
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />

      <canvas
        ref={confettiCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-40 h-full w-full"
      />

      {/* Sound + fullscreen controls, mirroring each other. */}
      <div className={cn(
        'absolute inset-x-0 bottom-0 sm:top-6 sm:bottom-auto sm:inset-x-6 z-30 flex items-center justify-between pointer-events-none',
        controlsClass
      )}>
        <button
          type="button"
          onClick={handleToggleSound}
          aria-label={soundEnabled ? 'Mute phase cues' : 'Unmute phase cues'}
          className="pointer-events-auto p-2 h-11 w-11 flex items-center justify-center bg-white/5 border border-white/10 text-sleek-muted hover:text-sleek-text transition-colors"
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        {isFullscreenSupported && (
          <button
            type="button"
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="pointer-events-auto p-2 h-11 w-11 flex items-center justify-center bg-white/5 border border-white/10 text-sleek-muted hover:text-sleek-text transition-colors"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}
      </div>

      {/* Top: rep/set counter with segmented set bar */}
      <div className="h-12 flex items-center justify-center w-full z-20">
        <div
          className={cn(
            'relative overflow-hidden px-4 sm:px-8 py-2 sm:py-4 border transition-colors duration-1000 text-base sm:text-lg font-medium flex items-center gap-3 sm:gap-4',
            isLive ? 'bg-timer-surface border-timer-surface-border text-white' : 'bg-white/5 border-sleek-border'
          )}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 flex gap-px bg-white/5">
            {Array.from({ length: targetSets }).map((_, index) => {
              const repsInSet = Math.min(targetReps, Math.max(0, completedReps - index * targetReps));
              const isCurrent = index === setSegmentIndex && progressVisible;
              return (
                <div key={index} className="flex-1 bg-white/10 relative overflow-hidden">
                  {isCurrent ? (
                    <div
                      ref={timer.progressRef}
                      className="progress-fill absolute inset-y-0 left-0 w-full bg-sleek-up"
                    />
                  ) : (
                    <div
                      className="absolute inset-y-0 left-0 bg-sleek-up"
                      style={{ width: `${Math.min(100, (repsInSet / Math.max(1, targetReps)) * 100)}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            Rep
            <motion.span
              key={timer.currentRep}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn('font-bold inline-block ml-1', isLive ? 'text-white' : 'text-sleek-text')}
            >
              {timer.currentRep.toString().padStart(2, '0')}
            </motion.span>
            <span className={isLive ? 'text-white/60' : 'text-sleek-muted'}>/ {targetReps}</span>
          </div>
          <div className={cn('w-px h-10 sm:h-4 flex-shrink-0', isLive ? 'bg-white/20' : 'bg-sleek-border')} />
          <div className="flex items-center gap-1">
            Set
            <motion.span
              key={timer.currentSet}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn('font-bold inline-block ml-1', isLive ? 'text-white' : 'text-sleek-text')}
            >
              {timer.currentSet}
            </motion.span>
            <span className={isLive ? 'text-white/60' : 'text-sleek-muted'}>/ {targetSets}</span>
          </div>
        </div>
      </div>

      {/* Middle: ring and timer readout */}
      <div className="relative flex items-center justify-center w-[min(calc(85vw-10px),340px)] h-[min(calc(85vw-10px),340px)] my-6 sm:my-8 z-10">
        <div
          className={cn(
            'absolute inset-0 rounded-full z-0 transition-colors duration-1000',
            isLive ? 'bg-timer-surface' : 'bg-timer-idle-surface/80'
          )}
        />
        <div className="absolute inset-0 border-4 border-white/10 rounded-full z-0" />

        <AnimatePresence>
          {status === 'running' && (
            <motion.div
              key={`ripple-${timer.phaseKey}`}
              initial={{ opacity: 0.8, scale: 0.95 }}
              animate={{ opacity: 0, scale: 2.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 rounded-full pointer-events-none z-0 border-8"
              style={{ borderColor: ringColor, borderStyle: 'solid' }}
            />
          )}
        </AnimatePresence>

        {(isLive || status === 'finished') && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 z-10 pointer-events-none"
            viewBox="0 0 400 400"
            aria-hidden="true"
          >
            <circle
              ref={timer.ringRef}
              cx="200"
              cy="200"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH}
              strokeLinecap="round"
              style={{
                stroke: ringColor,
                strokeOpacity: 0,
                transition: 'stroke 350ms linear'
              }}
            />
          </svg>
        )}

        {/* One-tap pause/resume target over the ring (D4). */}
        <button
          type="button"
          onClick={handleRingTap}
          disabled={status === 'idle' || status === 'finished' || status === 'setBreak'}
          aria-label={status === 'paused' ? 'Resume session' : 'Pause session'}
          className="absolute inset-0 z-30 rounded-full cursor-pointer disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <AnimatePresence initial={false}>
            {status === 'finished' ? (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
              >
                <div className="uppercase tracking-[4px] text-[11px] sm:text-xs -translate-y-[3.5rem] sm:-translate-y-[4.5rem] font-bold whitespace-nowrap text-sleek-text">
                  WORKOUT COMPLETE
                </div>
                <div className="text-[50px] sm:text-[70px] font-black leading-none text-sleek-text relative">
                  FINISH!
                </div>
                <div className="mt-3 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-white/80">
                  {targetSets} × {targetReps} · {tension} under tension
                </div>
              </motion.div>
            ) : status === 'countdown' ? (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="absolute uppercase tracking-[4px] text-sm -translate-y-[4rem] sm:-translate-y-[5.5rem] whitespace-nowrap text-sleek-muted">
                  GET READY
                </div>
                <motion.div
                  key={timer.countdown}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1.15 }}
                  transition={{ duration: 0.25 }}
                  className="text-[100px] sm:text-[140px] font-black leading-none text-sleek-text tabular-nums text-center w-full"
                >
                  {timer.countdown}
                </motion.div>
              </motion.div>
            ) : status === 'idle' ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="absolute uppercase tracking-[2px] sm:tracking-[4px] text-[11px] sm:text-sm -translate-y-[4rem] sm:-translate-y-[5.5rem] whitespace-nowrap text-sleek-muted">
                  READY TO START
                </div>
                <div className="text-7xl sm:text-[100px] font-extrabold leading-none text-sleek-text tabular-nums relative">
                  00.0
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="live"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {status === 'setBreak' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="uppercase tracking-[4px] text-[11px] sm:text-xs font-bold text-white/70 mb-3">
                      SET {completedSet} OF {targetSets} DONE
                    </div>
                    <div className="text-3xl sm:text-4xl font-black leading-tight text-sleek-text whitespace-nowrap">
                      SET {completedSet} COMPLETE
                    </div>
                    <div className="mt-4 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-white/70">
                      {targetReps} reps banked
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute -translate-y-[4rem] sm:-translate-y-[5.5rem] whitespace-nowrap">
                      <div
                        key={timer.phaseKey}
                        ref={timer.labelRef}
                        className="origin-bottom text-sleek-text uppercase tracking-[2px] sm:tracking-[4px] text-sm sm:text-base font-black antialiased"
                      >
                        <span
                          className={cn(
                            'inline-block',
                            status === 'running' && currentPhase === 'pause_top' && 'animate-hold-shake'
                          )}
                        >
                          {isPaused
                            ? 'SESSION PAUSED'
                            : currentPhase
                              ? PHASE_META[currentPhase].label
                              : ''}
                        </span>
                      </div>
                    </div>
                    <div
                      ref={timer.numberRef}
                      className={cn(
                        'tabular-nums transition-colors duration-300 relative text-7xl sm:text-[100px] font-extrabold leading-none',
                        isPaused ? 'text-sleek-muted' : ''
                      )}
                      style={{ color: displayColor }}
                    >
                      00.0
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: controls */}
      <div className="relative h-16 flex items-center justify-center w-full z-20">
        {status === 'finished' ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleNewSession}
            className={cn('w-full max-w-[240px] sm:max-w-[380px] h-full', CONTROL_SHAPE, CONTROL_PRIMARY)}
          >
            <Play size={18} fill="currentColor" className="sm:w-5 sm:h-5" />
            <span>NEW SESSION</span>
          </motion.button>
        ) : (
          <div className={cn(
            'flex w-full max-w-[240px] sm:max-w-[380px] h-full',
            controlsClass
          )}>
            {status === 'paused' ? (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={requestStop}
                  aria-label={confirmStop ? 'Confirm end session' : 'End session'}
                  className={cn('w-1/4 h-full', CONTROL_ICON, CONTROL_SOLID, confirmStop && 'text-red-300')}
                >
                  {confirmStop ? <span className="text-[11px] font-bold">END?</span> : <Square size={20} fill="currentColor" />}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleResume}
                  className={cn('w-3/4 h-full border-l-0', CONTROL_SHAPE, CONTROL_SOLID)}
                >
                  <Play size={18} fill="currentColor" />
                  RESUME
                </motion.button>
              </>
            ) : status === 'setBreak' ? (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={requestStop}
                  aria-label={confirmStop ? 'Confirm end session' : 'End session'}
                  className={cn('w-1/4 h-full', CONTROL_ICON, CONTROL_SOLID, confirmStop && 'text-red-300')}
                >
                  {confirmStop ? <span className="text-[11px] font-bold">END?</span> : <Square size={20} fill="currentColor" />}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartSet}
                  className={cn('w-3/4 h-full border-l-0', CONTROL_SHAPE, CONTROL_SOLID)}
                >
                  <Play size={18} fill="currentColor" />
                  START SET {Math.min(setInProgress, targetSets)}
                </motion.button>
              </>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={status === 'idle' ? handleStart : handlePause}
                className={cn(
                  'w-full h-full',
                  CONTROL_SHAPE,
                  status === 'idle' ? CONTROL_PRIMARY : CONTROL_SOLID
                )}
              >
                {status === 'idle' ? (
                  <>
                    <Play size={18} fill="currentColor" className="sm:w-5 sm:h-5" />
                    <span>START SESSION</span>
                  </>
                ) : (
                  <>
                    <Pause size={18} fill="currentColor" className="sm:w-5 sm:h-5" />
                    <span>PAUSE SESSION</span>
                  </>
                )}
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
