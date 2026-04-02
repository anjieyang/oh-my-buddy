import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { ACHIEVEMENTS, checkAchievements, renderNewAchievements } =
  await import('../src/achievements.js');
const { getDefaultState } = await import('../src/state.js');

// ─── ACHIEVEMENTS array structure ─────────────────────────────────────────────

describe('ACHIEVEMENTS array', () => {
  test('has exactly 12 items', () => {
    assert.equal(ACHIEVEMENTS.length, 12);
  });

  test('every item has id, name, badge, and check function', () => {
    for (const a of ACHIEVEMENTS) {
      assert.ok(typeof a.id === 'string' && a.id.length > 0, `id missing on ${JSON.stringify(a)}`);
      assert.ok(typeof a.name === 'string' && a.name.length > 0, `name missing on ${a.id}`);
      assert.ok(typeof a.badge === 'string' && a.badge.length > 0, `badge missing on ${a.id}`);
      assert.ok(typeof a.check === 'function', `check missing on ${a.id}`);
    }
  });

  test('ids are unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, 12);
  });
});

// ─── Individual check functions ───────────────────────────────────────────────

describe('check functions', () => {
  function stateWith(overrides) {
    const s = getDefaultState();
    if (overrides.stats) Object.assign(s.stats, overrides.stats);
    if (overrides.streak) Object.assign(s.streak, overrides.streak);
    if (overrides.session) Object.assign(s.session, overrides.session);
    if ('level' in overrides) s.level = overrides.level;
    if ('garden' in overrides) s.garden = overrides.garden;
    return s;
  }

  function findCheck(id) {
    return ACHIEVEMENTS.find((a) => a.id === id).check;
  }

  test('first-blood: false when totalFixes < 1', () => {
    assert.equal(findCheck('first-blood')(stateWith({ stats: { totalFixes: 0 } })), false);
  });

  test('first-blood: true when totalFixes >= 1', () => {
    assert.ok(findCheck('first-blood')(stateWith({ stats: { totalFixes: 1 } })));
  });

  test('gardener: false when totalFilesCreated < 10', () => {
    assert.equal(findCheck('gardener')(stateWith({ stats: { totalFilesCreated: 9 } })), false);
  });

  test('gardener: true when totalFilesCreated >= 10', () => {
    assert.ok(findCheck('gardener')(stateWith({ stats: { totalFilesCreated: 10 } })));
  });

  test('night-owl: false when nightOwlSessions < 5', () => {
    assert.equal(findCheck('night-owl')(stateWith({ stats: { nightOwlSessions: 4 } })), false);
  });

  test('night-owl: true when nightOwlSessions >= 5', () => {
    assert.ok(findCheck('night-owl')(stateWith({ stats: { nightOwlSessions: 5 } })));
  });

  test('on-fire: false when streak.current < 7', () => {
    assert.equal(findCheck('on-fire')(stateWith({ streak: { current: 6 } })), false);
  });

  test('on-fire: true when streak.current >= 7', () => {
    assert.ok(findCheck('on-fire')(stateWith({ streak: { current: 7 } })));
  });

  test('centurion: false when totalCommits < 100', () => {
    assert.equal(findCheck('centurion')(stateWith({ stats: { totalCommits: 99 } })), false);
  });

  test('centurion: true when totalCommits >= 100', () => {
    assert.ok(findCheck('centurion')(stateWith({ stats: { totalCommits: 100 } })));
  });

  test('rage-quit: false when rageMeter < 100', () => {
    assert.equal(findCheck('rage-quit')(stateWith({ session: { rageMeter: 99 } })), false);
  });

  test('rage-quit: true when rageMeter >= 100', () => {
    assert.ok(findCheck('rage-quit')(stateWith({ session: { rageMeter: 100 } })));
  });

  test('zen-master: false when sessionEnding is false', () => {
    const s = stateWith({ session: { errors: 0, testPasses: 1 } });
    assert.equal(findCheck('zen-master')(s, false), false);
  });

  test('zen-master: false when errors > 0', () => {
    const s = stateWith({ session: { errors: 1, testPasses: 1 } });
    assert.equal(findCheck('zen-master')(s, true), false);
  });

  test('zen-master: false when testPasses is 0', () => {
    const s = stateWith({ session: { errors: 0, testPasses: 0 } });
    assert.equal(findCheck('zen-master')(s, true), false);
  });

  test('zen-master: true when sessionEnding=true, errors=0, testPasses>0', () => {
    const s = stateWith({ session: { errors: 0, testPasses: 1 } });
    assert.ok(findCheck('zen-master')(s, true));
  });

  test('speed-demon: false when session.commits < 10', () => {
    assert.equal(findCheck('speed-demon')(stateWith({ session: { commits: 9 } })), false);
  });

  test('speed-demon: true when session.commits >= 10', () => {
    assert.ok(findCheck('speed-demon')(stateWith({ session: { commits: 10 } })));
  });

  test('daredevil: false when destructiveOps < 5', () => {
    assert.equal(findCheck('daredevil')(stateWith({ stats: { destructiveOps: 4 } })), false);
  });

  test('daredevil: true when destructiveOps >= 5', () => {
    assert.ok(findCheck('daredevil')(stateWith({ stats: { destructiveOps: 5 } })));
  });

  test('old-growth: false when fewer than 10 trees in garden', () => {
    const s = stateWith({ garden: Array(9).fill('tree') });
    assert.equal(findCheck('old-growth')(s), false);
  });

  test('old-growth: true when 10 or more trees in garden', () => {
    const s = stateWith({ garden: Array(10).fill('tree') });
    assert.ok(findCheck('old-growth')(s));
  });

  test('old-growth: non-tree garden items do not count', () => {
    const s = stateWith({ garden: Array(10).fill('flower') });
    assert.equal(findCheck('old-growth')(s), false);
  });

  test('legendary: false when level < 51', () => {
    assert.equal(findCheck('legendary')(stateWith({ level: 50 })), false);
  });

  test('legendary: true when level >= 51', () => {
    assert.ok(findCheck('legendary')(stateWith({ level: 51 })));
  });

  test('hatcher: false when level < 2', () => {
    assert.equal(findCheck('hatcher')(stateWith({ level: 1 })), false);
  });

  test('hatcher: true when level >= 2', () => {
    assert.ok(findCheck('hatcher')(stateWith({ level: 2 })));
  });
});

// ─── checkAchievements ────────────────────────────────────────────────────────

describe('checkAchievements', () => {
  test('returns empty newAchievements when no checks pass', () => {
    const state = getDefaultState();
    const { newAchievements } = checkAchievements(state);
    assert.deepEqual(newAchievements, []);
  });

  test('returns state unchanged when no checks pass', () => {
    const state = getDefaultState();
    const { state: out } = checkAchievements(state);
    assert.deepEqual(out.achievements, []);
  });

  test('unlocks a single achievement when check passes', () => {
    const state = getDefaultState();
    state.stats.totalFixes = 1;
    const { newAchievements, state: out } = checkAchievements(state);
    assert.equal(newAchievements.length, 1);
    assert.equal(newAchievements[0].id, 'first-blood');
    assert.ok(out.achievements.includes('first-blood'));
  });

  test('does not re-unlock an already earned achievement', () => {
    const state = getDefaultState();
    state.stats.totalFixes = 1;
    state.achievements = ['first-blood'];
    const { newAchievements } = checkAchievements(state);
    assert.deepEqual(newAchievements, []);
  });

  test('unlocks multiple achievements at once', () => {
    const state = getDefaultState();
    state.stats.totalFixes = 1;
    state.level = 2;
    const { newAchievements, state: out } = checkAchievements(state);
    const ids = newAchievements.map((a) => a.id);
    assert.ok(ids.includes('first-blood'));
    assert.ok(ids.includes('hatcher'));
    assert.equal(out.achievements.length, 2);
  });

  test('zen-master unlocked when sessionEnding=true', () => {
    const state = getDefaultState();
    state.session.errors = 0;
    state.session.testPasses = 3;
    const { newAchievements } = checkAchievements(state, true);
    const ids = newAchievements.map((a) => a.id);
    assert.ok(ids.includes('zen-master'));
  });

  test('zen-master NOT unlocked when sessionEnding=false (default)', () => {
    const state = getDefaultState();
    state.session.errors = 0;
    state.session.testPasses = 3;
    const { newAchievements } = checkAchievements(state);
    const ids = newAchievements.map((a) => a.id);
    assert.ok(!ids.includes('zen-master'));
  });

  test('returned newAchievements items have id, name, badge', () => {
    const state = getDefaultState();
    state.stats.totalFixes = 1;
    const { newAchievements } = checkAchievements(state);
    const a = newAchievements[0];
    assert.ok(typeof a.id === 'string');
    assert.ok(typeof a.name === 'string');
    assert.ok(typeof a.badge === 'string');
  });

  test('does not mutate the input state achievements array', () => {
    const state = getDefaultState();
    state.stats.totalFixes = 1;
    const original = state.achievements;
    checkAchievements(state);
    assert.equal(state.achievements, original);
    assert.deepEqual(original, []);
  });
});

// ─── renderNewAchievements ────────────────────────────────────────────────────

describe('renderNewAchievements', () => {
  test('returns empty string for empty array', () => {
    assert.equal(renderNewAchievements([]), '');
  });

  test('returns a non-empty string for a single achievement', () => {
    const result = renderNewAchievements([{ id: 'first-blood', name: 'First Blood', badge: '🩸' }]);
    assert.ok(typeof result === 'string' && result.length > 0);
    assert.ok(result.includes('First Blood'));
    assert.ok(result.includes('🩸'));
  });

  test('returns combined string for multiple achievements', () => {
    const arr = [
      { id: 'first-blood', name: 'First Blood', badge: '🩸' },
      { id: 'hatcher', name: 'Hatcher', badge: '🍳' },
    ];
    const result = renderNewAchievements(arr);
    assert.ok(result.includes('First Blood'));
    assert.ok(result.includes('Hatcher'));
    assert.ok(result.includes('🩸'));
    assert.ok(result.includes('🍳'));
  });
});
