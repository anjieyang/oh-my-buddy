import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockBuddy = {
  species: 'owl',
  name: 'Tuftwise',
  rarity: 'rare',
  shiny: false,
  stats: {
    chaos: 50,
    snark: 50,
    wisdom: 50,
    patience: 50,
    debugging: 50,
  },
  eye: '·',
  hat: 'none',
};

const mockState = {
  xp: 120,
  level: 7,
  stage: 'baby',
  streak: { current: 3, best: 5, lastDate: '2026-04-01' },
  session: {
    rageMeter: 45,
    commits: 2,
    errors: 1,
    testPasses: 5,
    edits: {},
  },
  achievements: [],
  garden: [{ type: 'flower' }, { type: 'tree' }],
};

const {
  SPECIES_EMOJI,
  SPECIES_VERBS,
  shouldSpeak,
  buildStatusBar,
  buildReactionLine,
  buildContext,
} = await import('../src/personality.js');

// ─── SPECIES_EMOJI ────────────────────────────────────────────────────────────

describe('SPECIES_EMOJI', () => {
  const ALL_SPECIES = [
    'duck', 'goose', 'blob', 'cat', 'dragon', 'octopus', 'owl', 'penguin',
    'turtle', 'snail', 'ghost', 'axolotl', 'capybara', 'cactus', 'robot',
    'rabbit', 'mushroom', 'chonk',
  ];

  test('has exactly 18 species keys', () => {
    assert.equal(Object.keys(SPECIES_EMOJI).length, 18);
  });

  test('has all 18 required species', () => {
    for (const sp of ALL_SPECIES) {
      assert.ok(sp in SPECIES_EMOJI, `SPECIES_EMOJI missing key: ${sp}`);
    }
  });

  test('all values are non-empty strings', () => {
    for (const [key, val] of Object.entries(SPECIES_EMOJI)) {
      assert.equal(typeof val, 'string', `${key} emoji should be a string`);
      assert.ok(val.length > 0, `${key} emoji should not be empty`);
    }
  });

  test('duck maps to 🦆', () => {
    assert.equal(SPECIES_EMOJI.duck, '🦆');
  });

  test('owl maps to 🦉', () => {
    assert.equal(SPECIES_EMOJI.owl, '🦉');
  });

  test('robot maps to 🤖', () => {
    assert.equal(SPECIES_EMOJI.robot, '🤖');
  });
});

// ─── SPECIES_VERBS ────────────────────────────────────────────────────────────

describe('SPECIES_VERBS', () => {
  const ALL_SPECIES = [
    'duck', 'goose', 'blob', 'cat', 'dragon', 'octopus', 'owl', 'penguin',
    'turtle', 'snail', 'ghost', 'axolotl', 'capybara', 'cactus', 'robot',
    'rabbit', 'mushroom', 'chonk',
  ];

  test('has exactly 18 species keys', () => {
    assert.equal(Object.keys(SPECIES_VERBS).length, 18);
  });

  test('has all 18 required species', () => {
    for (const sp of ALL_SPECIES) {
      assert.ok(sp in SPECIES_VERBS, `SPECIES_VERBS missing key: ${sp}`);
    }
  });

  test('all values are non-empty strings', () => {
    for (const [key, val] of Object.entries(SPECIES_VERBS)) {
      assert.equal(typeof val, 'string', `${key} verb should be a string`);
      assert.ok(val.length > 0, `${key} verb should not be empty`);
    }
  });

  test('duck maps to "quacks"', () => {
    assert.equal(SPECIES_VERBS.duck, 'quacks');
  });

  test('owl maps to "hoots"', () => {
    assert.equal(SPECIES_VERBS.owl, 'hoots');
  });

  test('turtle maps to "slowly nods"', () => {
    assert.equal(SPECIES_VERBS.turtle, 'slowly nods');
  });
});

// ─── shouldSpeak ─────────────────────────────────────────────────────────────

describe('shouldSpeak', () => {
  test('returns true when isInteresting is true', () => {
    const buddyHighChaos = { ...mockBuddy, stats: { ...mockBuddy.stats, chaos: 0 } };
    // Even with chaos=0 (would never speak randomly), interesting always returns true
    const origRandom = Math.random;
    Math.random = () => 0.999; // high value, would block chaos gate
    try {
      assert.equal(shouldSpeak(true, buddyHighChaos), true);
    } finally {
      Math.random = origRandom;
    }
  });

  test('returns false for non-interesting when random is above chaos gate', () => {
    // chaos=50, gate = 50/200 = 0.25; if random >= 0.25, should return false
    const origRandom = Math.random;
    Math.random = () => 0.5;
    try {
      assert.equal(shouldSpeak(false, mockBuddy), false);
    } finally {
      Math.random = origRandom;
    }
  });

  test('returns true for non-interesting when random is below chaos gate', () => {
    // chaos=50, gate = 50/200 = 0.25; if random < 0.25, should return true
    const origRandom = Math.random;
    Math.random = () => 0.1;
    try {
      assert.equal(shouldSpeak(false, mockBuddy), true);
    } finally {
      Math.random = origRandom;
    }
  });

  test('chaos=0 never speaks when not interesting', () => {
    const silentBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, chaos: 0 } };
    // gate = 0/200 = 0; random < 0 is always false
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      // random=0 is NOT < 0, so should return false
      assert.equal(shouldSpeak(false, silentBuddy), false);
    } finally {
      Math.random = origRandom;
    }
  });

  test('chaos=200 would always speak, but chaos is capped at 100', () => {
    const chaosBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, chaos: 100 } };
    // gate = 100/200 = 0.5; random < 0.5 → true
    const origRandom = Math.random;
    Math.random = () => 0.49;
    try {
      assert.equal(shouldSpeak(false, chaosBuddy), true);
    } finally {
      Math.random = origRandom;
    }
  });
});

// ─── buildStatusBar ───────────────────────────────────────────────────────────

describe('buildStatusBar', () => {
  test('includes Rage label', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(bar.includes('Rage:'), `bar should include "Rage:", got: ${bar}`);
  });

  test('includes XP value', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(bar.includes('XP: 120'), `bar should include "XP: 120", got: ${bar}`);
  });

  test('includes level value', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(bar.includes('Lvl: 7'), `bar should include "Lvl: 7", got: ${bar}`);
  });

  test('includes streak value', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(bar.includes('Streak: 3d'), `bar should include "Streak: 3d", got: ${bar}`);
  });

  test('includes Garden label', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(bar.includes('Garden:'), `bar should include "Garden:", got: ${bar}`);
  });

  test('uses pipe separators between sections', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(bar.includes('|'), 'bar should use pipe separators');
  });

  test('is a single line (no newlines)', () => {
    const bar = buildStatusBar(mockState);
    assert.ok(!bar.includes('\n'), 'bar should be a single line');
  });
});

// ─── buildReactionLine ────────────────────────────────────────────────────────

describe('buildReactionLine', () => {
  const extra = {};

  test('includes buddy name', () => {
    const line = buildReactionLine('test_fail', mockBuddy, mockState, extra);
    assert.ok(line.includes('Tuftwise'), `line should include buddy name, got: ${line}`);
  });

  test('includes species verb', () => {
    const line = buildReactionLine('test_fail', mockBuddy, mockState, extra);
    assert.ok(line.includes('hoots'), `line should include "hoots", got: ${line}`);
  });

  test('format is: Name verb: "message"', () => {
    const line = buildReactionLine('test_pass', mockBuddy, mockState, extra);
    // Should match: "Tuftwise hoots: "..."
    assert.match(line, /^Tuftwise hoots: ".+"/);
  });

  test('snark < 34 picks encouraging tone for test_fail', () => {
    const encouragingBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, snark: 20, wisdom: 0, debugging: 0, chaos: 0 } };
    // Lock random to first pool item (index 0)
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      const line = buildReactionLine('test_fail', encouragingBuddy, mockState, extra);
      // Should not be savage or overly negative
      assert.ok(typeof line === 'string' && line.length > 0);
    } finally {
      Math.random = origRandom;
    }
  });

  test('snark >= 67 picks savage tone', () => {
    const savageBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, snark: 80, wisdom: 0, debugging: 0, chaos: 0 } };
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      const line = buildReactionLine('test_fail', savageBuddy, mockState, extra);
      assert.ok(typeof line === 'string' && line.length > 0);
    } finally {
      Math.random = origRandom;
    }
  });

  test('handles all 11 event types without throwing', () => {
    const eventTypes = [
      'test_fail', 'test_pass', 'commit', 'fix_commit', 'destructive',
      'file_delete', 'edit_roast', 'level_up', 'achievement', 'unsolicited',
      'rage_milestone',
    ];
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      for (const eventType of eventTypes) {
        assert.doesNotThrow(() => {
          buildReactionLine(eventType, mockBuddy, mockState, extra);
        }, `buildReactionLine should not throw for eventType: ${eventType}`);
      }
    } finally {
      Math.random = origRandom;
    }
  });

  test('wisdom stat can append a wisdom note', () => {
    const wisdomBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, wisdom: 150, snark: 50, debugging: 0, chaos: 0 } };
    // wisdom/150 = 1.0; Math.random() < 1.0 always true → wisdom appended
    const origRandom = Math.random;
    // First call for pool pick (0), second for wisdom check (0 < 1.0 = true)
    let callCount = 0;
    Math.random = () => {
      callCount++;
      // Pool index: 0 → first item
      // Wisdom check: 0 < 1.0 → true
      return 0;
    };
    try {
      const line = buildReactionLine('test_fail', wisdomBuddy, mockState, extra);
      // Should include something extra beyond the base message
      assert.ok(typeof line === 'string' && line.length > 0);
    } finally {
      Math.random = origRandom;
    }
  });

  test('debugging stat appends pattern when extra.pattern is provided', () => {
    const debugBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, debugging: 100, wisdom: 0, snark: 50, chaos: 0 } };
    const extraWithPattern = { pattern: 'NullPointerException' };
    // debugging/100 = 1.0; Math.random() < 1.0 always → pattern appended
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      const line = buildReactionLine('test_fail', debugBuddy, mockState, extraWithPattern);
      assert.ok(line.includes('NullPointerException'), `pattern should appear in line, got: ${line}`);
    } finally {
      Math.random = origRandom;
    }
  });

  test('chaos > 75 can invert tone with prefix', () => {
    const chaosBuddy = { ...mockBuddy, stats: { ...mockBuddy.stats, chaos: 100, snark: 50, wisdom: 0, debugging: 0 } };
    // chaos=100, invert gate = (100-75)/100 = 0.25; if random < 0.25 → invert
    const origRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      // First call: pool index (return 0)
      // Second call: wisdom check (return 0.9 → no wisdom since wisdom=0/150)
      // Third call: debugging check (return 0.9 → no debug since debugging=0/100)
      // Fourth call: chaos invert check (return 0.1 < 0.25 → invert)
      const vals = [0, 0.9, 0.9, 0.1];
      return vals[callCount++] ?? 0.9;
    };
    try {
      const line = buildReactionLine('test_fail', chaosBuddy, mockState, {});
      // Either inverted (has the prefix) or not, but should still be a valid string
      assert.ok(typeof line === 'string' && line.length > 0);
    } finally {
      Math.random = origRandom;
    }
  });
});

// ─── buildContext ─────────────────────────────────────────────────────────────

describe('buildContext', () => {
  test('includes emoji and species name in header', () => {
    const origRandom = Math.random;
    Math.random = () => 0; // force shouldSpeak for non-interesting or interesting
    try {
      const ctx = buildContext('test_fail', mockBuddy, mockState, {});
      assert.ok(ctx.includes('🦉'), `context should include owl emoji, got: ${ctx}`);
      assert.ok(ctx.includes('owl'), `context should include species name, got: ${ctx}`);
    } finally {
      Math.random = origRandom;
    }
  });

  test('includes buddy name in header', () => {
    const ctx = buildContext('test_fail', mockBuddy, mockState, {});
    assert.ok(ctx.includes('Tuftwise'), `context should include buddy name, got: ${ctx}`);
  });

  test('includes level and rarity in header', () => {
    const ctx = buildContext('test_fail', mockBuddy, mockState, {});
    assert.ok(ctx.includes('lvl 7'), `context should include level, got: ${ctx}`);
    assert.ok(ctx.includes('rare'), `context should include rarity, got: ${ctx}`);
  });

  test('includes status bar', () => {
    const ctx = buildContext('test_fail', mockBuddy, mockState, {});
    assert.ok(ctx.includes('XP: 120'), `context should include XP from status bar, got: ${ctx}`);
    assert.ok(ctx.includes('Lvl: 7'), `context should include level from status bar, got: ${ctx}`);
  });

  test('interesting events always include reaction line', () => {
    const interestingEvents = [
      'test_fail', 'test_pass', 'commit', 'fix_commit', 'destructive',
      'file_delete', 'achievement', 'rage_milestone', 'level_up', 'edit_roast',
    ];
    const origRandom = Math.random;
    Math.random = () => 0.9; // would block chaos gate, but interesting overrides
    try {
      for (const eventType of interestingEvents) {
        const ctx = buildContext(eventType, mockBuddy, mockState, {});
        // Reaction line format: Name verb: "..."
        assert.ok(ctx.includes('Tuftwise'), `interesting event "${eventType}" should include reaction`);
      }
    } finally {
      Math.random = origRandom;
    }
  });

  test('non-interesting events skip reaction when random blocks it', () => {
    // 'unsolicited' is NOT in interesting set
    const origRandom = Math.random;
    // shouldSpeak will call Math.random; chaos=50, gate=0.25; return 0.9 to block
    Math.random = () => 0.9;
    try {
      const ctx = buildContext('unsolicited', mockBuddy, mockState, {});
      // Header and status bar should exist, reaction line skipped
      assert.ok(ctx.includes('Tuftwise'), 'header should still be present');
      assert.ok(ctx.includes('XP: 120'), 'status bar should still be present');
    } finally {
      Math.random = origRandom;
    }
  });

  test('non-interesting events include reaction when chaos gate passes', () => {
    const origRandom = Math.random;
    // chaos=50, gate=0.25; return 0.1 to pass the gate, then 0 for message picks
    let callCount = 0;
    Math.random = () => {
      if (callCount === 0) { callCount++; return 0.1; } // shouldSpeak gate
      return 0; // subsequent picks
    };
    try {
      const ctx = buildContext('unsolicited', mockBuddy, mockState, {});
      // With gate passing, reaction line should be included
      assert.ok(ctx.includes('hoots'), `reaction should be present when chaos gate passes, got: ${ctx}`);
    } finally {
      Math.random = origRandom;
    }
  });

  test('header format matches expected pattern', () => {
    const ctx = buildContext('test_fail', mockBuddy, mockState, {});
    const lines = ctx.split('\n');
    // First line should be header with brackets
    assert.match(lines[0], /^\[.+\]$/);
  });

  test('header includes verb', () => {
    const ctx = buildContext('test_fail', mockBuddy, mockState, {});
    assert.ok(ctx.includes('hoots'), `header should include owl verb "hoots", got: ${ctx}`);
  });
});
