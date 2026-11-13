import type { Phase } from '../types';

export type CueName = 'lift' | 'hold' | 'lower' | 'pause' | 'setComplete' | 'finish';

interface Cue {
  /** Frequencies in Hz, played in sequence. */
  notes: readonly number[];
  /** Gap between notes, in seconds. */
  step: number;
  /** Length of a single note, in seconds. */
  duration: number;
  /** Peak gain of a single note. */
  gain: number;
}

const CUES: Record<CueName, Cue> = {
  lift: { notes: [659.25], step: 0, duration: 0.12, gain: 0.08 },
  hold: { notes: [493.88], step: 0, duration: 0.1, gain: 0.07 },
  lower: { notes: [349.23], step: 0, duration: 0.12, gain: 0.08 },
  pause: { notes: [523.25], step: 0, duration: 0.09, gain: 0.06 },
  setComplete: { notes: [523.25, 783.99], step: 0.16, duration: 0.13, gain: 0.08 },
  finish: { notes: [523.25, 659.25, 783.99], step: 0.17, duration: 0.15, gain: 0.09 }
};

const PHASE_CUES: Record<Phase, CueName> = {
  concentric: 'lift',
  pause_top: 'hold',
  eccentric: 'lower',
  pause_bottom: 'pause'
};

let audioContext: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;
interface WebkitAudioWindow {
  webkitAudioContext?: AudioContextCtor;
}

/**
 * Create/resume the AudioContext. Must be called from a user gesture (the Start
 * tap) so mobile browsers allow playback later.
 */
export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext
    ?? (window as Window & WebkitAudioWindow).webkitAudioContext;
  if (!Ctor) return;

  try {
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {});
    }
  } catch {
    audioContext = null;
  }
}

export function cueForPhase(phase: Phase): CueName {
  return PHASE_CUES[phase];
}

/** Play a short, enveloped tone sequence. Silent until `primeAudio` has run. */
export function playCue(name: CueName, enabled: boolean): void {
  if (!enabled || !audioContext) return;
  const context = audioContext;
  const cue = CUES[name];
  const start = context.currentTime + 0.01;

  cue.notes.forEach((frequency, index) => {
    const noteStart = start + index * cue.step;
    const noteEnd = noteStart + cue.duration;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);

    envelope.gain.setValueAtTime(0.0001, noteStart);
    envelope.gain.exponentialRampToValueAtTime(cue.gain, noteStart + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });
}
