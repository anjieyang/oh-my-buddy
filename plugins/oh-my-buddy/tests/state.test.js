import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpBase = mkdtempSync(join(tmpdir(), 'buddy-state-test-'));
const STATE_FILE = join(tmpBase, 'buddy-stats.json');
process.env.BUDDY_STATE_PATH = STATE_FILE;

// Dynamic import after setting env var so the module picks up BUDDY_STATE_PATH
const { getDefaultState, loadState, saveState, addXP, resetSession, updateStreak } =
  await import('../src/state.js');

function clearStateFile() {
  if (existsSync(STATE_FILE)) {
    rmSync(STATE_FILE, { force: true });
  }
}

// ─── getDefaultState ─────────────────────────────────────────────────────────

describe('getDefaultState', () => {
  test('returns an object with all required keys', () => {
    const s = getDefaultState();
    assert.ok(typeof s === 'object' && s !== null);
    assert.ok('xp' in s);
    assert.ok('level' in s);
    assert.ok('stage' in s);
    assert.ok('streak' in s);
    assert.ok('session' in s);
    assert.ok('achievements' in s);
    assert.ok('garden' in s);
    assert.ok('stats' in s);
    assert.ok('createdAt' in s);
  });

  test('returns correct initial numeric values', () => {
    const s = getDefaultState();
    assert.equal(s.xp, 0);
    assert.equal(s.level, 1);
    assert.equal(s.stage, 'egg');
  });

  test('returns correct streak shape', () => {
    const s = getDefaultState();
    assert.deepEqual(s.streak, { current: 0, best: 0, lastDate: null });
  });

  test('returns correct session shape', () => {
    const s = getDefaultState();
    assert.deepEqual(s.session, {
      errors: 0,
      rageMeter: 0,
      commits: 0,
      edits: {},
      testPasses: 0,
    });
  });

  test('returns empty arrays for achievements and garden', () => {
    const s = getDefaultState();
    assert.deepEqual(s.achievements, []);
    assert.deepEqual(s.garden, []);
  });

  test('returns correct stats shape', () => {
    const s = getDefaultState();
    assert.deepEqual(s.stats, {
      totalCommits: 0,
      totalFixes: 0,
      totalFilesCreated: 0,
      nightOwlSessions: 0,
      destructiveOps: 0,
    });
  });

  test('createdAt is null', () => {
    const s = getDefaultState();
    assert.equal(s.createdAt, null);
  });

  test('returns a fresh object each call (no shared reference)', () => {
    const a = getDefaultState();
    const b = getDefaultState();
    a.xp = 999;
    assert.equal(b.xp, 0);
  });
});

// ─── loadState ───────────────────────────────────────────────────────────────

describe('loadState', () => {
  beforeEach(() => clearStateFile());

  test('returns default state and writes file when file is missing', () => {
    const s = loadState();
    assert.equal(s.xp, 0);
    assert.equal(s.level, 1);
    assert.ok(existsSync(STATE_FILE), 'file should have been written');
  });

  test('written file contains valid JSON matching default state', () => {
    loadState();
    const raw = readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.xp, 0);
    assert.equal(parsed.stage, 'egg');
  });

  test('returns existing state from file', () => {
    const custom = getDefaultState();
    custom.xp = 42;
    custom.level = 3;
    saveState(custom);

    const loaded = loadState();
    assert.equal(loaded.xp, 42);
    assert.equal(loaded.level, 3);
  });

  test('returns default state when file is corrupt JSON', () => {
    writeFileSync(STATE_FILE, '{ corrupt json !!!');
    const s = loadState();
    assert.equal(s.xp, 0);
    assert.equal(s.level, 1);
  });

  test('overwrites corrupt file with default state', () => {
    writeFileSync(STATE_FILE, 'NOTJSON');
    loadState();
    const raw = readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.xp, 0);
  });
});

// ─── saveState ───────────────────────────────────────────────────────────────

describe('saveState', () => {
  beforeEach(() => clearStateFile());

  test('writes state to file as JSON', () => {
    const s = getDefaultState();
    s.xp = 55;
    saveState(s);
    const raw = readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.xp, 55);
  });

  test('round-trips complex state correctly', () => {
    const s = getDefaultState();
    s.xp = 100;
    s.level = 6;
    s.stage = 'baby';
    s.streak.current = 5;
    s.streak.best = 10;
    s.streak.lastDate = '2025-01-01';
    s.achievements.push('first_commit');
    saveState(s);

    const loaded = loadState();
    assert.equal(loaded.xp, 100);
    assert.equal(loaded.level, 6);
    assert.equal(loaded.stage, 'baby');
    assert.equal(loaded.streak.current, 5);
    assert.equal(loaded.streak.best, 10);
    assert.deepEqual(loaded.achievements, ['first_commit']);
  });
});

// ─── addXP ───────────────────────────────────────────────────────────────────

describe('addXP', () => {
  test('adds XP to state', () => {
    const s = getDefaultState();
    const { state } = addXP(s, 10);
    assert.equal(state.xp, 10);
  });

  test('returns leveledUp false when no level up occurs', () => {
    const s = getDefaultState();
    const { leveledUp } = addXP(s, 5);
    assert.equal(leveledUp, false);
  });

  test('returns newStage null when no level up occurs', () => {
    const s = getDefaultState();
    const { newStage } = addXP(s, 5);
    assert.equal(newStage, null);
  });

  test('does not mutate the original state object', () => {
    const s = getDefaultState();
    addXP(s, 10);
    assert.equal(s.xp, 0);
  });

  // --- egg stage (levels 1-5, 20 XP per level) ---

  test('level up from 1 to 2 at 20 XP (egg stage)', () => {
    const s = getDefaultState(); // level 1, xp 0
    const { state, leveledUp } = addXP(s, 20);
    assert.equal(leveledUp, true);
    assert.equal(state.level, 2);
    assert.equal(state.stage, 'egg');
  });

  test('stays at level 1 below 20 XP threshold', () => {
    const s = getDefaultState();
    const { state, leveledUp } = addXP(s, 19);
    assert.equal(leveledUp, false);
    assert.equal(state.level, 1);
  });

  test('level up from 2 to 3 at cumulative 40 XP', () => {
    let s = getDefaultState();
    ({ state: s } = addXP(s, 20)); // now level 2
    const { state, leveledUp } = addXP(s, 20);
    assert.equal(leveledUp, true);
    assert.equal(state.level, 3);
  });

  test('levels 1-5 remain in egg stage', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) {
      ({ state: s } = addXP(s, 20));
    }
    assert.equal(s.level, 5);
    assert.equal(s.stage, 'egg');
  });

  // --- baby stage (levels 6-15, 40 XP per level) ---

  test('transitions from egg to baby at level 6', () => {
    let s = getDefaultState();
    // Advance to level 5
    for (let i = 0; i < 4; i++) {
      ({ state: s } = addXP(s, 20));
    }
    assert.equal(s.level, 5);
    const { state, leveledUp, newStage } = addXP(s, 40);
    assert.equal(leveledUp, true);
    assert.equal(state.level, 6);
    assert.equal(state.stage, 'baby');
    assert.equal(newStage, 'baby');
  });

  test('stays in baby stage through level 15', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20)); // l1→l5 (4 level-ups)
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l5→l15 (10 level-ups: l6..l15)
    assert.equal(s.level, 15);
    assert.equal(s.stage, 'baby');
  });

  // --- teen stage (levels 16-30, ~67 XP per level) ---

  test('transitions from baby to teen at level 16', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20)); // l5
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l15
    const { state, newStage } = addXP(s, 67);
    assert.equal(state.level, 16);
    assert.equal(state.stage, 'teen');
    assert.equal(newStage, 'teen');
  });

  test('stays in teen stage through level 30', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20)); // l5
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l15
    for (let i = 0; i < 15; i++) ({ state: s } = addXP(s, 67)); // l15→l30 (15 level-ups: l16..l30)
    assert.equal(s.level, 30);
    assert.equal(s.stage, 'teen');
  });

  // --- adult stage (levels 31-50, 125 XP per level) ---

  test('transitions from teen to adult at level 31', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20)); // l5
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l15
    for (let i = 0; i < 15; i++) ({ state: s } = addXP(s, 67)); // l30
    const { state, newStage } = addXP(s, 125);
    assert.equal(state.level, 31);
    assert.equal(state.stage, 'adult');
    assert.equal(newStage, 'adult');
  });

  test('stays in adult stage through level 50', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20)); // l5
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l15
    for (let i = 0; i < 15; i++) ({ state: s } = addXP(s, 67)); // l30
    for (let i = 0; i < 20; i++) ({ state: s } = addXP(s, 125)); // l30→l50 (20 level-ups: l31..l50)
    assert.equal(s.level, 50);
    assert.equal(s.stage, 'adult');
  });

  // --- legendary stage (levels 51+, 200 XP per level) ---

  test('transitions from adult to legendary at level 51', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20)); // l5
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l15
    for (let i = 0; i < 15; i++) ({ state: s } = addXP(s, 67)); // l30
    for (let i = 0; i < 20; i++) ({ state: s } = addXP(s, 125)); // l50
    const { state, newStage } = addXP(s, 200);
    assert.equal(state.level, 51);
    assert.equal(state.stage, 'legendary');
    assert.equal(newStage, 'legendary');
  });

  test('remains legendary beyond level 51', () => {
    let s = getDefaultState();
    for (let i = 0; i < 4; i++) ({ state: s } = addXP(s, 20));  // l5
    for (let i = 0; i < 10; i++) ({ state: s } = addXP(s, 40)); // l15
    for (let i = 0; i < 15; i++) ({ state: s } = addXP(s, 67)); // l30
    for (let i = 0; i < 20; i++) ({ state: s } = addXP(s, 125)); // l50
    for (let i = 0; i < 6; i++) ({ state: s } = addXP(s, 200)); // l50→l56 (6 level-ups: l51..l56)
    assert.equal(s.level, 56);
    assert.equal(s.stage, 'legendary');
  });

  test('can level up multiple times in one addXP call', () => {
    const s = getDefaultState(); // level 1, xp 0
    const { state } = addXP(s, 100);
    assert.ok(state.level >= 4, `expected level >= 4, got ${state.level}`);
  });
});

// ─── resetSession ─────────────────────────────────────────────────────────────

describe('resetSession', () => {
  test('resets errors to 0', () => {
    const s = getDefaultState();
    s.session.errors = 5;
    const next = resetSession(s);
    assert.equal(next.session.errors, 0);
  });

  test('resets rageMeter to 0', () => {
    const s = getDefaultState();
    s.session.rageMeter = 99;
    const next = resetSession(s);
    assert.equal(next.session.rageMeter, 0);
  });

  test('resets commits to 0', () => {
    const s = getDefaultState();
    s.session.commits = 7;
    const next = resetSession(s);
    assert.equal(next.session.commits, 0);
  });

  test('resets edits to empty object', () => {
    const s = getDefaultState();
    s.session.edits = { 'file.js': 3 };
    const next = resetSession(s);
    assert.deepEqual(next.session.edits, {});
  });

  test('resets testPasses to 0', () => {
    const s = getDefaultState();
    s.session.testPasses = 12;
    const next = resetSession(s);
    assert.equal(next.session.testPasses, 0);
  });

  test('does not mutate the original state', () => {
    const s = getDefaultState();
    s.session.commits = 3;
    resetSession(s);
    assert.equal(s.session.commits, 3);
  });

  test('preserves non-session fields', () => {
    const s = getDefaultState();
    s.xp = 88;
    s.level = 5;
    const next = resetSession(s);
    assert.equal(next.xp, 88);
    assert.equal(next.level, 5);
  });
});

// ─── updateStreak ─────────────────────────────────────────────────────────────

describe('updateStreak', () => {
  function dateOffset(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const today = dateOffset(0);
  const yesterday = dateOffset(-1);
  const twoDaysAgo = dateOffset(-2);

  test('starts streak at 1 when lastDate is null', () => {
    const s = getDefaultState();
    const next = updateStreak(s);
    assert.equal(next.streak.current, 1);
  });

  test('sets lastDate to today when starting fresh', () => {
    const s = getDefaultState();
    const next = updateStreak(s);
    assert.equal(next.streak.lastDate, today);
  });

  test('increments streak when lastDate was yesterday', () => {
    const s = getDefaultState();
    s.streak.current = 3;
    s.streak.lastDate = yesterday;
    const next = updateStreak(s);
    assert.equal(next.streak.current, 4);
    assert.equal(next.streak.lastDate, today);
  });

  test('is no-op when lastDate is today', () => {
    const s = getDefaultState();
    s.streak.current = 5;
    s.streak.lastDate = today;
    const next = updateStreak(s);
    assert.equal(next.streak.current, 5);
    assert.equal(next.streak.lastDate, today);
  });

  test('resets streak to 1 when lastDate is older than yesterday', () => {
    const s = getDefaultState();
    s.streak.current = 10;
    s.streak.lastDate = twoDaysAgo;
    const next = updateStreak(s);
    assert.equal(next.streak.current, 1);
    assert.equal(next.streak.lastDate, today);
  });

  test('updates best when current exceeds best', () => {
    const s = getDefaultState();
    s.streak.current = 7;
    s.streak.best = 6;
    s.streak.lastDate = yesterday;
    const next = updateStreak(s);
    assert.equal(next.streak.current, 8);
    assert.equal(next.streak.best, 8);
  });

  test('does not lower best when current is lower', () => {
    const s = getDefaultState();
    s.streak.current = 3;
    s.streak.best = 10;
    s.streak.lastDate = yesterday;
    const next = updateStreak(s);
    assert.equal(next.streak.best, 10);
  });

  test('does not mutate original state', () => {
    const s = getDefaultState();
    s.streak.lastDate = yesterday;
    s.streak.current = 2;
    updateStreak(s);
    assert.equal(s.streak.current, 2);
  });

  test('best is updated to 1 when starting fresh and best was 0', () => {
    const s = getDefaultState(); // streak.best = 0
    const next = updateStreak(s);
    assert.equal(next.streak.best, 1);
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

after(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});
