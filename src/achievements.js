import { renderAchievement } from './render.js';

// ─── Achievement definitions ──────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  {
    id: 'first-blood',
    name: 'First Blood',
    badge: '🩸',
    check: (s) => s.stats.totalFixes >= 1,
  },
  {
    id: 'gardener',
    name: 'Gardener',
    badge: '🌱',
    check: (s) => s.stats.totalFilesCreated >= 10,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    badge: '🦉',
    check: (s) => s.stats.nightOwlSessions >= 5,
  },
  {
    id: 'on-fire',
    name: 'On Fire',
    badge: '🔥',
    check: (s) => s.streak.current >= 7,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    badge: '💯',
    check: (s) => s.stats.totalCommits >= 100,
  },
  {
    id: 'rage-quit',
    name: 'Rage Quit',
    badge: '😤',
    check: (s) => s.session.rageMeter >= 100,
  },
  {
    id: 'zen-master',
    name: 'Zen Master',
    badge: '🧘',
    check: (s, end) => end && s.session.errors === 0 && s.session.testPasses > 0,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    badge: '⚡',
    check: (s) => s.session.commits >= 10,
  },
  {
    id: 'daredevil',
    name: 'Daredevil',
    badge: '💀',
    check: (s) => s.stats.destructiveOps >= 5,
  },
  {
    id: 'old-growth',
    name: 'Old Growth',
    badge: '🌳',
    check: (s) => s.garden.filter((p) => p === 'tree').length >= 10,
  },
  {
    id: 'legendary',
    name: 'Legendary',
    badge: '👑',
    check: (s) => s.level >= 51,
  },
  {
    id: 'hatcher',
    name: 'Hatcher',
    badge: '🍳',
    check: (s) => s.level >= 2,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks all achievement definitions against the current state.
 * For any achievement that passes its check and is not already in
 * state.achievements, adds its id to achievements and collects it.
 *
 * Does NOT mutate the input state.
 *
 * @param {object} state - The current buddy state.
 * @param {boolean} [sessionEnding=false] - Passed as the second argument to
 *   each check function (used by zen-master).
 * @returns {{ state: object, newAchievements: Array<{id, name, badge}> }}
 */
export function checkAchievements(state, sessionEnding = false) {
  const newAchievements = [];
  const earned = new Set(state.achievements);

  for (const achievement of ACHIEVEMENTS) {
    if (!earned.has(achievement.id) && achievement.check(state, sessionEnding)) {
      earned.add(achievement.id);
      newAchievements.push({
        id: achievement.id,
        name: achievement.name,
        badge: achievement.badge,
      });
    }
  }

  const updatedState = {
    ...state,
    achievements: [...earned],
  };

  return { state: updatedState, newAchievements };
}

/**
 * Renders all newly unlocked achievements into a combined string.
 * Uses renderAchievement from ./render.js for each unlock.
 *
 * @param {Array<{id, name, badge}>} arr - Array of newly unlocked achievements.
 * @returns {string} Combined render string, or '' for an empty array.
 */
export function renderNewAchievements(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(({ name, badge }) => renderAchievement(name, badge)).join('\n');
}
