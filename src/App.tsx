import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Smartphone } from 'lucide-react';
import RepTimer from './components/RepTimer';
import TempoSettings from './components/TempoSettings';
import { Rep, WorkoutSession, FpsLimit } from './types';
import { cn, triggerHaptic } from './lib/utils';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [seamlessTransitions, setSeamlessTransitions] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [targetReps, setTargetReps] = useState(12);
  const [targetSets, setTargetSets] = useState(3);
  const [fpsLimit, setFpsLimit] = useState<FpsLimit>(40);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const [session, setSession] = useState<WorkoutSession>({
    id: crypto.randomUUID(),
    exerciseName: 'Custom Exercise',
    startTime: Date.now(),
    reps: [],
    targetTempo: {
      eccentric: 2,
      pauseBottom: 1,
      concentric: 3,
      pauseTop: 1
    }
  });

  // Query navigator.getBattery() for browser support
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const checkBattery = () => {
          setBatteryCharging(battery.charging);
          setBatteryLevel(battery.level);
        };
        checkBattery();
        battery.addEventListener('levelchange', checkBattery);
        battery.addEventListener('chargingchange', checkBattery);
        return () => {
          battery.removeEventListener('levelchange', checkBattery);
          battery.removeEventListener('chargingchange', checkBattery);
        };
      }).catch(() => {});
    }
  }, []);

  const totalRepsCompleted = session.reps.length;
  const isFinished = totalRepsCompleted >= targetReps * targetSets;
  const currentSet = Math.min(Math.floor(totalRepsCompleted / targetReps) + 1, targetSets);
  const currentRepInSet = isFinished ? targetReps : (totalRepsCompleted % targetReps) + 1;

  const handleRepComplete = (rep: Rep) => {
    setSession(prev => ({
      ...prev,
      reps: [...prev.reps, rep]
    }));
  };

  const handleApplyTempo = (tempo: WorkoutSession['targetTempo']) => {
    setSession(prev => ({
      ...prev,
      targetTempo: tempo
    }));
  };

  const handleReset = () => {
    triggerHaptic(30); // Heavy physical vibe on reset
    setSession(prev => ({
      ...prev,
      id: crypto.randomUUID(),
      startTime: Date.now(),
      reps: []
    }));
    setIsPaused(false);
  };

  const togglePause = () => {
    triggerHaptic(15);
    setIsPaused(!isPaused);
  };

  const controlsRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    triggerHaptic(10);
    controlsRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <div className="min-h-screen bg-sleek-bg text-sleek-text font-sans selection:bg-sleek-up selection:text-sleek-bg overflow-x-hidden">
      
      {/* Portrait Orientation Overlay Wrapper */}
      <div className="fixed inset-0 z-[99999] bg-sleek-bg flex-col items-center justify-center p-6 text-center hidden [@media(orientation:landscape)_and_(max-height:600px)]:flex">
        <Smartphone size={48} className="text-sleek-muted animate-pulse mb-4 rotate-90" />
        <h2 className="text-xl font-bold mb-2">Please rotate your device</h2>
        <p className="text-sleek-muted text-sm max-w-xs">TempoTrack is designed to be used in portrait mode for the best experience.</p>
      </div>

      {/* Above the Fold (100dvh guarantees it fits mobile/tablet viewports even with browser UI) */}
      <div className="h-[100dvh] w-full flex flex-col">
        {/* Main UI Element (90% of screen height) */}
        <main className="h-[90%] w-full p-2.5 sm:pt-[25px] sm:px-[25px] sm:pb-[30px]">
          <div className="w-full h-full max-w-full mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full h-full"
            >
              <RepTimer 
                key={session.id}
                onRepComplete={handleRepComplete} 
                targetTempo={session.targetTempo} 
                targetReps={targetReps}
                targetSets={targetSets}
                currentRepCount={currentRepInSet}
                currentSet={currentSet}
                totalRepsCompleted={totalRepsCompleted}
                isFinished={isFinished}
                isPaused={isPaused}
                onTogglePause={togglePause}
                onReset={handleReset}
                seamlessTransitions={seamlessTransitions}
                fpsLimit={fpsLimit}
              />
            </motion.div>
          </div>
        </main>

        {/* Nudge Divider (10% of screen height) */}
        <div className="h-[10%] w-full flex flex-col items-center justify-end pb-4 relative z-40">
          <button 
            onClick={scrollToBottom}
            className="flex flex-col items-center gap-1 text-sleek-muted hover:text-sleek-up transition-colors cursor-pointer group"
            aria-label="Scroll to configuration"
          >
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-50 group-hover:opacity-100 transition-opacity">Configure</span>
            <ChevronDown size={20} className="animate-bounce" />
          </button>
        </div>
      </div>

      {/* Controls Bar (Below the fold) */}
      <div 
        ref={controlsRef}
        className="px-4 sm:px-10 py-12 border-t border-sleek-border flex flex-col items-center bg-sleek-bg relative z-50 gap-8"
      >
        {/* Row: Reps/Sets centered */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 w-full">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-sleek-muted uppercase tracking-widest font-bold">Target Reps</span>
            <div className="flex items-center gap-3 bg-sleek-card border border-sleek-border px-3 py-1.5">
              <button onClick={() => { triggerHaptic(10); setTargetReps(Math.max(1, targetReps - 1)); }} className="text-sleek-muted hover:text-sleek-up transition-colors px-1 cursor-pointer">-</button>
              <span className="font-bold text-sm tabular-nums w-6 text-center">{targetReps}</span>
              <button onClick={() => { triggerHaptic(10); setTargetReps(Math.min(50, targetReps + 1)); }} className="text-sleek-muted hover:text-sleek-up transition-colors px-1 cursor-pointer">+</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-sleek-muted uppercase tracking-widest font-bold">Target Sets</span>
            <div className="flex items-center gap-3 bg-sleek-card border border-sleek-border px-3 py-1.5">
              <button onClick={() => { triggerHaptic(10); setTargetSets(Math.max(1, targetSets - 1)); }} className="text-sleek-muted hover:text-sleek-up transition-colors px-1 cursor-pointer">-</button>
              <span className="font-bold text-sm tabular-nums w-6 text-center">{targetSets}</span>
              <button onClick={() => { triggerHaptic(10); setTargetSets(Math.min(20, targetSets + 1)); }} className="text-sleek-muted hover:text-sleek-up transition-colors px-1 cursor-pointer">+</button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full max-w-sm h-px bg-sleek-border opacity-30" />

        {/* Timings button */}
        <button 
          onClick={() => { triggerHaptic(15); setIsSettingsOpen(true); }}
          className="text-xs sm:text-sm font-bold text-sleek-muted hover:text-sleek-up uppercase tracking-widest transition-colors flex items-center gap-2 border border-sleek-border px-10 py-3 bg-sleek-card/50 shadow-sm cursor-pointer"
        >
          CHANGE TIMINGS
        </button>
      </div>

      <TempoSettings 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        tempo={session.targetTempo}
        onUpdateTempo={handleApplyTempo}
        seamlessTransitions={seamlessTransitions}
        onToggleSeamless={() => setSeamlessTransitions(!seamlessTransitions)}
        fpsLimit={fpsLimit}
        onChangeFps={(fps) => {
          triggerHaptic(20);
          setFpsLimit(fps);
        }}
        batteryCharging={batteryCharging}
        batteryLevel={batteryLevel}
      />
    </div>
  );
}
