import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { FpsLimit, Phase, Rep, Tempo, TimerStatus } from '../types';
import { PHASES_ORDER, RING_LENGTH, phaseTarget, repDuration } from '../lib/phases';
import { newId, triggerHaptic } from '../lib/utils';

const COUNTDOWN_FROM = 3;
const FRAME_TOLERANCE_MS = 1;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function blankRep(): Rep {
  return {
    id: newId(),
    timestamp: Date.now(),
    concentricDuration: 0,
    pauseTopDuration: 0,
    eccentricDuration: 0,
    pauseBottomDuration: 0,
    totalDuration: 0
  };
}

export interface PhaseTimerOptions {
  tempo: Tempo;
  targetReps: number;
  targetSets: number;
  fpsLimit: FpsLimit;
  onRepComplete: (rep: Rep) => void;
  onPhaseStart?: (phase: Phase) => void;
  onSetComplete?: (setNumber: number) => void;
  onFinish?: () => void;
}

export interface PhaseTimerApi {
  status: TimerStatus;
  currentPhase: Phase | null;
  /** Increments once per phase; used to key the ripple and label. */
  phaseKey: number;
  countdown: number;
  completedReps: number;
  currentSet: number;
  currentRep: number;
  isLive: boolean;
  ringRef: RefObject<SVGCircleElement | null>;
  labelRef: RefObject<HTMLDivElement | null>;
  numberRef: RefObject<HTMLDivElement | null>;
  progressRef: RefObject<HTMLDivElement | null>;
  start: () => void;
  startSet: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  stop: () => void;
}

/**
 * The rep/set state machine. React state only changes once per phase, rep or
 * status change; everything that changes per frame is written straight to the
 * ring, label, number and progress segment through refs.
 */
export function usePhaseTimer({
  tempo,
  targetReps,
  targetSets,
  fpsLimit,
  onRepComplete,
  onPhaseStart,
  onSetComplete,
  onFinish
}: PhaseTimerOptions): PhaseTimerApi {
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [currentPhase, setCurrentPhase] = useState<Phase | null>(null);
  const [phaseKey, setPhaseKey] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [completedReps, setCompletedReps] = useState(0);

  const statusRef = useRef<TimerStatus>('idle');
  const phaseRef = useRef<Phase | null>(null);
  const phaseStartRef = useRef(0);
  const completedRef = useRef(0);
  const repRef = useRef<Rep>(blankRep());
  const countdownValueRef = useRef(COUNTDOWN_FROM);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrawRef = useRef(0);
  const lastTenthRef = useRef(-1);

  const tempoRef = useRef(tempo);
  const targetRepsRef = useRef(targetReps);
  const targetSetsRef = useRef(targetSets);
  const fpsRef = useRef(fpsLimit);
  const onRepCompleteRef = useRef(onRepComplete);
  const onPhaseStartRef = useRef(onPhaseStart);
  const onSetCompleteRef = useRef(onSetComplete);
  const onFinishRef = useRef(onFinish);

  const ringRef = useRef<SVGCircleElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const numberRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    tempoRef.current = tempo;
    targetRepsRef.current = targetReps;
    targetSetsRef.current = targetSets;
    fpsRef.current = fpsLimit;
    onRepCompleteRef.current = onRepComplete;
    onPhaseStartRef.current = onPhaseStart;
    onSetCompleteRef.current = onSetComplete;
    onFinishRef.current = onFinish;
  });

  const applyStatus = useCallback((next: TimerStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /* ---------------------------------------------------------------- drawing */

  const drawRing = useCallback((phase: Phase, progress: number) => {
    const circle = ringRef.current;
    if (!circle) return;

    const eased = phase === 'concentric' ? easeInOutCubic(progress) : progress;
    let offset: number;
    switch (phase) {
      case 'concentric':
        offset = RING_LENGTH * (1 - eased);
        break;
      case 'eccentric':
        offset = RING_LENGTH * eased;
        break;
      case 'pause_top':
        offset = 0;
        break;
      case 'pause_bottom':
        offset = RING_LENGTH;
        break;
    }

    circle.style.transition = 'stroke 350ms linear';
    circle.style.strokeDashoffset = offset.toFixed(2);
    // A round cap leaves a visible dot when the dash is empty.
    circle.style.strokeOpacity = offset >= RING_LENGTH - 0.5 ? '0' : '1';
  }, []);

  const drawLabel = useCallback((phase: Phase, progress: number) => {
    const label = labelRef.current;
    if (!label) return;

    let scale = 1;
    let shift = 0;

    if (phase === 'concentric') {
      scale = 1 + 0.5 * progress;
      shift = -15 * progress;
    } else if (phase === 'pause_top') {
      scale = 1.5;
      shift = -15;
    } else if (phase === 'eccentric') {
      scale = 1.5 - 0.5 * progress;
      shift = -15 + 15 * progress;
    }

    label.style.transform = `translateY(${shift.toFixed(2)}px) scale(${scale.toFixed(3)})`;
    label.style.opacity = '1';
  }, []);

  const drawProgress = useCallback((value: number) => {
    const segment = progressRef.current;
    if (!segment) return;
    segment.style.transform = `scaleX(${Math.min(1, Math.max(0, value)).toFixed(4)})`;
  }, []);

  const repFraction = useCallback((phase: Phase, elapsed: number): number => {
    const total = repDuration(tempoRef.current);
    if (total <= 0) return 0;

    let accumulated = 0;
    for (const candidate of PHASES_ORDER) {
      if (candidate === phase) {
        return Math.min(1, (accumulated + elapsed) / total);
      }
      accumulated += phaseTarget(tempoRef.current, candidate);
    }
    return 1;
  }, []);

  const draw = useCallback((phase: Phase, elapsed: number) => {
    const target = phaseTarget(tempoRef.current, phase);
    const progress = target > 0 ? Math.min(elapsed / target, 1) : 1;

    drawRing(phase, progress);
    drawLabel(phase, progress);
    drawProgress((completedRef.current % Math.max(1, targetRepsRef.current)
      + repFraction(phase, elapsed)) / Math.max(1, targetRepsRef.current));

    const tenths = Math.max(0, Math.floor(elapsed * 10));
    if (tenths !== lastTenthRef.current) {
      lastTenthRef.current = tenths;
      if (numberRef.current) numberRef.current.textContent = (tenths / 10).toFixed(1);
    }
  }, [drawLabel, drawProgress, drawRing, repFraction]);

  /* ------------------------------------------------------------- transitions */

  const beginPhase = useCallback((phase: Phase, startTime: number) => {
    phaseRef.current = phase;
    phaseStartRef.current = startTime;
    lastTenthRef.current = -1;
    setCurrentPhase(phase);
    setPhaseKey((key) => key + 1);
    onPhaseStartRef.current?.(phase);
  }, []);

  const recordPhase = useCallback((phase: Phase, duration: number) => {
    const rep = repRef.current;
    switch (phase) {
      case 'concentric':
        rep.concentricDuration = duration;
        break;
      case 'pause_top':
        rep.pauseTopDuration = duration;
        break;
      case 'eccentric':
        rep.eccentricDuration = duration;
        break;
      case 'pause_bottom':
        rep.pauseBottomDuration = duration;
        break;
    }
  }, []);

  const completeRep = useCallback((): boolean => {
    const rep = repRef.current;
    const total = rep.concentricDuration
      + rep.pauseTopDuration
      + rep.eccentricDuration
      + rep.pauseBottomDuration;

    onRepCompleteRef.current({ ...rep, totalDuration: total });
    repRef.current = blankRep();
    completedRef.current += 1;
    const completed = completedRef.current;
    setCompletedReps(completed);

    const circle = ringRef.current;
    const targetTotal = targetRepsRef.current * targetSetsRef.current;

    if (completed >= targetTotal) {
      applyStatus('finished');
      if (circle) {
        circle.style.transition = 'stroke 350ms linear, stroke-dashoffset 500ms ease-out, stroke-opacity 300ms ease-out';
        circle.style.strokeDashoffset = '0';
        circle.style.strokeOpacity = '1';
      }
      onFinishRef.current?.();
      return true;
    }

    if (completed % targetRepsRef.current === 0) {
      applyStatus('setBreak');
      if (circle) {
        circle.style.transition = 'stroke 350ms linear, stroke-dashoffset 400ms ease-out, stroke-opacity 300ms ease-out';
        circle.style.strokeDashoffset = '0';
        circle.style.strokeOpacity = '1';
      }
      onSetCompleteRef.current?.(completed / targetRepsRef.current);
      return true;
    }

    return false;
  }, [applyStatus]);

  const advance = useCallback(() => {
    const phase = phaseRef.current;
    if (!phase) return;

    const duration = phaseTarget(tempoRef.current, phase);
    recordPhase(phase, duration);
    // The next phase starts at the previous boundary, not at this frame, so a
    // late frame never accumulates drift (B8).
    const nextStart = phaseStartRef.current + duration * 1000;

    // A rep ends when its PAUSE (bottom) phase is over, even when that phase
    // has zero length and is skipped below.
    if (phase === 'pause_bottom' && completeRep()) return;

    const index = PHASES_ORDER.indexOf(phase);
    for (let step = 1; step <= PHASES_ORDER.length; step += 1) {
      const candidate = PHASES_ORDER[(index + step) % PHASES_ORDER.length];
      if (phaseTarget(tempoRef.current, candidate) > 0) {
        beginPhase(candidate, nextStart);
        draw(candidate, 0);
        return;
      }
      if (candidate === 'pause_bottom' && completeRep()) return;
    }

    // Unreachable through the UI (LIFT and LOWER are always positive), but do
    // not spin if a malformed tempo has no positive phase at all.
    applyStatus('paused');
  }, [applyStatus, beginPhase, completeRep, draw, recordPhase]);

  /* ------------------------------------------------------------------ loop */

  useEffect(() => {
    if (status !== 'running') return;

    let frame = 0;
    let cancelled = false;
    lastDrawRef.current = 0;

    const step = (now: number) => {
      if (cancelled) return;

      const interval = 1000 / fpsRef.current;
      const sinceLastDraw = now - lastDrawRef.current;
      if (sinceLastDraw < interval - FRAME_TOLERANCE_MS) {
        frame = requestAnimationFrame(step);
        return;
      }
      lastDrawRef.current = now - (sinceLastDraw % interval);

      const phase = phaseRef.current;
      if (!phase) return;

      const elapsed = Math.max(0, (now - phaseStartRef.current) / 1000);
      const target = phaseTarget(tempoRef.current, phase);
      if (target <= 0 || elapsed >= target) {
        advance();
      } else {
        draw(phase, elapsed);
      }

      if (statusRef.current === 'running') {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [advance, draw, status]);

  // Paint the first frame of a phase after its keyed elements have mounted.
  useEffect(() => {
    if (status === 'running' && phaseRef.current) {
      const phase = phaseRef.current;
      const elapsed = Math.max(0, (performance.now() - phaseStartRef.current) / 1000);
      draw(phase, elapsed);
    }
    if (status === 'countdown') {
      // The new rep starts from zero, so show the set's banked reps only.
      drawProgress((completedRef.current % Math.max(1, targetRepsRef.current)) / Math.max(1, targetRepsRef.current));
    }
    if (status === 'paused' && labelRef.current) {
      labelRef.current.style.transform = 'none';
      labelRef.current.style.opacity = '1';
    }
  }, [draw, drawProgress, phaseKey, status]);

  /* -------------------------------------------------------------- countdown */

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearCountdown, [clearCountdown]);

  const runCountdown = useCallback((onComplete: () => void) => {
    clearCountdown();
    countdownValueRef.current = COUNTDOWN_FROM;
    setCountdown(COUNTDOWN_FROM);
    applyStatus('countdown');
    triggerHaptic(20);

    const tick = () => {
      const next = countdownValueRef.current - 1;
      countdownValueRef.current = next;

      if (next <= 0) {
        countdownTimerRef.current = null;
        onComplete();
        return;
      }

      setCountdown(next);
      triggerHaptic(20);
      countdownTimerRef.current = setTimeout(tick, 1000);
    };

    countdownTimerRef.current = setTimeout(tick, 1000);
  }, [applyStatus, clearCountdown]);

  const beginRep = useCallback(() => {
    repRef.current = blankRep();
    applyStatus('running');
    beginPhase('concentric', performance.now());
  }, [applyStatus, beginPhase]);

  const start = useCallback(() => {
    clearCountdown();
    completedRef.current = 0;
    setCompletedReps(0);
    repRef.current = blankRep();
    runCountdown(beginRep);
  }, [beginRep, clearCountdown, runCountdown]);

  const startSet = useCallback(() => {
    if (statusRef.current !== 'setBreak') return;
    repRef.current = blankRep();
    runCountdown(beginRep);
  }, [beginRep, runCountdown]);

  /* ------------------------------------------------------------ pause/reset */

  const pause = useCallback(() => {
    if (statusRef.current !== 'running' && statusRef.current !== 'countdown') return;
    clearCountdown();
    applyStatus('paused');
  }, [applyStatus, clearCountdown]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    // Lead in with the countdown and restart the interrupted rep at LIFT.
    runCountdown(beginRep);
  }, [beginRep, runCountdown]);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'paused') {
      resume();
      return;
    }
    pause();
  }, [pause, resume]);

  const stop = useCallback(() => {
    clearCountdown();
    applyStatus('idle');
    phaseRef.current = null;
    phaseStartRef.current = 0;
    completedRef.current = 0;
    repRef.current = blankRep();
    lastTenthRef.current = -1;
    countdownValueRef.current = COUNTDOWN_FROM;
    setCurrentPhase(null);
    setCompletedReps(0);
    setCountdown(COUNTDOWN_FROM);
    setPhaseKey((key) => key + 1);
  }, [applyStatus, clearCountdown]);

  // Auto-pause when the tab is backgrounded; the clock runs on outside rAF.
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pauseRef.current();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const isLive = status === 'countdown' || status === 'running' || status === 'paused' || status === 'setBreak';
  const currentSet = Math.min(Math.floor(completedReps / Math.max(1, targetReps)) + 1, targetSets);
  const currentRep = status === 'finished' ? targetReps : (completedReps % Math.max(1, targetReps)) + 1;

  return {
    status,
    currentPhase,
    phaseKey,
    countdown,
    completedReps,
    currentSet,
    currentRep,
    isLive,
    ringRef,
    labelRef,
    numberRef,
    progressRef,
    start,
    startSet,
    pause,
    resume,
    togglePause,
    stop
  };
}
