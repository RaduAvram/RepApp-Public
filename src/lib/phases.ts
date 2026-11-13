import type { Phase, Tempo } from '../types';

/** Execution order of one rep. */
export const PHASES_ORDER: readonly Phase[] = ['concentric', 'pause_top', 'eccentric', 'pause_bottom'];

export interface PhaseMeta {
  key: Phase;
  label: 'LIFT' | 'HOLD' | 'LOWER' | 'PAUSE';
  /** Which field of `Tempo` holds this phase's target duration. */
  tempoKey: keyof Tempo;
  color: string;
  textClass: string;
}

/** The single phase table: label, ordering, colour and tempo mapping. */
export const PHASE_META: Record<Phase, PhaseMeta> = {
  concentric: {
    key: 'concentric',
    label: 'LIFT',
    tempoKey: 'concentric',
    color: '#fb923c',
    textClass: 'text-sleek-up'
  },
  pause_top: {
    key: 'pause_top',
    label: 'HOLD',
    tempoKey: 'pauseTop',
    color: '#ef4444',
    textClass: 'text-sleek-muted'
  },
  eccentric: {
    key: 'eccentric',
    label: 'LOWER',
    tempoKey: 'eccentric',
    color: '#eab308',
    textClass: 'text-sleek-up'
  },
  pause_bottom: {
    key: 'pause_bottom',
    label: 'PAUSE',
    tempoKey: 'pauseBottom',
    color: '#22c55e',
    textClass: 'text-sleek-muted'
  }
};

export type ThemeKey = 'idle' | 'countdown' | 'finished' | Phase;

export interface Theme {
  color: string;
  gradient: readonly [string, string];
}

/** Background/ring themes, one gradient per theme so they can be cross-faded. */
export const THEMES: Record<ThemeKey, Theme> = {
  idle: { color: 'var(--color-sleek-muted)', gradient: ['#262626', '#171717'] },
  countdown: { color: PHASE_META.concentric.color, gradient: ['#fb923c', '#f97316'] },
  finished: { color: '#22c55e', gradient: ['#22c55e', '#10b981'] },
  concentric: { color: PHASE_META.concentric.color, gradient: ['#fb923c', '#f97316'] },
  pause_top: { color: PHASE_META.pause_top.color, gradient: ['#ef4444', '#e11d48'] },
  eccentric: { color: PHASE_META.eccentric.color, gradient: ['#eab308', '#d97706'] },
  pause_bottom: { color: PHASE_META.pause_bottom.color, gradient: ['#22c55e', '#10b981'] }
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

/** The ring's geometry: r + half the stroke stays inside the 400-unit viewBox. */
export const RING_RADIUS = 197;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function phaseTarget(tempo: Tempo, phase: Phase): number {
  return tempo[PHASE_META[phase].tempoKey];
}

export function repDuration(tempo: Tempo): number {
  return PHASES_ORDER.reduce((total, phase) => total + phaseTarget(tempo, phase), 0);
}
