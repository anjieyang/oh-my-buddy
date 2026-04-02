/**
 * state.js — Foundation state management for buddy-hooks.
 *
 * Zero dependencies; Node.js built-in modules only.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the path to the state file.
 * Respects BUDDY_STATE_PATH environment variable for testing.
 */
function statePath() {
  return process.env.BUDDY_STATE_PATH ?? join(homedir(), '.claude', 'buddy-stats.json');
}

// ─── Stage / Level thresholds ────────────────────────────────────────────────

// Each entry: [minLevel, maxLevel, stageName, xpPerLevel]
const STAGE_BANDS = [
  { min: 1,  max: 5,   stage: 'egg',       xpPerLevel: 20  },
  { min: 6,  max: 15,  stage: 'baby',      xpPerLevel: 40  },
  { min: 16, max: 30,  stage: 'teen',      xpPerLevel: 67  },
  { min: 31, max: 50,  stage: 'adult',     xpPerLevel: 125 },
  { min: 51, max: Infinity, stage: 'legendary', xpPerLevel: 200 },
];

/**
 * Returns the band for a given level.
 */
function bandForLevel(level) {
  return STAGE_BANDS.find((b) => level >= b.min && level <= b.max);
}

/**
 * Returns the stage name for a given level.
 */
function stageForLevel(level) {
  return bandForLevel(level).stage;
}

/**
 * Returns XP required to advance past the given level.
 */
function xpThresholdForLevel(level) {
  return bandForLevel(level).xpPerLevel;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns a fresh default state object.
 * Every call returns a completely independent object.
 */
export function getDefaultState() {
  return {
    xp: 0,
    level: 1,
    stage: 'egg',
    streak: { current: 0, best: 0, lastDate: null },
    session: {
      errors: 0,
      rageMeter: 0,
      commits: 0,
      edits: {},
      testPasses: 0,
    },
    achievements: [],
    garden: [],
    stats: {
      totalCommits: 0,
      totalFixes: 0,
      totalFilesCreated: 0,
      nightOwlSessions: 0,
      destructiveOps: 0,
    },
    createdAt: null,
  };
}

/**
 * Reads the state file. Returns the parsed state on success.
 * On missing or corrupt file, returns a fresh default state and writes it.
 */
export function loadState() {
  const path = statePath();
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    // Missing file, permission error, or corrupt JSON — start fresh
    const defaultState = getDefaultState();
    saveState(defaultState);
    return defaultState;
  }
}

/**
 * Writes state to disk atomically: write to .tmp then rename.
 */
export function saveState(state) {
  const path = statePath();
  const tmp = path + '.tmp';
  // Ensure directory exists
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, path);
}

/**
 * Adds XP to state and handles level-up logic.
 * Does NOT mutate the input state.
 *
 * Returns { state, leveledUp: boolean, newStage: string|null }
 *   - leveledUp: true if at least one level-up occurred
 *   - newStage:  the new stage name if a stage transition occurred, else null
 */
export function addXP(state, amount) {
  // Deep-copy only the fields we need to mutate
  let current = {
    ...state,
    streak: { ...state.streak },
    session: { ...state.session, edits: { ...state.session.edits } },
    stats: { ...state.stats },
    achievements: [...state.achievements],
    garden: [...state.garden],
  };

  current.xp += amount;

  let leveledUp = false;
  let stageChanged = false;
  const oldStage = current.stage;

  // Check for level-ups in a loop (large XP gains can jump multiple levels)
  let threshold = xpThresholdForLevel(current.level);
  while (current.xp >= threshold) {
    current.xp -= threshold;
    current.level += 1;
    leveledUp = true;
    current.stage = stageForLevel(current.level);
    if (current.stage !== oldStage) stageChanged = true;
    threshold = xpThresholdForLevel(current.level);
  }

  return {
    state: current,
    leveledUp,
    newStage: stageChanged ? current.stage : null,
  };
}

/**
 * Resets all session fields to their zero values.
 * Does NOT mutate the input state.
 */
export function resetSession(state) {
  return {
    ...state,
    streak: { ...state.streak },
    stats: { ...state.stats },
    achievements: [...state.achievements],
    garden: [...state.garden],
    session: {
      errors: 0,
      rageMeter: 0,
      commits: 0,
      edits: {},
      testPasses: 0,
    },
  };
}

/**
 * Updates the streak based on today's date.
 *
 * Rules:
 *   - lastDate is null  → start at 1, set lastDate to today
 *   - lastDate is today → no-op
 *   - lastDate is yesterday → increment, set lastDate to today
 *   - otherwise         → reset to 1, set lastDate to today
 *
 * Updates best if current exceeds it.
 * Does NOT mutate the input state.
 */
export function updateStreak(state) {
  const today = new Date().toISOString().slice(0, 10);
  const last = state.streak.lastDate;

  // No-op if already updated today
  if (last === today) {
    return {
      ...state,
      streak: { ...state.streak },
      session: { ...state.session, edits: { ...state.session.edits } },
      stats: { ...state.stats },
      achievements: [...state.achievements],
      garden: [...state.garden],
    };
  }

  let newCurrent;

  if (last === null) {
    newCurrent = 1;
  } else {
    // Check if last was yesterday
    const lastDate = new Date(last + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffMs = todayDate - lastDate;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newCurrent = state.streak.current + 1;
    } else {
      newCurrent = 1;
    }
  }

  const newBest = Math.max(state.streak.best, newCurrent);

  return {
    ...state,
    session: { ...state.session, edits: { ...state.session.edits } },
    stats: { ...state.stats },
    achievements: [...state.achievements],
    garden: [...state.garden],
    streak: {
      current: newCurrent,
      best: newBest,
      lastDate: today,
    },
  };
}
