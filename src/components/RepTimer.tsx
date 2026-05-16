import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, ChevronRight, Info, CheckCircle2, Maximize, Minimize } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Phase, Rep, WorkoutSession } from '../types';
import { cn } from '../lib/utils';

interface RepTimerProps {
  key?: React.Key;
  onRepComplete: (rep: Rep) => void;
  targetTempo: WorkoutSession['targetTempo'];
  targetReps?: number;
  targetSets?: number;
  currentRepCount?: number;
  currentSet?: number;
  totalRepsCompleted?: number;
  isFinished?: boolean;
  isPaused?: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  seamlessTransitions?: boolean;
  onProgressUpdate?: (progress: number) => void;
  currentRepProgress?: number;
}

export default function RepTimer({ 
  onRepComplete, 
  targetTempo, 
  targetReps = 12, 
  targetSets = 3,
  currentRepCount = 1, 
  currentSet = 1,
  totalRepsCompleted = 0,
  isFinished = false,
  isPaused = false,
  onTogglePause,
  onReset,
  seamlessTransitions = false,
  onProgressUpdate,
  currentRepProgress = 0
}: RepTimerProps) {
  const [isActive, setIsActive] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [currentPhase, setCurrentPhase] = useState<Phase | null>(null);
  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const wakeLockRef = useRef<any>(null);
  
  const currentRepRef = useRef<Partial<Rep>>({});
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        // Only log if it's not a policy error (to avoid console spam in restricted environments)
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (!errorMsg.toLowerCase().includes('permissions policy') && !errorMsg.toLowerCase().includes('not allowed')) {
          console.error('Wake Lock failed:', err);
        }
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error('Wake Lock release failed:', err);
      }
    }
  };

  // Wake Lock management
  useEffect(() => {
    if (isActive && !isPaused) {
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          await requestWakeLock();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        releaseWakeLock();
      };
    } else {
      releaseWakeLock();
    }
  }, [isActive, isPaused]);

  const getTargetForPhase = useCallback((phase: Phase) => {
    switch (phase) {
      case 'eccentric': return targetTempo.eccentric;
      case 'pause_bottom': return targetTempo.pauseBottom;
      case 'concentric': return targetTempo.concentric;
      case 'pause_top': return targetTempo.pauseTop;
    }
  }, [targetTempo]);

  // Handle pause/resume sync
  useEffect(() => {
    if (!isPaused && isActive && phaseStartTime !== null && currentPhase) {
      // Adjust phaseStartTime to account for the time spent paused
      setPhaseStartTime(Date.now() - (elapsed * 1000));
    }
  }, [isPaused]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    
    const handleActivity = () => {
      setIsControlsVisible(true);
      clearTimeout(idleTimer);
      if (!isPaused) {
        idleTimer = setTimeout(() => setIsControlsVisible(false), 10000);
      }
    };

    handleActivity(); // Initial start
    
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'];
    events.forEach(e => document.addEventListener(e, handleActivity));
    
    return () => {
      clearTimeout(idleTimer);
      events.forEach(e => document.removeEventListener(e, handleActivity));
    };
  }, [isPaused]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && window.history.state?.fullscreen) {
        window.history.back();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        window.history.pushState({ fullscreen: true }, '');
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (isFinished && isActive) {
      stopTimer();
    }
  }, [isFinished, isActive]);

  useEffect(() => {
    if (isFinished) {
      // Calculate workout difficulty (total time in seconds) to scale confetti
      const repDuration = targetTempo.concentric + targetTempo.pauseTop + (targetTempo.eccentric || 0) + (targetTempo.pauseBottom || 0);
      const totalSessionSeconds = repDuration * targetReps * targetSets;
      
      // Base: 100 particles. Max: 400 particles.
      const particles = Math.min(400, Math.max(100, Math.floor(totalSessionSeconds * 0.5)));

      confetti({
        particleCount: particles,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ffffff', '#cbd5e1', '#94a3b8', '#64748b']
      });
    }
  }, [isFinished, targetTempo, targetReps, targetSets]);

  const startTimer = () => {
    setIsCountingDown(true);
    setCountdown(3);
    // Request wake lock early on user gesture
    requestWakeLock();
  };

  const stopTimer = () => {
    setIsActive(false);
    setIsCountingDown(false);
    setCurrentPhase(null);
    setPhaseStartTime(null);
    setElapsed(0);
    if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    onReset();
  };

  const nextPhase = useCallback(() => {
    if (!currentPhase || !phaseStartTime) return;

    const duration = (Date.now() - phaseStartTime) / 1000;
    const rep = currentRepRef.current;
    
    let nextPhaseTarget: Phase = 'concentric';

    switch (currentPhase) {
      case 'concentric':
        rep.concentricDuration = duration;
        nextPhaseTarget = 'pause_top';
        break;
      case 'pause_top':
        rep.pauseTopDuration = duration;
        nextPhaseTarget = 'eccentric';
        break;
      case 'eccentric':
        rep.eccentricDuration = duration;
        nextPhaseTarget = 'pause_bottom';
        break;
      case 'pause_bottom':
        rep.pauseBottomDuration = duration;
        const completeRep: Rep = {
          ...rep as Rep,
          totalDuration: (rep.concentricDuration || 0) + 
                         (rep.pauseTopDuration || 0) + 
                         (rep.eccentricDuration || 0) + 
                         duration
        };
        onRepComplete(completeRep);

        // Start next rep automatically
        currentRepRef.current = { 
          id: crypto.randomUUID(), 
          timestamp: Date.now(),
          eccentricDuration: 0,
          concentricDuration: 0,
          pauseTopDuration: 0,
          pauseBottomDuration: 0,
          totalDuration: 0
        };
        nextPhaseTarget = 'concentric';
        break;
    }
    
    setCurrentPhase(nextPhaseTarget);
    setPhaseStartTime(Date.now());
    setElapsed(0);
  }, [currentPhase, phaseStartTime, onRepComplete, getTargetForPhase]);

  // Countdown effect
  useEffect(() => {
    if (isCountingDown && !isPaused) {
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsCountingDown(false);
            setIsActive(true);
            setCurrentPhase('concentric');
            setPhaseStartTime(Date.now());
            
            currentRepRef.current = { 
              id: crypto.randomUUID(), 
              timestamp: Date.now(),
              eccentricDuration: 0,
              concentricDuration: 0,
              pauseTopDuration: 0,
              pauseBottomDuration: 0,
              totalDuration: 0
            };
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isCountingDown, isPaused]);

  useEffect(() => {
    if (isActive && phaseStartTime && currentPhase && !isPaused) {
      const update = () => {
        const now = Date.now();
        const currentElapsed = Math.max(0, (now - phaseStartTime) / 1000);
        setElapsed(currentElapsed);
        
        if (onProgressUpdate) {
          const eccentric = targetTempo.eccentric || 0;
          const pauseBottom = targetTempo.pauseBottom || 0;
          const concentric = targetTempo.concentric || 0;
          const pauseTop = targetTempo.pauseTop || 0;
          const totalRepTargetTime = eccentric + pauseBottom + concentric + pauseTop;
          
          const getAccumulatedTime = (p: Phase) => {
            let acc = 0;
            const phasesOrdered: Phase[] = ['concentric', 'pause_top', 'eccentric', 'pause_bottom'];
            for (const ph of phasesOrdered) {
              if (ph === p) break;
              acc += getTargetForPhase(ph);
            }
            return acc;
          };

          const accumulated = getAccumulatedTime(currentPhase);
          const repProgress = totalRepTargetTime > 0 ? (accumulated + currentElapsed) / totalRepTargetTime : 0;
          onProgressUpdate(Math.min(0.99, repProgress));
        }

        const target = getTargetForPhase(currentPhase);
        if (target === 0 || currentElapsed >= target) {
          nextPhase();
        }
        
        timerRef.current = window.requestAnimationFrame(update);
      };
      timerRef.current = window.requestAnimationFrame(update);
    } else {
      if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    }
    return () => {
      if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    };
  }, [isActive, phaseStartTime, currentPhase, nextPhase, isPaused]);

  const getPhaseLabel = (phase: Phase) => {
    switch (phase) {
      case 'eccentric': return 'LOWER';
      case 'pause_bottom': return 'PAUSE';
      case 'concentric': return 'LIFT';
      case 'pause_top': return 'HOLD';
    }
  };

  const getRingState = () => {
    if (isFinished) {
      return { offset: 0, color: "#22c55e", bgStart: "#22c55e", bgEnd: "#10b981" };
    }
    if (isCountingDown) {
      return { offset: 1244, color: "#fb923c", bgStart: "#fb923c", bgEnd: "#f97316" };
    }
    if (!currentPhase) return { offset: 1244, color: "var(--color-sleek-muted)", bgStart: "#262626", bgEnd: "#171717" };
    
    const target = getTargetForPhase(currentPhase);
    const rawProgress = target > 0 ? Math.min(elapsed / target, 1) : 1;
    
    // Smooth ease-in-out cubic function for a dynamic, energetic acceleration
    const progress = rawProgress < 0.5 
      ? 4 * rawProgress * rawProgress * rawProgress 
      : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;
    
    switch (currentPhase) {
      case 'concentric':
        // Up: Loads clockwise (0% -> 100%)
        return { 
          offset: 1244 * (1 - progress), 
          color: "#fb923c", // Brighter Orange
          bgStart: "#fb923c",
          bgEnd: "#f97316" 
        };
      case 'pause_top':
        return { 
          offset: 0, 
          color: "#ef4444", // Red
          bgStart: "#ef4444",
          bgEnd: "#e11d48" // Slight shift to rose
        };
      case 'eccentric':
        // Down: Unloads counter-clockwise (100% -> 0%)
        return { 
          offset: 1244 * progress, 
          color: "#eab308", // Yellow
          bgStart: "#eab308",
          bgEnd: "#d97706" // Slight shift to amber
        };
      case 'pause_bottom':
        return { 
          offset: 1244, 
          color: "#22c55e", // Green
          bgStart: "#22c55e",
          bgEnd: "#10b981" // Slight shift to emerald
        };
      default:
        return { offset: 1244, color: "var(--color-sleek-muted)", bgStart: "#262626", bgEnd: "#171717" };
    }
  };

  const currentPhaseTarget = currentPhase ? getTargetForPhase(currentPhase) : 1;
  const phaseProgress = (currentPhase && currentPhaseTarget > 0) ? Math.min(elapsed / currentPhaseTarget, 1) : 1;
  
  const ringState = getRingState();

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col items-center justify-between p-6 sm:p-8 bg-sleek-card border border-sleek-border shadow-2xl w-full h-full min-h-[450px] sm:min-h-[550px] relative overflow-hidden",
        isFullscreen && "border-none"
      )}
    >
      
      {/* Real-time Background Gradient layers for hardware acceleration */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[#171717]" />
      
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        initial={false}
        animate={{
          background: `linear-gradient(135deg, ${ringState.bgStart} 0%, ${ringState.bgEnd} 100%)`,
          opacity: (!isPaused && (isActive || isCountingDown || isFinished)) ? 1 : 0,
        }}
        transition={{ 
          opacity: { duration: seamlessTransitions ? 1.2 : 0.4, ease: "linear" },
          background: { duration: seamlessTransitions ? 1.2 : 0.4, ease: "linear" }
        }}
        style={{ willChange: 'opacity, background' }}
      />
      
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        animate={{
          filter: `brightness(${Math.min(1.25, 1 + (((currentSet - 1) * targetReps + (currentRepCount - 1)) * 0.01))})`
        }}
        transition={{ duration: 0.4 }}
      />
      
      {/* Dark Overlay to ensure circle visibility */}
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />

      {/* Fullscreen Toggle Button - Unified */}
      <button
        onClick={toggleFullscreen}
        className={cn(
          "absolute sm:top-6 sm:right-6 sm:bottom-auto bottom-0 right-0 z-30 p-2 bg-white/5 border border-white/10 text-sleek-muted hover:text-sleek-text transition-all duration-300",
          (!isControlsVisible && (isActive || isCountingDown) && !isPaused) && "opacity-0 pointer-events-none"
        )}
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
      
      {/* Top: Rep Counter */}
      <div className="h-12 flex items-center justify-center w-full z-20">
        <div 
          className={cn(
            "relative overflow-hidden px-4 sm:px-8 py-2 sm:py-4 border transition-all duration-1000 text-base sm:text-lg font-medium flex items-center gap-3 sm:gap-4",
            (isActive || isCountingDown) ? "bg-[#1d1d1d] border-[#38393a] border-[3px] text-white" : "bg-white/5 border-sleek-border"
          )}
        >
          {/* Session Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 flex gap-[1px] bg-white/5">
            {Array.from({ length: targetSets }).map((_, i) => {
              const currentRepsInSession = totalRepsCompleted;
              const setStartRepIdx = i * targetReps;
              const repsCompletedInThisSet = Math.max(0, Math.min(targetReps, currentRepsInSession - setStartRepIdx));
              let progress = repsCompletedInThisSet / targetReps;
              
              const isCurrentSet = Math.floor(currentRepsInSession / targetReps) === i;
              if (isCurrentSet && !isFinished && isActive) {
                progress += currentRepProgress / targetReps;
              }

              return (
                <div key={i} className="flex-1 bg-white/10 relative overflow-hidden">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-sleek-up"
                    initial={false}
                    animate={{ width: `${Math.min(100, progress * 100)}%` }}
                    transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            Rep 
            <motion.span 
              key={currentRepCount}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn("font-bold inline-block ml-1", (isActive || isCountingDown) ? "text-white" : "text-sleek-text")}
            >
              {currentRepCount.toString().padStart(2, '0')}
            </motion.span> 
            <span className={(isActive || isCountingDown) ? "text-white/60" : "text-sleek-muted"}>/ {targetReps}</span>
          </div>
          <div className={cn("w-px h-10 sm:h-4 flex-shrink-0", (isActive || isCountingDown) ? "bg-white/20" : "bg-sleek-border")} />
          <div className="flex items-center gap-1">
            Set 
            <motion.span 
              key={currentSet}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn("font-bold inline-block ml-1", (isActive || isCountingDown) ? "text-white" : "text-sleek-text")}
            >
              {currentSet}
            </motion.span> 
            <span className={(isActive || isCountingDown) ? "text-white/60" : "text-sleek-muted"}>/ {targetSets}</span>
          </div>
        </div>
      </div>

      {/* Middle: Circle + Timer */}
      <div className="relative flex items-center justify-center w-[min(calc(85vw-10px),340px)] h-[min(calc(85vw-10px),340px)] my-6 sm:my-8 z-10">
        <div 
          className={cn(
            "absolute inset-0 transition-all duration-1000 backdrop-blur-md rounded-full z-0",
            (isActive || isCountingDown) ? "bg-[#1d1d1d]" : "bg-[#252729]/80"
          )} 
        />
        <div className="absolute inset-0 border-4 border-white/10 rounded-full z-0" />
        
        {/* Phase Transition Ripple */}
        <AnimatePresence>
          {isActive && !isPaused && phaseStartTime && (
            <motion.div
              key={`ripple-${phaseStartTime}`}
              initial={{ opacity: 0.8, scale: 0.95, borderColor: ringState.color, borderWidth: 8 }}
              animate={{ opacity: 0, scale: 2.8, borderWidth: 2 }}
              transition={{ 
                duration: 0.6, 
                ease: [0.22, 1, 0.36, 1] // easeOutQuart: snappier start, smoother finish
              }}
              className="absolute inset-0 rounded-full pointer-events-none z-0 will-change-[transform,opacity,border-width]"
              style={{ borderStyle: 'solid' }}
            />
          )}
        </AnimatePresence>

        {(isActive || isCountingDown || isFinished) && (
          <svg 
            className="absolute inset-0 w-full h-full -rotate-90 z-10 pointer-events-none" 
            viewBox="0 0 400 400"
          >
              <motion.circle
                cx="200"
                cy="200"
                r="198"
                fill="none"
                strokeWidth="6"
                strokeDasharray="1244"
                strokeDashoffset={ringState.offset}
                initial={{ stroke: ringState.color }}
                animate={{ stroke: ringState.color }}
                transition={{ 
                  stroke: { duration: 0.35, ease: "linear" },
                  strokeDashoffset: { duration: 0 } // Important: dashoffset is handled by RAF, but we want zero animation interference
                }}
                strokeLinecap="round"
                className="will-change-[stroke-dashoffset,stroke]"
              />
          </svg>
        )}

        {/* Timer Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <AnimatePresence mode="wait">
            {isFinished ? (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="absolute text-sleek-text uppercase tracking-[4px] text-[10px] sm:text-xs -translate-y-[3.5rem] sm:-translate-y-[4.5rem] font-bold whitespace-nowrap">WORKOUT COMPLETE</div>
                <div className="text-[50px] sm:text-[70px] font-black leading-none text-sleek-text relative">
                  FINISH!
                </div>
              </motion.div>
            ) : isCountingDown ? (
              <motion.div
                key={`countdown-${countdown}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 1.5, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="absolute text-sleek-muted uppercase tracking-[4px] text-sm -translate-y-[4rem] sm:-translate-y-[5.5rem] whitespace-nowrap">GET READY</div>
                <div className="text-[100px] sm:text-[140px] font-black leading-none text-sleek-text tabular-nums text-center w-full">
                  {countdown}
                </div>
              </motion.div>
            ) : !isActive ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="absolute text-sleek-muted uppercase tracking-[2px] sm:tracking-[4px] text-xs sm:text-sm -translate-y-[4rem] sm:-translate-y-[5.5rem] whitespace-nowrap">READY TO START</div>
                <div className="text-6xl sm:text-[90px] font-extrabold leading-none text-sleek-text tabular-nums relative">00.0</div>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div 
                  key={`label-${phaseStartTime}`}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute -translate-y-[4rem] sm:-translate-y-[5.5rem] whitespace-nowrap"
                >
                  <motion.div 
                    className="text-sleek-text uppercase tracking-[2px] sm:tracking-[4px] text-sm sm:text-base font-black origin-bottom inline-block will-change-transform antialiased"
                    animate={
                      isPaused ? { scale: 1, y: 0 } :
                      !currentPhase || currentPhaseTarget <= 0 ? { scale: 1, y: 0 } :
                      currentPhase === 'concentric' ? { scale: 1 + 0.5 * phaseProgress, y: -15 * phaseProgress } :
                      currentPhase === 'pause_top' ? { scale: 1.5, y: -15 } :
                      currentPhase === 'eccentric' ? { scale: 1.5 - 0.5 * phaseProgress, y: -15 + 15 * phaseProgress } :
                      { scale: 1, y: 0 }
                    }
                    transition={{ type: "spring", stiffness: 300, damping: 25, mass: 1 }}
                  >
                    <div
                      style={{
                        transform: currentPhase === 'pause_top' && !isPaused
                          ? `translate(${Math.sin(elapsed * 20) * 1}px, ${Math.cos(elapsed * 18) * 1}px)`
                          : 'none'
                      }}
                    >
                      {isPaused ? 'SESSION PAUSED' : (currentPhase && getPhaseLabel(currentPhase))}
                    </div>
                  </motion.div>
                </motion.div>
                <div 
                  className={cn(
                    "tabular-nums transition-colors duration-300 relative text-8xl sm:text-[100px] font-extrabold leading-none",
                    isPaused ? "text-sleek-muted" : ""
                  )}
                  style={{ color: !isPaused ? ringState.color : undefined }}
                >
                  {elapsed.toFixed(1)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: Controls */}
      <div className="relative h-16 flex items-center justify-center w-full z-20">
        {isFinished ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 sm:gap-3 bg-sleek-card border border-sleek-border text-sleek-text px-6 sm:px-10 py-3 sm:py-4 font-bold text-sm sm:text-base"
          >
            <CheckCircle2 size={18} className="sm:w-5 sm:h-5 text-sleek-text" />
            SESSION COMPLETE
          </motion.div>
        ) : (
          <div className="flex w-full max-w-[240px] sm:max-w-[380px] h-full gap-0">
            {isPaused && (isActive || isCountingDown) ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={stopTimer}
                  className={cn(
                    "w-1/4 flex items-center justify-center bg-[#1d1d1d] border-[#38393a] border-[3px] text-white",
                    (!isControlsVisible && (isActive || isCountingDown) && !isPaused) && "opacity-0 pointer-events-none"
                  )}
                >
                  <Square size={20} fill="currentColor" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onTogglePause}
                  className={cn(
                    "w-3/4 flex items-center justify-center gap-2 bg-[#1d1d1d] border-[#38393a] border-[3px] border-l-0 text-white font-bold text-sm sm:text-base",
                    (!isControlsVisible && (isActive || isCountingDown) && !isPaused) && "opacity-0 pointer-events-none"
                  )}
                >
                  <Play size={18} fill="currentColor" />
                  RESUME
                </motion.button>
              </>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={(isActive || isCountingDown) ? onTogglePause : startTimer}
                className={cn(
                  "w-full flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-10 py-3 sm:py-4 font-bold text-sm sm:text-base border",
                  (isActive || isCountingDown) 
                    ? "bg-[#1d1d1d] border-[#38393a] border-[3px] text-white" 
                    : "bg-sleek-up border-transparent text-black shadow-[0_0_30px_rgba(255,255,255,0.3)]",
                  (!isControlsVisible && (isActive || isCountingDown) && !isPaused) && "opacity-0 pointer-events-none"
                )}
              >
                {(isActive || isCountingDown) ? (
                  <>
                    <Pause size={18} fill="currentColor" className="sm:w-5 sm:h-5" />
                    <span>PAUSE SESSION</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" className="sm:w-5 sm:h-5" />
                    <span>START SESSION</span>
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
