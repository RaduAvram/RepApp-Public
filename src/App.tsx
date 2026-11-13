import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import RepTimer from './components/RepTimer';
import TempoSettings from './components/TempoSettings';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';
import type { FpsLimit, Rep, Tempo, WorkoutSession } from './types';
import { cn, newId, triggerHaptic } from './lib/utils';
import { loadSettings, saveSettings } from './lib/storage';

interface BatteryLike {
  charging: boolean;
  level: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface BatteryNavigator {
  getBattery?: () => Promise<BatteryLike>;
}

export default function App() {
  const [initialSettings] = useState(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [seamlessTransitions, setSeamlessTransitions] = useState(initialSettings.seamlessTransitions);
  const [targetReps, setTargetReps] = useState(initialSettings.reps);
  const [targetSets, setTargetSets] = useState(initialSettings.sets);
  const [fpsLimit, setFpsLimit] = useState<FpsLimit>(initialSettings.fpsLimit);
  const [soundEnabled, setSoundEnabled] = useState(initialSettings.sound);
  const [isSessionLive, setIsSessionLive] = useState(false);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const [session, setSession] = useState<WorkoutSession>(() => ({
    id: newId(),
    reps: [],
    targetTempo: { ...initialSettings.tempo }
  }));

  // Persist every user-facing setting so a reload restores the session setup (D2).
  useEffect(() => {
    saveSettings({
      reps: targetReps,
      sets: targetSets,
      tempo: session.targetTempo,
      seamlessTransitions,
      fpsLimit,
      sound: soundEnabled
    });
  }, [targetReps, targetSets, session.targetTempo, seamlessTransitions, fpsLimit, soundEnabled]);

  // Battery status, when the browser exposes it.
  useEffect(() => {
    let isMounted = true;
    let batteryObj: BatteryLike | null = null;

    const checkBattery = () => {
      if (batteryObj && isMounted) {
        setBatteryCharging(batteryObj.charging);
        setBatteryLevel(batteryObj.level);
      }
    };

    const getBattery = (navigator as Navigator & BatteryNavigator).getBattery;
    if (typeof navigator !== 'undefined' && typeof getBattery === 'function') {
      getBattery.call(navigator).then((battery) => {
        if (!isMounted) return;
        batteryObj = battery;
        checkBattery();
        battery.addEventListener('levelchange', checkBattery);
        battery.addEventListener('chargingchange', checkBattery);
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', checkBattery);
        batteryObj.removeEventListener('chargingchange', checkBattery);
      }
    };
  }, []);

  const handleRepComplete = useCallback((rep: Rep) => {
    setSession((prev) => ({
      ...prev,
      reps: [...prev.reps, rep]
    }));
  }, []);

  const handleApplyTempo = useCallback((tempo: Tempo) => {
    setSession((prev) => ({
      ...prev,
      targetTempo: tempo
    }));
  }, []);

  const handleReset = useCallback(() => {
    setIsSessionLive(false);
    setSession((prev) => ({
      ...prev,
      id: newId(),
      reps: []
    }));
  }, []);

  const controlsRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    triggerHaptic(10);
    controlsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleToggleSeamless = useCallback(() => {
    setSeamlessTransitions((prev) => !prev);
  }, []);

  const handleChangeFps = useCallback((fps: FpsLimit) => {
    setFpsLimit(fps);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  const adjustReps = useCallback((delta: number) => {
    triggerHaptic(10);
    setTargetReps((prev) => Math.min(50, Math.max(1, prev + delta)));
  }, []);

  const adjustSets = useCallback((delta: number) => {
    triggerHaptic(10);
    setTargetSets((prev) => Math.min(20, Math.max(1, prev + delta)));
  }, []);

  const stepperClass = cn(
    'flex h-11 w-11 items-center justify-center transition-colors',
    isSessionLive
      ? 'text-sleek-muted/30 cursor-not-allowed'
      : 'text-sleek-muted hover:text-sleek-up cursor-pointer'
  );

  return (
    <div className="min-h-screen bg-sleek-bg text-sleek-text font-sans selection:bg-sleek-up selection:text-sleek-bg overflow-x-hidden">

      <RotateDeviceOverlay className="fixed inset-0 z-[99999]" />

      {/* Above the Fold (100dvh guarantees it fits mobile/tablet viewports even with browser UI) */}
      <div className="h-[100dvh] w-full flex flex-col">
        {/* Main UI Element (90% of screen height) */}
        <main className="h-[90%] w-full p-2.5 sm:pt-[25px] sm:px-[25px] sm:pb-[30px]">
          <div className="w-full h-full max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full h-full"
            >
              <RepTimer
                key={session.id}
                onRepComplete={handleRepComplete}
                targetTempo={session.targetTempo}
                targetReps={targetReps}
                targetSets={targetSets}
                reps={session.reps}
                onReset={handleReset}
                onRunningChange={setIsSessionLive}
                seamlessTransitions={seamlessTransitions}
                fpsLimit={fpsLimit}
                soundEnabled={soundEnabled}
                onToggleSound={handleToggleSound}
                isTimingsOpen={isSettingsOpen}
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
            <span className="text-[11px] uppercase tracking-widest font-bold opacity-50 group-hover:opacity-100 transition-opacity">
              Configure
            </span>
            <ChevronDown size={20} className="animate-bounce-three" />
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
            <span className="text-[11px] text-sleek-muted uppercase tracking-widest font-bold">Target Reps</span>
            <div className="flex items-center gap-1 bg-sleek-card border border-sleek-border px-1 py-1">
              <button
                onClick={() => adjustReps(-1)}
                disabled={isSessionLive}
                aria-label="Decrease target reps"
                className={stepperClass}
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-sm tabular-nums w-6 text-center">{targetReps}</span>
              <button
                onClick={() => adjustReps(1)}
                disabled={isSessionLive}
                aria-label="Increase target reps"
                className={stepperClass}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-sleek-muted uppercase tracking-widest font-bold">Target Sets</span>
            <div className="flex items-center gap-1 bg-sleek-card border border-sleek-border px-1 py-1">
              <button
                onClick={() => adjustSets(-1)}
                disabled={isSessionLive}
                aria-label="Decrease target sets"
                className={stepperClass}
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-sm tabular-nums w-6 text-center">{targetSets}</span>
              <button
                onClick={() => adjustSets(1)}
                disabled={isSessionLive}
                aria-label="Increase target sets"
                className={stepperClass}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {isSessionLive && (
          <p className="text-[11px] text-sleek-muted/70 uppercase tracking-widest font-bold -mt-4">
            Reps and sets are locked while a session is running
          </p>
        )}

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
        onClose={handleCloseSettings}
        tempo={session.targetTempo}
        onUpdateTempo={handleApplyTempo}
        seamlessTransitions={seamlessTransitions}
        onToggleSeamless={handleToggleSeamless}
        fpsLimit={fpsLimit}
        onChangeFps={handleChangeFps}
        batteryCharging={batteryCharging}
        batteryLevel={batteryLevel}
      />
    </div>
  );
}
