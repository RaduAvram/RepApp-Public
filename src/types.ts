export type Phase = 'eccentric' | 'concentric' | 'pause_top' | 'pause_bottom';

export interface Tempo {
  eccentric: number;
  pauseBottom: number;
  concentric: number;
  pauseTop: number;
}

export type FpsLimit = 30 | 60 | 120;

export type TimerStatus = 'idle' | 'countdown' | 'running' | 'paused' | 'setBreak' | 'finished';

export interface SavedTempo {
  id: string;
  timestamp: number;
  tempo: Tempo;
  source: 'randomized' | 'user';
  pinned?: boolean;
}

export interface Rep {
  id: string;
  timestamp: number;
  eccentricDuration: number;
  concentricDuration: number;
  pauseTopDuration: number;
  pauseBottomDuration: number;
  totalDuration: number;
}

export interface WorkoutSession {
  id: string;
  reps: Rep[];
  targetTempo: Tempo;
}

export interface Settings {
  reps: number;
  sets: number;
  tempo: Tempo;
  seamlessTransitions: boolean;
  fpsLimit: FpsLimit;
  sound: boolean;
}
