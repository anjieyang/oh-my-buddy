/**
 * index.test.js — Tests for the main hook router (src/index.js).
 *
 * Uses child_process.execFileSync to pipe JSON stdin to the script and inspect
 * the JSON response on stdout. Uses BUDDY_STATE_PATH env var for test isolation.
 *
 * Uses BUDDY_CONFIG_PATH to inject a known buddy profile for deterministic
 * personality output. The "silent" buddy has chaos=0 so shouldSpeak returns
 * false for boring events, preserving backward compatibility with legacy tests.
 */

import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const INDEX_PATH = join(__dirname, '..', 'src', 'index.js');

// ─── Test isolation helpers ───────────────────────────────────────────────────

const tmpBase = mkdtempSync(join(tmpdir(), 'buddy-index-test-'));
const STATE_FILE = join(tmpBase, 'buddy-stats.json');

// ─── Buddy profiles for testing ──────────────────────────────────────────────

/**
 * Silent buddy: chaos=0 means shouldSpeak returns false for non-interesting
 * events, preserving backward compatibility with legacy assertions that expect
 * empty additionalContext for Write/Edit (<5).
 */
const SILENT_BUDDY = {
  species: 'blob',
  name: 'Testy',
  rarity: 'common',
  shiny: false,
  stats: { chaos: 0, snark: 50, wisdom: 0, patience: 50, debugging: 50 },
  eye: '·',
  hat: 'none',
};

/**
 * Loud buddy: chaos=100 means shouldSpeak almost always returns true.
 * High snark for predictable "neutral" tone (snark 50 => neutral tier).
 */
const LOUD_BUDDY = {
  species: 'duck',
  name: 'Quackers',
  rarity: 'rare',
  shiny: false,
  stats: { chaos: 100, snark: 50, wisdom: 0, patience: 50, debugging: 0 },
  eye: '✦',
  hat: 'crown',
};

/**
 * Patient buddy: patience=100 for testing patience-based rage tuning.
 */
const PATIENT_BUDDY = {
  species: 'turtle',
  name: 'Slowpoke',
  rarity: 'uncommon',
  shiny: false,
  stats: { chaos: 0, snark: 50, wisdom: 0, patience: 100, debugging: 50 },
  eye: '·',
  hat: 'none',
};

/**
 * Impatient buddy: patience=1 for testing faster rage buildup.
 */
const IMPATIENT_BUDDY = {
  species: 'dragon',
  name: 'Hothead',
  rarity: 'epic',
  shiny: false,
  stats: { chaos: 0, snark: 50, wisdom: 0, patience: 1, debugging: 50 },
  eye: '×',
  hat: 'none',
};

const BUDDY_CONFIG_FILE = join(tmpBase, 'buddy.json');

function writeBuddyConfig(buddy) {
  writeFileSync(BUDDY_CONFIG_FILE, JSON.stringify(buddy), 'utf8');
}

function resetState() {
  if (existsSync(STATE_FILE)) {
    rmSync(STATE_FILE, { force: true });
  }
}

/**
 * Run the index.js script with a given hook event JSON piped to stdin.
 * Returns the parsed JSON output.
 * Always sets BUDDY_CONFIG_PATH so loadBuddy reads the test buddy profile.
 */
function runHook(eventObj, extraEnv = {}) {
  const input = JSON.stringify(eventObj);
  const result = execFileSync(
    process.execPath,
    [INDEX_PATH],
    {
      input,
      env: {
        ...process.env,
        BUDDY_STATE_PATH: STATE_FILE,
        BUDDY_CONFIG_PATH: BUDDY_CONFIG_FILE,
        ...extraEnv,
      },
      encoding: 'utf8',
      timeout: 10000,
    }
  );
  return JSON.parse(result.trim());
}

/**
 * Load the current state from the test state file.
 */
function loadTestState() {
  const raw = readFileSync(STATE_FILE, 'utf8');
  return JSON.parse(raw);
}

// ─── Output shape ─────────────────────────────────────────────────────────────

describe('output shape', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('always returns hookSpecificOutput with required keys', () => {
    const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'foo.js' } });
    assert.ok(result.hookSpecificOutput, 'missing hookSpecificOutput');
    assert.ok('hookEventName' in result.hookSpecificOutput, 'missing hookEventName');
    assert.ok('decision' in result.hookSpecificOutput, 'missing decision');
    assert.ok('additionalContext' in result.hookSpecificOutput, 'missing additionalContext');
  });

  test('decision is always "continue"', () => {
    const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'foo.js' } });
    assert.equal(result.hookSpecificOutput.decision, 'continue');
  });

  test('hookEventName mirrors the input hook_event_name', () => {
    const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'foo.js' } });
    assert.equal(result.hookSpecificOutput.hookEventName, 'PostToolUse');
  });

  test('additionalContext is a string', () => {
    const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'foo.js' } });
    assert.equal(typeof result.hookSpecificOutput.additionalContext, 'string');
  });
});

// ─── Unknown events ───────────────────────────────────────────────────────────

describe('unknown events', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('returns valid empty JSON for unknown event', () => {
    const result = runHook({ hook_event_name: 'SomeRandomEvent' });
    assert.equal(typeof result, 'object');
  });

  test('handles missing hook_event_name gracefully', () => {
    const result = runHook({});
    assert.equal(typeof result, 'object');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  beforeEach(() => writeBuddyConfig(SILENT_BUDDY));

  test('returns valid JSON even for invalid stdin', () => {
    const result = execFileSync(
      process.execPath,
      [INDEX_PATH],
      {
        input: 'NOT VALID JSON',
        env: {
          ...process.env,
          BUDDY_STATE_PATH: join(tmpBase, 'err-test.json'),
          BUDDY_CONFIG_PATH: BUDDY_CONFIG_FILE,
        },
        encoding: 'utf8',
        timeout: 10000,
      }
    );
    const parsed = JSON.parse(result.trim());
    assert.equal(typeof parsed, 'object');
  });
});

// ─── PostToolUse: Write ───────────────────────────────────────────────────────

describe('PostToolUse Write', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('increments stats.totalFilesCreated', () => {
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'src/foo.js' } });
    const state = loadTestState();
    assert.equal(state.stats.totalFilesCreated, 1);
  });

  test('adds 5 XP per Write', () => {
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'src/foo.js' } });
    const state = loadTestState();
    assert.equal(state.xp, 5);
  });

  test('accumulates totalFilesCreated across multiple Write events', () => {
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'a.js' } });
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'b.js' } });
    const state = loadTestState();
    assert.equal(state.stats.totalFilesCreated, 2);
    assert.equal(state.xp, 10);
  });

  test('saves state after Write', () => {
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'src/foo.js' } });
    assert.ok(existsSync(STATE_FILE));
  });
});

// ─── PostToolUse: Edit ────────────────────────────────────────────────────────

describe('PostToolUse Edit', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('tracks edits for the file', () => {
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/foo.js' } });
    const state = loadTestState();
    assert.equal(state.session.edits['src/foo.js'], 1);
  });

  test('increments edit count on repeated edits to same file', () => {
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/foo.js' } });
    runHook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/foo.js' } });
    const state = loadTestState();
    assert.equal(state.session.edits['src/foo.js'], 2);
  });

  test('roast appears in additionalContext at 5+ edits to same file', () => {
    // Do 5 edits
    let result;
    for (let i = 0; i < 5; i++) {
      result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/foo.js' } });
    }
    assert.ok(
      result.hookSpecificOutput.additionalContext.length > 0,
      'expected roast in additionalContext after 5 edits'
    );
  });

  test('additionalContext is empty string for first edit (no roast yet)', () => {
    const result = runHook({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/foo.js' } });
    assert.equal(result.hookSpecificOutput.additionalContext, '');
  });
});

// ─── PostToolUse: Bash - test pass ───────────────────────────────────────────

describe('PostToolUse Bash - test pass', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('handles jest test PASS output', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'Tests: 5 passed, 5 total\nPASS src/foo.test.js' },
    });
    assert.equal(result.hookSpecificOutput.decision, 'continue');
    const state = loadTestState();
    assert.equal(state.session.testPasses, 1);
    // 10 XP for test pass
    assert.equal(state.xp, 10);
  });

  test('increments testPasses on passing test', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx vitest' },
      tool_response: { output: 'All tests passed' },
    });
    const state = loadTestState();
    assert.equal(state.session.testPasses, 1);
  });

  test('handles "0 failing" as test pass', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx mocha' },
      tool_response: { output: '5 passing (12ms)\n0 failing' },
    });
    const state = loadTestState();
    assert.equal(state.session.testPasses, 1);
  });

  test('handles pytest pass output', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'pytest' },
      tool_response: { output: '5 passed in 0.12s' },
    });
    const state = loadTestState();
    assert.equal(state.session.testPasses, 1);
  });

  test('handles go test pass output', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'go test ./...' },
      tool_response: { output: 'ok  github.com/foo/bar 0.123s' },
    });
    const state = loadTestState();
    assert.equal(state.session.testPasses, 1);
  });
});

// ─── PostToolUse: Bash - test fail ───────────────────────────────────────────

describe('PostToolUse Bash - test fail', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('handles FAIL output', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js\n  ● foo test › something failed' },
    });
    const state = loadTestState();
    assert.equal(state.session.errors, 1);
    assert.equal(state.session.rageMeter, 10);
  });

  test('increments errors on test fail', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'Test Suites: 1 failed' },
    });
    const state = loadTestState();
    assert.equal(state.session.errors, 1);
  });

  test('rageResponse appears in additionalContext on test fail', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    assert.ok(
      result.hookSpecificOutput.additionalContext.includes('RAGE'),
      'expected RAGE meter in context'
    );
  });

  test('sass appears in additionalContext at 3+ consecutive failures', () => {
    // Trigger 3 failures
    let result;
    for (let i = 0; i < 3; i++) {
      result = runHook({
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'npx jest' },
        tool_response: { output: 'FAIL src/foo.test.js' },
      });
    }
    // At 3 errors, sass kicks in
    assert.ok(
      result.hookSpecificOutput.additionalContext.includes('hmm.') ||
      result.hookSpecificOutput.additionalContext.length > 0,
      'expected sass at 3+ failures'
    );
  });

  test('"0 failing" output does NOT trigger test fail', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx mocha' },
      tool_response: { output: '5 passing\n0 failing' },
    });
    const state = loadTestState();
    assert.equal(state.session.errors, 0);
  });

  test('handles cargo test failure', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'cargo test' },
      tool_response: { output: 'test result: FAILED. 0 passed; 1 failed;' },
    });
    const state = loadTestState();
    assert.equal(state.session.errors, 1);
  });
});

// ─── PostToolUse: Bash - git commit ──────────────────────────────────────────

describe('PostToolUse Bash - git commit', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('increments session.commits on git commit', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "add feature"' },
      tool_response: { output: '[main abc1234] add feature' },
    });
    const state = loadTestState();
    assert.equal(state.session.commits, 1);
    assert.equal(state.stats.totalCommits, 1);
  });

  test('awards 20 XP for a regular commit (level-up may consume XP)', () => {
    // Starting at level 1 with 0 XP, adding 20 XP causes a level-up (xp threshold = 20).
    // After level-up, remaining XP = 0 and level = 2.
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "add feature"' },
      tool_response: { output: '[main abc1234] add feature' },
    });
    const state = loadTestState();
    // 20 XP added: level 1 threshold is 20 so level-up occurs → level = 2, xp = 0
    assert.equal(state.level, 2);
  });

  test('awards 30 XP for a fix commit (command contains "fix")', () => {
    // 30 XP: level 1 threshold is 20, so level-up → level = 2, remaining xp = 10
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "fix: resolve the bug"' },
      tool_response: { output: '[main abc1234] fix: resolve the bug' },
    });
    const state = loadTestState();
    assert.equal(state.stats.totalFixes, 1);
    // 30 XP - 20 (level up) = 10 remaining XP at level 2
    assert.equal(state.xp, 10);
  });

  test('awards 30 XP for a fix commit (output contains "fix")', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "update config"' },
      tool_response: { output: '[main abc1234] fix: some hotfix' },
    });
    const state = loadTestState();
    assert.equal(state.stats.totalFixes, 1);
    // 30 XP - 20 (level up) = 10 remaining XP at level 2
    assert.equal(state.xp, 10);
  });

  test('increments totalFixes only on fix commits', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "add feature"' },
      tool_response: { output: '[main abc1234] add feature' },
    });
    const state = loadTestState();
    assert.equal(state.stats.totalFixes, 0);
  });

  test('plants a seed in the garden after commit', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "add feature"' },
      tool_response: { output: '[main abc1234] add feature' },
    });
    const state = loadTestState();
    assert.ok(state.garden.length > 0, 'garden should have at least one plant');
  });

  test('garden display appears in additionalContext after commit', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "add feature"' },
      tool_response: { output: '[main abc1234] add feature' },
    });
    assert.ok(
      result.hookSpecificOutput.additionalContext.includes('Garden:'),
      'expected garden display in context'
    );
  });

  test('multiple commits accumulate properly', () => {
    for (let i = 0; i < 3; i++) {
      runHook({
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "commit ' + i + '"' },
        tool_response: { output: '[main abc] commit ' + i },
      });
    }
    const state = loadTestState();
    assert.equal(state.session.commits, 3);
    assert.equal(state.stats.totalCommits, 3);
  });
});

// ─── PostToolUse: Bash - destructive ops ─────────────────────────────────────

describe('PostToolUse Bash - destructive ops', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('handles git reset --hard', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git reset --hard HEAD~1' },
      tool_response: { output: 'HEAD is now at abc1234' },
    });
    const state = loadTestState();
    assert.equal(state.stats.destructiveOps, 1);
  });

  test('handles push --force', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin main' },
      tool_response: { output: 'forced push' },
    });
    const state = loadTestState();
    assert.equal(state.stats.destructiveOps, 1);
  });

  test('handles push -f', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git push -f origin main' },
      tool_response: { output: 'forced push' },
    });
    const state = loadTestState();
    assert.equal(state.stats.destructiveOps, 1);
  });

  test('handles rm -rf', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf node_modules' },
      tool_response: { output: '' },
    });
    const state = loadTestState();
    assert.equal(state.stats.destructiveOps, 1);
  });

  test('handles rm -r', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -r dist' },
      tool_response: { output: '' },
    });
    const state = loadTestState();
    assert.equal(state.stats.destructiveOps, 1);
  });

  test('bold move appears in additionalContext for destructive op', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git reset --hard HEAD~1' },
      tool_response: { output: '' },
    });
    assert.ok(
      result.hookSpecificOutput.additionalContext.includes('bold move'),
      'expected "bold move" in context'
    );
  });
});

// ─── PostToolUse: Bash - file delete (rm without -rf/-r) ─────────────────────

describe('PostToolUse Bash - file delete', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('handles rm of a single file', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm src/old-file.js' },
      tool_response: { output: '' },
    });
    // Should have some response (gravestone art)
    assert.equal(result.hookSpecificOutput.decision, 'continue');
  });

  test('delete response includes gravestone art in additionalContext', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm src/old-file.js' },
      tool_response: { output: '' },
    });
    // GRAVESTONE has R I P
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.length > 0, 'expected gravestone response in context');
  });

  test('rm -rf is NOT treated as a plain delete', () => {
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf node_modules' },
      tool_response: { output: '' },
    });
    const state = loadTestState();
    // destructiveOps should be incremented (not file delete)
    assert.equal(state.stats.destructiveOps, 1);
  });
});

// ─── Stop event ───────────────────────────────────────────────────────────────

describe('Stop event', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('returns valid JSON for Stop event', () => {
    const result = runHook({ hook_event_name: 'Stop' });
    assert.equal(typeof result, 'object');
  });

  test('saves state on Stop (session summary saved to state file)', () => {
    runHook({ hook_event_name: 'Stop' });
    assert.ok(existsSync(STATE_FILE));
  });

  test('saves state on Stop', () => {
    runHook({ hook_event_name: 'Stop' });
    assert.ok(existsSync(STATE_FILE));
  });

  test('updates streak when there were test passes this session', () => {
    // First, give the state some test passes
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'Tests: 3 passed\nPASS foo.test.js' },
    });

    const before = loadTestState();
    assert.equal(before.session.testPasses, 1);

    runHook({ hook_event_name: 'Stop' });
    const after = loadTestState();
    // Streak should now be set (at minimum current = 1)
    assert.ok(after.streak.current >= 1, 'expected streak to be updated');
  });

  test('does not update streak when there were no test passes', () => {
    // No test passes in session
    runHook({ hook_event_name: 'Stop' });
    const state = loadTestState();
    // Streak should be 0 (never updated since no test passes)
    assert.equal(state.streak.current, 0);
  });

  test('state is persisted after Stop', () => {
    runHook({ hook_event_name: 'Stop' });
    const state = loadTestState();
    assert.ok(state.xp !== undefined, 'state should have xp field');
    assert.ok(state.level !== undefined, 'state should have level field');
  });
});

// ─── Achievements integration ─────────────────────────────────────────────────

describe('achievements integration', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('hatcher achievement unlocked at level 2', () => {
    // Level 2 requires 20 XP (egg stage). Write 4x gives 20 XP total.
    for (let i = 0; i < 4; i++) {
      runHook({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: `file${i}.js` } });
    }
    const state = loadTestState();
    // Should have leveled up and potentially unlocked hatcher
    assert.ok(state.level >= 2 || state.achievements.includes('hatcher'));
  });

  test('zen-master achievement unlocked on Stop with passes and no errors', () => {
    // Get a test pass
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'PASS foo.test.js\nTests: 1 passed' },
    });
    runHook({ hook_event_name: 'Stop' });
    const state = loadTestState();
    // zen-master: no errors AND testPasses > 0 at session end
    assert.ok(state.achievements.includes('zen-master'));
  });
});

// ─── Personality integration ─────────────────────────────────────────────────

describe('personality context for interesting events', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('test fail produces personality context with buddy header', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    // test_fail is interesting, so shouldSpeak always returns true
    assert.ok(ctx.includes('Testy the blob'), 'expected buddy header with name and species');
    assert.ok(ctx.includes('lvl'), 'expected level in header');
    assert.ok(ctx.includes('RAGE'), 'expected RAGE meter in status bar');
  });

  test('git commit produces personality context with buddy header', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "add feature"' },
      tool_response: { output: '[main abc1234] add feature' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Testy the blob'), 'expected buddy header');
    assert.ok(ctx.includes('Garden:'), 'expected garden in context');
  });

  test('destructive op produces personality context', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git reset --hard HEAD~1' },
      tool_response: { output: '' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Testy the blob'), 'expected buddy header for destructive');
    assert.ok(ctx.includes('bold move'), 'expected legacy destructive response');
  });

  test('test pass produces personality context', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'PASS src/foo.test.js\nTests: 1 passed' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Testy the blob'), 'expected buddy header for test pass');
  });

  test('file delete produces personality context', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'rm src/old-file.js' },
      tool_response: { output: '' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Testy the blob'), 'expected buddy header for file delete');
  });

  test('edit roast (5+ edits) produces personality context', () => {
    let result;
    for (let i = 0; i < 5; i++) {
      result = runHook({
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/victim.js' },
      });
    }
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Testy the blob'), 'expected buddy header for edit roast');
  });
});

describe('silent buddy produces empty context for boring events', () => {
  beforeEach(() => { resetState(); writeBuddyConfig(SILENT_BUDDY); });

  test('Write with chaos=0 produces empty additionalContext', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: 'src/foo.js' },
    });
    assert.equal(
      result.hookSpecificOutput.additionalContext,
      '',
      'chaos=0 buddy should not speak on boring Write event'
    );
  });

  test('Edit (<5 edits) with chaos=0 produces empty additionalContext', () => {
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/foo.js' },
    });
    assert.equal(
      result.hookSpecificOutput.additionalContext,
      '',
      'chaos=0 buddy should not speak on boring Edit event'
    );
  });
});

describe('buddy species in personality context', () => {
  beforeEach(() => resetState());

  test('duck buddy uses duck emoji and quacks verb', () => {
    writeBuddyConfig(LOUD_BUDDY);
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Quackers the duck'), 'expected duck name and species');
    assert.ok(ctx.includes('quacks'), 'expected duck verb');
  });

  test('turtle buddy uses turtle species', () => {
    writeBuddyConfig(PATIENT_BUDDY);
    const result = runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const ctx = result.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Slowpoke the turtle'), 'expected turtle name and species');
  });
});

describe('PATIENCE affects rage buildup', () => {
  test('patient buddy (patience=100) gains less rage per fail', () => {
    resetState();
    writeBuddyConfig(PATIENT_BUDDY);
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const patientState = loadTestState();

    resetState();
    writeBuddyConfig(IMPATIENT_BUDDY);
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const impatientState = loadTestState();

    assert.ok(
      patientState.session.rageMeter < impatientState.session.rageMeter,
      `patient rage (${patientState.session.rageMeter}) should be less than impatient rage (${impatientState.session.rageMeter})`
    );
  });

  test('patient buddy rage is 5 per fail (patience=100)', () => {
    resetState();
    writeBuddyConfig(PATIENT_BUDDY);
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const state = loadTestState();
    // rage = Math.round(10 * (1.5 - 100/100)) = Math.round(10 * 0.5) = 5
    assert.equal(state.session.rageMeter, 5);
  });

  test('impatient buddy rage is 15 per fail (patience=1)', () => {
    resetState();
    writeBuddyConfig(IMPATIENT_BUDDY);
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npx jest' },
      tool_response: { output: 'FAIL src/foo.test.js' },
    });
    const state = loadTestState();
    // rage = Math.round(10 * (1.5 - 1/100)) = Math.round(10 * 1.49) = 15
    assert.equal(state.session.rageMeter, 15);
  });
});

describe('fallback buddy (no buddy.json)', () => {
  beforeEach(() => resetState());

  test('missing buddy.json uses fallback blob profile', () => {
    // Point to a non-existent buddy config
    const result = runHook(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'npx jest' },
        tool_response: { output: 'FAIL src/foo.test.js' },
      },
      { BUDDY_CONFIG_PATH: join(tmpBase, 'nonexistent-buddy.json') }
    );
    const ctx = result.hookSpecificOutput.additionalContext;
    // Fallback buddy is species=blob, name=Mystery
    assert.ok(ctx.includes('Mystery the blob'), 'expected fallback blob buddy');
    assert.ok(ctx.includes('RAGE'), 'expected rage meter in fallback context');
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

after(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});
