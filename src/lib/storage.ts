import type { FpsLimit, SavedTempo, Settings, Tempo } from '../types';

const SETTINGS_KEY = 'tempotrack_settings';
const HISTORY_KEY = 'tempotrack_timings_history';
const UNPINNED_HISTORY_LIMIT = 50;
const FPS_OPTIONS: readonly FpsLimit[] = [30, 60, 120];

export const DEFAULT_SETTINGS: Settings = {
  reps: 12,
  sets: 3,
  tempo: {
    eccentric: 2,
    pauseBottom: 1,
    concentric: 3,
    pauseTop: 1
  },
  seamlessTransitions: false,
  fpsLimit: 60,
  sound: true
};

function readValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota, blocked cookies). The
    // app keeps working with in-memory settings when it is.
  }
}

function readJSON(key: string): unknown {
  const raw = readValue(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

function readTempo(value: unknown, fallback: Tempo): Tempo {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    eccentric: numberInRange(record.eccentric, 0.5, 60, fallback.eccentric),
    pauseBottom: numberInRange(record.pauseBottom, 0, 60, fallback.pauseBottom),
    concentric: numberInRange(record.concentric, 0.5, 60, fallback.concentric),
    pauseTop: numberInRange(record.pauseTop, 0, 60, fallback.pauseTop)
  };
}

export function loadSettings(): Settings {
  const stored = readJSON(SETTINGS_KEY);
  if (typeof stored !== 'object' || stored === null) return { ...DEFAULT_SETTINGS, tempo: { ...DEFAULT_SETTINGS.tempo } };

  const record = stored as Record<string, unknown>;
  const fpsLimit = FPS_OPTIONS.includes(record.fpsLimit as FpsLimit)
    ? (record.fpsLimit as FpsLimit)
    : DEFAULT_SETTINGS.fpsLimit;

  return {
    reps: Math.round(numberInRange(record.reps, 1, 50, DEFAULT_SETTINGS.reps)),
    sets: Math.round(numberInRange(record.sets, 1, 20, DEFAULT_SETTINGS.sets)),
    tempo: readTempo(record.tempo, DEFAULT_SETTINGS.tempo),
    seamlessTransitions: typeof record.seamlessTransitions === 'boolean'
      ? record.seamlessTransitions
      : DEFAULT_SETTINGS.seamlessTransitions,
    fpsLimit,
    sound: typeof record.sound === 'boolean' ? record.sound : DEFAULT_SETTINGS.sound
  };
}

export function saveSettings(settings: Settings): void {
  writeValue(SETTINGS_KEY, JSON.stringify(settings));
}

export function sameTempo(a: Tempo, b: Tempo): boolean {
  return a.concentric === b.concentric
    && a.pauseTop === b.pauseTop
    && a.eccentric === b.eccentric
    && a.pauseBottom === b.pauseBottom;
}

function isSavedTempo(value: unknown): value is SavedTempo {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.timestamp === 'number'
    && (record.source === 'randomized' || record.source === 'user')
    && (record.pinned === undefined || typeof record.pinned === 'boolean')
    && typeof record.tempo === 'object'
    && record.tempo !== null;
}

export function loadHistory(): SavedTempo[] {
  const stored = readJSON(HISTORY_KEY);
  if (!Array.isArray(stored)) return [];

  return stored
    .filter(isSavedTempo)
    .map((entry) => ({
      ...entry,
      tempo: readTempo(entry.tempo, DEFAULT_SETTINGS.tempo)
    }))
    .slice(0, 1000);
}

export function saveHistory(history: SavedTempo[]): void {
  writeValue(HISTORY_KEY, JSON.stringify(history));
}

/** Trim only unpinned entries; pinned timings must never be dropped. */
export function capHistory(history: SavedTempo[]): SavedTempo[] {
  const pinned = history.filter((entry) => entry.pinned);
  const unpinned = history
    .filter((entry) => !entry.pinned)
    .slice(0, UNPINNED_HISTORY_LIMIT);
  return [...pinned, ...unpinned].sort((a, b) => b.timestamp - a.timestamp);
}

export function formatHistoryTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return time;
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}
