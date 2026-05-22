import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, ExternalLink, Dumbbell, Battery, BatteryCharging, History, Trash2, ArrowLeft, Pin } from 'lucide-react';
import { WorkoutSession, FpsLimit, SavedTempo } from '../types';
import { cn, triggerHaptic } from '../lib/utils';

interface TempoSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  tempo: WorkoutSession['targetTempo'];
  onUpdateTempo: (tempo: WorkoutSession['targetTempo']) => void;
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
  const [showHistory, setShowHistory] = React.useState(false);
  const [savedTempos, setSavedTempos] = React.useState<SavedTempo[]>(() => {
    try {
      const stored = localStorage.getItem('tempotrack_timings_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load history whenever dialog opens
  React.useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('tempotrack_timings_history');
        if (stored) {
          setSavedTempos(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load history', e);
      }
    } else {
      setShowHistory(false);
    }
  }, [isOpen]);

  const saveTempoToHistory = (newTempo: WorkoutSession['targetTempo'], source: 'randomized' | 'user') => {
    setSavedTempos(prev => {
      // Check if the most recent entry has the exact same tempo to avoid spam/redundancy
      if (prev.length > 0) {
        const last = prev[0].tempo;
        if (
          last.eccentric === newTempo.eccentric &&
          last.pauseBottom === newTempo.pauseBottom &&
          last.concentric === newTempo.concentric &&
          last.pauseTop === newTempo.pauseTop
        ) {
          return prev;
        }
      }

      const entry: SavedTempo = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        tempo: { ...newTempo },
        source
      };

      const updated = [entry, ...prev].slice(0, 50); // Keep history to a reasonable limit
      localStorage.setItem('tempotrack_timings_history', JSON.stringify(updated));
      return updated;
    });
  };

  const isCurrentTempo = (t: SavedTempo['tempo']) => {
    return tempo.concentric === t.concentric &&
           tempo.pauseTop === t.pauseTop &&
           tempo.eccentric === t.eccentric &&
           tempo.pauseBottom === t.pauseBottom;
  };

  const isCurrentlyPinned = savedTempos.some(item => isCurrentTempo(item.tempo) && item.pinned);

  const handlePinCurrent = () => {
    triggerHaptic(20);
    setSavedTempos(prev => {
      const existingIdx = prev.findIndex(item => isCurrentTempo(item.tempo));
      let updated: SavedTempo[];
      if (existingIdx !== -1) {
        updated = prev.map((item, idx) => 
          idx === existingIdx ? { ...item, pinned: !item.pinned } : item
        );
      } else {
        const entry: SavedTempo = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          tempo: { ...tempo },
          source: 'user',
          pinned: true
        };
        updated = [entry, ...prev];
      }
      localStorage.setItem('tempotrack_timings_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering apply tempo
    triggerHaptic(15);
    setSavedTempos(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, pinned: !item.pinned } : item
      );
      localStorage.setItem('tempotrack_timings_history', JSON.stringify(updated));
      return updated;
    });
  };

  const sortedSavedTempos = React.useMemo(() => {
    return [...savedTempos].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [savedTempos]);

  const handleRandomize = () => {
    triggerHaptic(25); // Slightly heavier rumble for randomized generation
    const randomized = {
      concentric: Math.floor(Math.random() * 5) + 1,
      pauseTop: Math.floor(Math.random() * 3),
      eccentric: Math.floor(Math.random() * 5) + 1,
      pauseBottom: Math.floor(Math.random() * 3),
    };
    onUpdateTempo(randomized);
    saveTempoToHistory(randomized, 'randomized');
  };

  const handleSave = () => {
    triggerHaptic(15);
    saveTempoToHistory(tempo, 'user');
    onClose();
  };

  const handleApplyHistoricalTempo = (historicalTempo: WorkoutSession['targetTempo']) => {
    triggerHaptic(20);
    onUpdateTempo(historicalTempo);
  };

  const handleDeleteHistoryItem = (id: string) => {
    triggerHaptic(15);
    setSavedTempos(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('tempotrack_timings_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearHistory = () => {
    triggerHaptic(25);
    const unpinnedCount = savedTempos.filter(item => !item.pinned).length;
    let updated: SavedTempo[] = [];
    if (unpinnedCount > 0) {
      updated = savedTempos.filter(item => item.pinned);
    } else {
      updated = [];
    }
    setSavedTempos(updated);
    localStorage.setItem('tempotrack_timings_history', JSON.stringify(updated));
  };

  const adjustValue = (key: keyof WorkoutSession['targetTempo'], amount: number) => {
    triggerHaptic(10); // Super short snappy tap for quick continuous adjustments
    const minVal = (key === 'concentric' || key === 'eccentric') ? 0.5 : 0;
    const newValue = Math.max(minVal, tempo[key] + amount);
    onUpdateTempo({
      ...tempo,
      [key]: newValue
    });
  };

  const phases = [
    { key: 'concentric' as const, label: 'LIFT', color: 'text-sleek-up' },
    { key: 'pauseTop' as const, label: 'HOLD', color: 'text-sleek-muted' },
    { key: 'eccentric' as const, label: 'LOWER', color: 'text-sleek-down' },
    { key: 'pauseBottom' as const, label: 'PAUSE', color: 'text-sleek-muted' },
  ];

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
              className="absolute inset-0 bg-sleek-bg/85 backdrop-blur-md"
              onClick={onClose}
            />
            
            {/* Modal */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
              className="relative bg-sleek-card border border-sleek-border w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl will-change-transform"
            >
              {showHistory ? (
                /* History Header */
                <div className="p-6 border-b border-sleek-border flex items-center justify-between bg-sleek-muted/5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => { triggerHaptic(15); setShowHistory(false); }}
                      className="p-1 -ml-1 hover:bg-sleek-muted/10 text-sleek-muted hover:text-sleek-text transition-colors"
                      aria-label="Back to configure"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h2 className="text-sm font-bold text-sleek-text uppercase tracking-widest">Timings History</h2>
                  </div>
                  {savedTempos.length > 0 && (
                    <button 
                      onClick={handleClearHistory}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> {savedTempos.some(item => !item.pinned) ? "Clear Unpinned" : "Clear All"}
                    </button>
                  )}
                </div>
              ) : (
                /* Standard Header */
                <div className="p-6 border-b border-sleek-border flex items-center justify-between bg-sleek-muted/5 shrink-0">
                  <h2 className="text-sm font-bold text-sleek-text uppercase tracking-widest">Configure</h2>
                  <button 
                    onClick={handleSave}
                    className="text-xs font-bold text-sleek-muted hover:text-sleek-up transition-colors uppercase tracking-widest px-2 py-1 cursor-pointer"
                  >
                    Save
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
                    className="p-6 sm:p-8 space-y-4 overflow-y-auto min-h-0 custom-scrollbar flex-1 focus:outline-none"
                  >
                    {sortedSavedTempos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-sleek-muted/50">
                        <History size={32} className="opacity-20 mb-3" />
                        <p className="text-xs font-bold uppercase tracking-wider">No history recorded yet</p>
                        <p className="text-[10px] lowercase italic mt-1 max-w-[200px]">
                          randomized or custom saved timings will show up here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sortedSavedTempos.map((item) => {
                          const isCurrent = isCurrentTempo(item.tempo);
                          return (
                            <div 
                              key={item.id}
                              className={cn(
                                "flex items-center justify-between p-3.5 bg-sleek-bg border hover:border-sleek-up transition-all group relative",
                                isCurrent ? "border-sleek-up/60 bg-sleek-up/5" : "border-sleek-border"
                              )}
                            >
                              <button
                                onClick={() => handleApplyHistoricalTempo(item.tempo)}
                                className="flex-1 text-left focus:outline-none cursor-pointer pr-2"
                              >
                                <div className="text-sm font-mono font-bold text-white flex items-center gap-1.5 mb-1 whitespace-nowrap overflow-x-auto custom-scrollbar">
                                  <span className="text-white">{item.tempo.concentric}s</span>
                                  <span className="text-white/20">•</span>
                                  <span className="text-sleek-muted">{item.tempo.pauseTop}s</span>
                                  <span className="text-white/20">•</span>
                                  <span className="text-white">{item.tempo.eccentric}s</span>
                                  <span className="text-white/20">•</span>
                                  <span className="text-sleek-muted">{item.tempo.pauseBottom}s</span>
                                  {isCurrent && (
                                    <span className="ml-2 text-[8px] bg-sleek-up text-black px-1.5 py-0.5 font-extrabold uppercase tracking-widest shrink-0">
                                      Active
                                    </span>
                                  )}
                                  {item.pinned && (
                                    <span className="ml-1.5 text-[8px] border border-sleek-up/40 text-sleek-up px-1.5 py-0.5 font-bold uppercase tracking-widest flex items-center gap-0.5 shrink-0">
                                      <Pin size={6} className="fill-current" /> Pinned
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[9px] text-sleek-muted/60 font-semibold tracking-wider uppercase">
                                  <span>{item.source === 'randomized' ? 'Random Gen' : 'Custom Config'}</span>
                                  <span>•</span>
                                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => handleTogglePin(item.id, e)}
                                  className={cn(
                                    "p-2 transition-all cursor-pointer",
                                    item.pinned 
                                      ? "text-sleek-up" 
                                      : "text-sleek-muted/30 hover:text-sleek-muted group-hover:opacity-100 transition-opacity"
                                  )}
                                  title={item.pinned ? "Unpin timing" : "Pin timing"}
                                >
                                  <Pin size={13} className={item.pinned ? "fill-current" : ""} />
                                </button>

                                <button
                                  onClick={() => handleDeleteHistoryItem(item.id)}
                                  className="p-2 text-sleek-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                                  aria-label="Delete entry"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                    className="p-6 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto min-h-0 custom-scrollbar focus:outline-none flex-1"
                  >
                    <div className="grid grid-cols-1 gap-6">
                      {phases.map((phase) => (
                        <div key={phase.key} className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-sleek-muted uppercase tracking-widest mb-1">{phase.label}</div>
                            <div className={cn("text-2xl font-bold tabular-nums", phase.color)}>
                              {tempo[phase.key].toFixed(1)}s
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 bg-sleek-bg p-1 border border-sleek-border">
                            <button 
                              onClick={() => adjustValue(phase.key, -0.5)}
                              className="p-2 hover:bg-sleek-muted/10 text-sleek-muted transition-colors active:scale-90"
                            >
                              <ChevronDown size={20} />
                            </button>
                            <div className="w-px h-6 bg-sleek-border" />
                            <button 
                              onClick={() => adjustValue(phase.key, 0.5)}
                              className="p-2 hover:bg-sleek-muted/10 text-sleek-muted transition-colors active:scale-90"
                            >
                              <ChevronUp size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 pt-2">
                      <a 
                        href="https://musclewiki.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] text-sleek-muted hover:text-sleek-up transition-colors w-fit font-semibold"
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
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 border text-xs font-bold transition-all w-full justify-center active:scale-[0.98] cursor-pointer",
                          isCurrentlyPinned
                            ? "border-sleek-up bg-sleek-up/5 text-sleek-up hover:bg-sleek-up/10"
                            : "border-sleek-border bg-sleek-bg text-sleek-muted hover:border-sleek-up hover:text-sleek-text"
                        )}
                      >
                        <Pin size={16} className={isCurrentlyPinned ? "fill-current" : ""} />
                        <span>{isCurrentlyPinned ? "Unpin Selected Timings" : "Pin Current Timing"}</span>
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
                        className="flex items-center justify-between w-full p-4 bg-sleek-bg border border-sleek-border group transition-all hover:border-sleek-up/30"
                      >
                        <div className="text-left">
                          <div className="text-[10px] font-bold text-sleek-muted uppercase tracking-widest mb-1">Background Experience</div>
                          <div className="text-sm font-bold text-sleek-text">Seamless Transitions</div>
                        </div>
                        <div className={cn(
                          "w-12 h-6 relative transition-colors duration-300",
                          seamlessTransitions ? "bg-sleek-up" : "bg-sleek-muted/20"
                        )}>
                          <motion.div 
                            initial={false}
                            animate={{ x: seamlessTransitions ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className={cn(
                              "absolute top-1 left-1 w-4 h-4",
                              seamlessTransitions ? "bg-black" : "bg-white"
                            )} 
                            style={{ contentVisibility: 'auto' }}
                          />
                        </div>
                      </button>

                      <div className="p-4 bg-sleek-bg border border-sleek-border space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-bold text-sleek-muted uppercase tracking-widest mb-1">
                              Performance Settings {batteryLevel !== null ? `(${Math.round(batteryLevel * 100)}% power)` : ''}
                            </div>
                            <div className="text-sm font-bold text-sleek-text">
                              Framerate Limit
                            </div>
                          </div>
                          <div className="text-right">
                            {batteryCharging ? (
                              <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-1">
                                <BatteryCharging size={12} className="animate-pulse" /> Charging
                              </span>
                            ) : batteryLevel !== null && batteryLevel <= 0.25 ? (
                              <span className="text-[10px] font-bold text-[#f87171] uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                <Battery size={12} /> Battery Low
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1 bg-sleek-muted/5 p-1 border border-sleek-border/30">
                          {([25, 40, 60, 120] as const).map((fps) => (
                            <button
                              key={fps}
                              onClick={() => {
                                triggerHaptic(15);
                                onChangeFps(fps);
                              }}
                              className={cn(
                                "py-2 text-xs font-bold uppercase transition-all tracking-wider text-center cursor-pointer",
                                fpsLimit === fps
                                  ? "bg-sleek-up text-black font-extrabold shadow-sm"
                                  : "text-sleek-muted hover:text-sleek-text hover:bg-sleek-muted/5"
                              )}
                            >
                              {fps}
                            </button>
                          ))}
                        </div>
                        <div className="text-[9px] text-sleek-muted/70 italic tracking-wide">
                          Timer tick updates at {fpsLimit}FPS. Custom CSS transitions maintain full smoothness across device screen sizes.
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSave}
                      className="w-full bg-sleek-up text-black py-4 font-bold tracking-widest uppercase text-sm hover:bg-sleek-up/90 transition-all active:scale-[0.99] shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                      Save Configuration
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
