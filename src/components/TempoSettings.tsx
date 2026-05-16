import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp, ChevronDown, ExternalLink, Dumbbell } from 'lucide-react';
import { WorkoutSession } from '../types';
import { cn } from '../lib/utils';

interface TempoSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  tempo: WorkoutSession['targetTempo'];
  onUpdateTempo: (tempo: WorkoutSession['targetTempo']) => void;
  seamlessTransitions: boolean;
  onToggleSeamless: () => void;
}

export default function TempoSettings({ 
  isOpen, 
  onClose, 
  tempo, 
  onUpdateTempo,
  seamlessTransitions,
  onToggleSeamless
}: TempoSettingsProps) {
  if (!isOpen) return null;

  const handleRandomize = () => {
    onUpdateTempo({
      concentric: Math.floor(Math.random() * 5) + 1,
      pauseTop: Math.floor(Math.random() * 3),
      eccentric: Math.floor(Math.random() * 5) + 1,
      pauseBottom: Math.floor(Math.random() * 3),
    });
  };

  const adjustValue = (key: keyof WorkoutSession['targetTempo'], amount: number) => {
    const newValue = Math.max(0, tempo[key] + amount);
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
              <div className="p-6 border-b border-sleek-border flex items-center justify-between bg-sleek-muted/5 shrink-0">
                <h2 className="text-sm font-bold text-sleek-text uppercase tracking-widest">Configure</h2>
                <button 
                  onClick={onClose}
                  className="text-xs font-bold text-sleek-muted hover:text-sleek-up transition-colors uppercase tracking-widest px-2 py-1"
                >
                  Save
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto min-h-0 custom-scrollbar focus:outline-none">
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

                <div className="space-y-4 pt-2">
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
                    className="flex items-center gap-2 px-4 py-3 border border-sleek-border bg-sleek-bg text-sleek-muted text-xs font-bold transition-all w-full justify-center hover:border-sleek-up hover:text-sleek-text active:scale-[0.98]"
                  >
                    <Dumbbell size={16} />
                    <span>Randomize Timings</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-sleek-border space-y-4">
                  <button 
                    onClick={onToggleSeamless}
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
                      />
                    </div>
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="w-full bg-sleek-up text-black py-4 font-bold tracking-widest uppercase text-sm hover:bg-sleek-up/90 transition-all active:scale-[0.99] shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
  );
}
