export type Phase = 'eccentric' | 'concentric' | 'pause_top' | 'pause_bottom';

export type FpsLimit = 25 | 40 | 60 | 120;

export interface SavedTempo {
  id: string;
  timestamp: number;
  tempo: {
    eccentric: number;
    pauseBottom: number;
    concentric: number;
    pauseTop: number;
  };
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
  exerciseName: string;
  startTime: number;
  endTime?: number;
  reps: Rep[];
  targetTempo: {
    eccentric: number;
    pauseBottom: number;
    concentric: number;
    pauseTop: number;
  };
}
