export type Phase = 'eccentric' | 'concentric' | 'pause_top' | 'pause_bottom';

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
