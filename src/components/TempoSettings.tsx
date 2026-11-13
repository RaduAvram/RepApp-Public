import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Battery,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  ExternalLink,
  History,
  Pin,
  Trash2
} from 'lucide-react';
import type { FpsLimit, SavedTempo, Tempo } from '../types';
import { cn, newId, triggerHaptic } from '../lib/utils';
import {
  capHistory,
  formatHistoryTimestamp,
  loadHistory,
  sameTempo,
  saveHistory
} from '../lib/storage';
import { PHASES_ORDER, PHASE_META } from '../lib/phases';

const FPS_OPTIONS: readonly FpsLimit[] = [30, 60, 120];

interface TempoSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  tempo: Tempo;
  onUpdateTempo: (tempo: Tempo) => void;
  seamlessTransitions: boolean;
  onToggleSeamless: () => void;
  fpsLimit: FpsLimit;
  onChangeFps: (fps: FpsLimit) => void;
  batteryCharging: boolean;
  batteryLevel: number | null;
}

export default function TempoSettings({
  isOpen,
  onClose,
  tempo,
  onUpdateTempo,
  seamlessTransitions,
  onToggleSeamless,
  fpsLimit,
  onChangeFps,
  batteryCharging,
  batteryLevel
}: TempoSettingsProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedTempos, setSavedTempos] = useState<SavedTempo[]>(loadHistory);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedTempoRef = useRef<Tempo | null>(null);
  const tempoRef = useRef(tempo);

  // Keep the latest tempo available to the open/close handlers below.
  useEffect(() => {
    tempoRef.current = tempo;
  });

  // One effect owns history persistence; state updaters stay pure (A8).
  useEffect(() => {
    saveHistory(savedTempos);
  }, [savedTempos]);

  // Re-read history on open and remember the tempo the modal opened with.
  useEffect(() => {
    if (!isOpen) return;
    setSavedTempos(loadHistory());
    openedTempoRef.current = tempoRef.current;
    setShowHistory(false);
    setConfirmClear(false);
  }, [isOpen]);

  useEffect(() => () => {
    if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
  }, []);

  const addToHistory = useCallback((nextTempo: Tempo, source: SavedTempo['source']) => {
    setSavedTempos((prev) => {
      // Dedupe against the whole list, not just the newest entry (A17).
      if (prev.some((item) => sameTempo(item.tempo, nextTempo))) return prev;
      const entry: SavedTempo = {
        id: newId(),
        timestamp: Date.now(),
        tempo: { ...nextTempo },
        source
      };
      return capHistory([entry, ...prev]);
    });
  }, []);

  const handleDone = useCallback(() => {
    triggerHaptic(15);
    const opened = openedTempoRef.current;
    const currentTempo = tempoRef.current;
    // Only record a new entry when the tempo changed while the modal was open.
    if (!opened || !sameTempo(currentTempo, opened)) {
      addToHistory(currentTempo, 'user');
    }
    onClose();
  }, [addToHistory, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleDone();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDone, isOpen]);

  const isCurrentTempo = useCallback((candidate: Tempo) => sameTempo(tempo, candidate), [tempo]);
  const isCurrentlyPinned = savedTempos.some((item) => isCurrentTempo(item.tempo) && item.pinned);

  const handlePinCurrent = useCallback(() => {
    triggerHaptic(20);
    setSavedTempos((prev) => {
      const existingIndex = prev.findIndex((item) => sameTempo(item.tempo, tempo));
      if (existingIndex !== -1) {
        return prev.map((item, index) => (
          index === existingIndex ? { ...item, pinned: !item.pinned } : item
        ));
      }
      const entry: SavedTempo = {
        id: newId(),
        timestamp: Date.now(),
        tempo: { ...tempo },
        source: 'user',
        pinned: true
      };
      return capHistory([entry, ...prev]);
    });
  }, [tempo]);

  const handleTogglePin = useCallback((id: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    triggerHaptic(15);
    setSavedTempos((prev) => prev.map((item) => (
      item.id === id ? { ...item, pinned: !item.pinned } : item
    )));
  }, []);

  const handleDeleteHistoryItem = useCallback((id: string) => {
    triggerHaptic(15);
    setSavedTempos((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearHistory = useCallback(() => {
    triggerHaptic(15);
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }

    if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
    setConfirmClear(false);
    triggerHaptic(25);
    setSavedTempos((prev) => {
      const hasUnpinned = prev.some((item) => !item.pinned);
      return hasUnpinned ? prev.filter((item) => item.pinned) : [];
    });
  }, [confirmClear]);

  const sortedSavedTempos = useMemo(() => (
    [...savedTempos].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    })
  ), [savedTempos]);

  const handleRandomize = useCallback(() => {
    triggerHaptic(25);
    const randomized: Tempo = {
      concentric: Math.floor(Math.random() * 5) + 1,
      pauseTop: Math.floor(Math.random() * 3),
      eccentric: Math.floor(Math.random() * 5) + 1,
      pauseBottom: Math.floor(Math.random() * 3)
    };
    onUpdateTempo(randomized);
    addToHistory(randomized, 'randomized');
  }, [addToHistory, onUpdateTempo]);

  const handleApplyHistoricalTempo = useCallback((historicalTempo: Tempo) => {
    triggerHaptic(20);
    onUpdateTempo(historicalTempo);
  }, [onUpdateTempo]);

  const adjustValue = useCallback((key: keyof Tempo, amount: number) => {
    triggerHaptic(10);
    const minValue = key === 'concentric' || key === 'eccentric' ? 0.5 : 0;
    onUpdateTempo({
      ...tempo,
      [key]: Math.max(minValue, tempo[key] + amount)
    });
  }, [onUpdateTempo, tempo]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 bg-sleek-bg/90"
            onClick={handleDone}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Configure timings"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
            className="relative bg-sleek-card border border-sleek-border w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl will-change-transform"
          >
            {showHistory ? (
              /* History Header */
              <div className="p-5 border-b border-sleek-border flex items-center justify-between bg-sleek-muted/5 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { triggerHaptic(15); setShowHistory(false); setConfirmClear(false); }}
                    className="p-2 -ml-2 hover:bg-sleek-muted/10 text-sleek-muted hover:text-sleek-text transition-colors"
                    aria-label="Back to configure"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h2 className="text-sm font-bold text-sleek-text uppercase tracking-widest whitespace-nowrap">Timings History</h2>
                </div>
                {savedTempos.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className={cn(
                      'text-[11px] font-bold transition-colors uppercase tracking-widest flex items-center gap-1 cursor-pointer',
                      confirmClear ? 'text-red-300' : 'text-red-400 hover:text-red-300'
                    )}
                  >
                    <Trash2 size={12} />
                    {confirmClear
                      ? 'CLEAR?'
                      : savedTempos.some((item) => !item.pinned) ? 'Clear Unpinned' : 'Clear All'}
                  </button>
                )}
              </div>
            ) : (
              /* Standard Header */
              <div className="p-6 border-b border-sleek-border flex items-center justify-between bg-sleek-muted/5 shrink-0">
                <h2 className="text-sm font-bold text-sleek-text uppercase tracking-widest">Configure</h2>
                <button
                  onClick={handleDone}
                  className="text-xs font-bold text-sleek-muted hover:text-sleek-up transition-colors uppercase tracking-widest px-2 py-1 cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {showHistory ? (
                /* History View Body */
                <motion.div
                  key="history"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 sm:p-8 space-y-4 overflow-y-auto h-[min(620px,70vh)] focus:outline-none"
                >
                  {sortedSavedTempos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-sleek-muted/50">
                      <History size={32} className="opacity-20 mb-3" />
                      <p className="text-xs font-bold uppercase tracking-wider">No history recorded yet</p>
                      <p className="text-[11px] lowercase italic mt-1 max-w-[220px]">
                        randomized or custom saved timings will show up here
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest">
                        {PHASES_ORDER.map((phase, index) => (
                          <Fragment key={phase}>
                            {index > 0 && <span className="text-sleek-muted/30">·</span>}
                            <span style={{ color: PHASE_META[phase].color }}>{PHASE_META[phase].label}</span>
                          </Fragment>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {sortedSavedTempos.map((item) => {
                          const isCurrent = isCurrentTempo(item.tempo);
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'flex items-center justify-between p-3.5 bg-sleek-bg border transition-colors relative',
                                isCurrent ? 'border-sleek-up bg-sleek-up/5' : 'border-sleek-border'
                              )}
                            >
                              <button
                                onClick={() => handleApplyHistoricalTempo(item.tempo)}
                                className="flex-1 text-left focus:outline-none cursor-pointer pr-2"
                              >
                                <div className="text-sm font-mono font-bold text-white flex items-center gap-1.5 mb-1 whitespace-nowrap">
                                  {PHASES_ORDER.map((phase, index) => (
                                    <Fragment key={phase}>
                                      {index > 0 && <span className="text-white/20">•</span>}
                                      <span className={cn(
                                        phase === 'pause_top' || phase === 'pause_bottom'
                                          ? 'text-sleek-muted'
                                          : 'text-white'
                                      )}>
                                        {item.tempo[PHASE_META[phase].tempoKey]}s
                                      </span>
                                    </Fragment>
                                  ))}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-sleek-muted/60 font-semibold tracking-normal uppercase whitespace-nowrap">
                                  <span>{item.source === 'randomized' ? 'Random Gen' : 'Custom Config'}</span>
                                  <span>•</span>
                                  <span>{formatHistoryTimestamp(item.timestamp)}</span>
                                </div>
                              </button>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  onClick={(event) => handleTogglePin(item.id, event)}
                                  aria-label={item.pinned ? 'Unpin timing' : 'Pin timing'}
                                  aria-pressed={Boolean(item.pinned)}
                                  className={cn(
                                    'h-10 w-10 flex items-center justify-center transition-colors cursor-pointer',
                                    item.pinned
                                      ? 'text-sleek-up'
                                      : 'text-sleek-muted/50 hover:text-sleek-text'
                                  )}
                                >
                                  <Pin size={15} className={item.pinned ? 'fill-current' : ''} />
                                </button>

                                <button
                                  onClick={() => handleDeleteHistoryItem(item.id)}
                                  aria-label="Delete entry"
                                  className="h-10 w-10 flex items-center justify-center text-sleek-muted/60 hover:text-red-400 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                /* Standard Configure View Body */
                <motion.div
                  key="config"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto h-[min(620px,70vh)] focus:outline-none"
                >
                  <div className="grid grid-cols-1 gap-6">
                    {PHASES_ORDER.map((phase) => {
                      const meta = PHASE_META[phase];
                      return (
                        <div key={phase} className="flex items-center justify-between">
                          <div>
                            <div className="text-[11px] font-bold text-sleek-muted uppercase tracking-widest mb-1">
                              {meta.label}
                            </div>
                            <div className={cn('text-2xl font-bold tabular-nums', meta.textClass)}>
                              {tempo[meta.tempoKey].toFixed(1)}s
                            </div>
                          </div>

                          <div className="flex items-center gap-1 bg-sleek-bg p-1 border border-sleek-border">
                            <button
                              onClick={() => adjustValue(meta.tempoKey, -0.5)}
                              aria-label={`Decrease ${meta.label} duration`}
                              className="h-11 w-11 flex items-center justify-center hover:bg-sleek-muted/10 text-sleek-muted transition-colors active:scale-90"
                            >
                              <ChevronDown size={20} />
                            </button>
                            <div className="w-px h-6 bg-sleek-border" />
                            <button
                              onClick={() => adjustValue(meta.tempoKey, 0.5)}
                              aria-label={`Increase ${meta.label} duration`}
                              className="h-11 w-11 flex items-center justify-center hover:bg-sleek-muted/10 text-sleek-muted transition-colors active:scale-90"
                            >
                              <ChevronUp size={20} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3 pt-2">
                    <a
                      href="https://musclewiki.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-sleek-muted hover:text-sleek-up transition-colors w-fit font-semibold"
                    >
                      Explore anatomy on MuscleWiki <ExternalLink size={10} />
                    </a>

                    <button
                      onClick={handleRandomize}
                      className="flex items-center gap-2 px-4 py-3 border border-sleek-border bg-sleek-bg text-sleek-muted text-xs font-bold transition-all w-full justify-center hover:border-sleek-up hover:text-sleek-text active:scale-[0.98] cursor-pointer"
                    >
                      <Dumbbell size={16} />
                      <span>Randomize Timings</span>
                    </button>

                    <button
                      onClick={handlePinCurrent}
                      aria-pressed={isCurrentlyPinned}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 border text-xs font-bold transition-all w-full justify-center active:scale-[0.98] cursor-pointer',
                        isCurrentlyPinned
                          ? 'border-sleek-up bg-sleek-up/5 text-sleek-up hover:bg-sleek-up/10'
                          : 'border-sleek-border bg-sleek-bg text-sleek-muted hover:border-sleek-up hover:text-sleek-text'
                      )}
                    >
                      <Pin size={16} className={isCurrentlyPinned ? 'fill-current' : ''} />
                      <span>{isCurrentlyPinned ? 'Unpin Selected Timings' : 'Pin Current Timing'}</span>
                    </button>

                    <button
                      onClick={() => { triggerHaptic(15); setShowHistory(true); }}
                      className="flex items-center gap-2 px-4 py-3 border border-sleek-border bg-sleek-bg text-sleek-muted text-xs font-bold transition-all w-full justify-center hover:border-sleek-up hover:text-sleek-text active:scale-[0.98] cursor-pointer"
                    >
                      <History size={16} />
                      <span>Timings History</span>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-sleek-border space-y-4">
                    <div className="text-sm font-bold text-sleek-text uppercase tracking-widest text-center">
                      Advanced
                    </div>
                    <button
                      onClick={() => { triggerHaptic(15); onToggleSeamless(); }}
                      aria-pressed={seamlessTransitions}
                      className="flex items-center justify-between w-full p-4 bg-sleek-bg border border-sleek-border group transition-all hover:border-sleek-up/30"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-bold text-sleek-muted uppercase tracking-widest mb-1">
                          Background Experience
                        </div>
                        <div className="text-sm font-bold text-sleek-text">Seamless Transitions</div>
                      </div>
                      <div className={cn(
                        'w-12 h-6 relative transition-colors duration-300',
                        seamlessTransitions ? 'bg-sleek-up' : 'bg-sleek-muted/20'
                      )}>
                        <motion.div
                          initial={false}
                          animate={{ x: seamlessTransitions ? 24 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={cn(
                            'absolute top-1 left-1 w-4 h-4',
                            seamlessTransitions ? 'bg-black' : 'bg-white'
                          )}
                        />
                      </div>
                    </button>

                    <div className="p-4 bg-sleek-bg border border-sleek-border space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[11px] font-bold text-sleek-muted uppercase tracking-widest mb-1">
                            Performance Settings {batteryLevel !== null ? `(${Math.round(batteryLevel * 100)}% power)` : ''}
                          </div>
                          <div className="text-sm font-bold text-sleek-text">Framerate Limit</div>
                        </div>
                        <div className="text-right">
                          {batteryCharging ? (
                            <span className="text-[11px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-1">
                              <BatteryCharging size={12} className="animate-pulse" /> Charging
                            </span>
                          ) : batteryLevel !== null && batteryLevel <= 0.25 ? (
                            <span className="text-[11px] font-bold text-[#f87171] uppercase tracking-widest flex items-center gap-1 animate-pulse">
                              <Battery size={12} /> Battery Low
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-sleek-muted/5 p-1 border border-sleek-border/30">
                        {FPS_OPTIONS.map((fps) => (
                          <button
                            key={fps}
                            onClick={() => onChangeFps(fps)}
                            aria-pressed={fpsLimit === fps}
                            className={cn(
                              'py-3 text-xs font-bold uppercase transition-all tracking-wider text-center cursor-pointer',
                              fpsLimit === fps
                                ? 'bg-sleek-up text-black font-extrabold shadow-sm'
                                : 'text-sleek-muted hover:text-sleek-text hover:bg-sleek-muted/5'
                            )}
                          >
                            {fps}
                          </button>
                        ))}
                      </div>
                      <div className="text-[11px] text-sleek-muted/70 italic tracking-wide">
                        The ring redraws at {fpsLimit} FPS. Every option divides 60 Hz and 120 Hz
                        refresh rates evenly, so pacing stays smooth.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleDone}
                    className="w-full bg-sleek-up text-black py-4 font-bold tracking-widest uppercase text-sm hover:bg-sleek-up/90 transition-all active:scale-[0.99] shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
