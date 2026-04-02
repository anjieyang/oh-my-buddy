import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ACHIEVEMENT_BANNER,
  ADULT_FRAMES,
  BABY_FRAMES,
  EGG_FRAMES,
  EXPLOSIONS,
  GRAVESTONE,
  LEGENDARY_FRAMES,
  LEVEL_UP_BANNER,
  RAGE_FACES,
  RELIEF,
  SKULL,
  TEEN_FRAMES,
} from '../src/art/frames.js';
import {
  renderAchievement,
  renderBuddyArt,
  renderExplosion,
  renderGarden,
  renderLevelUp,
  renderRageMeter,
  renderSessionSummary,
  wrapOutput,
} from '../src/render.js';

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_PATTERN, '');
}

describe('frames exports', () => {
  test('exports arrays, objects, and strings with required shapes', () => {
    assert.equal(EGG_FRAMES.length, 5);
    assert.ok(EGG_FRAMES.every((frame) => typeof frame === 'string'));
    assert.ok(BABY_FRAMES.length >= 1);
    assert.ok(TEEN_FRAMES.length >= 1);
    assert.ok(ADULT_FRAMES.length >= 1);
    assert.ok(LEGENDARY_FRAMES.length >= 1);
    assert.deepEqual(Object.keys(EXPLOSIONS).sort(), ['large', 'medium', 'small']);
    assert.deepEqual(Object.keys(RAGE_FACES).sort(), [
      'calm',
      'flames',
      'meltdown',
      'sideEye',
      'sweating',
    ]);
    assert.equal(typeof LEVEL_UP_BANNER, 'string');
    assert.equal(typeof ACHIEVEMENT_BANNER, 'string');
    assert.equal(typeof RELIEF, 'string');
    assert.equal(typeof GRAVESTONE, 'string');
    assert.equal(typeof SKULL, 'string');
  });
});

describe('renderBuddyArt', () => {
  test('uses progressive egg frames by level', () => {
    assert.equal(renderBuddyArt('egg', 1), EGG_FRAMES[0]);
    assert.equal(renderBuddyArt('egg', 5), EGG_FRAMES[4]);
  });

  test('clamps level for frame selection and supports all stages', () => {
    assert.equal(renderBuddyArt('baby', 99), BABY_FRAMES[BABY_FRAMES.length - 1]);
    assert.equal(renderBuddyArt('teen', 1), TEEN_FRAMES[0]);
    assert.equal(renderBuddyArt('adult', 1), ADULT_FRAMES[0]);
    assert.equal(renderBuddyArt('legendary', 1), LEGENDARY_FRAMES[0]);
  });
});

describe('renderRageMeter', () => {
  test('clamps percent below and above bounds', () => {
    const low = stripAnsi(renderRageMeter(-5));
    const high = stripAnsi(renderRageMeter(140));

    assert.match(low, /\[░░░░░░░░░░\] 0% RAGE/);
    assert.match(high, /\[██████████\] 100% RAGE/);
  });

  test('uses green, yellow, and red thresholds', () => {
    assert.ok(renderRageMeter(0).includes('\x1b[32m'));
    assert.ok(renderRageMeter(34).includes('\x1b[33m'));
    assert.ok(renderRageMeter(67).includes('\x1b[31m'));
  });
});

describe('renderExplosion', () => {
  test('returns correct explosion sizes for thresholds', () => {
    assert.equal(renderExplosion(1), EXPLOSIONS.small);
    assert.equal(renderExplosion(3), EXPLOSIONS.medium);
    assert.equal(renderExplosion(6), EXPLOSIONS.large);
  });

  test('returns empty string when there are no errors', () => {
    assert.equal(renderExplosion(0), '');
  });
});

describe('renderLevelUp', () => {
  test('includes banner, art, and level details', () => {
    const output = renderLevelUp(5, 'egg');
    assert.ok(output.includes(LEVEL_UP_BANNER.trim()));
    assert.ok(output.includes(EGG_FRAMES[4].trim()));
    assert.ok(output.includes('Stage:'));
    assert.ok(output.includes('Level:'));
  });
});

describe('renderAchievement', () => {
  test('includes achievement banner, name, and badge', () => {
    const output = renderAchievement('First Fix', 'Bug Smasher');
    assert.ok(output.includes(ACHIEVEMENT_BANNER.trim()));
    assert.ok(output.includes('First Fix'));
    assert.ok(output.includes('Bug Smasher'));
  });
});

describe('renderGarden', () => {
  test('renders all supported plot types in order', () => {
    const output = renderGarden([
      { type: 'seed' },
      { type: 'sprout' },
      { type: 'flower' },
      { type: 'tree' },
    ]);

    assert.equal(output, 'Garden: [.] [i] [*] [Y]');
  });

  test('handles an empty garden', () => {
    assert.equal(renderGarden([]), 'Garden: (empty)');
  });
});

describe('renderSessionSummary', () => {
  test('includes the requested state fields and garden output', () => {
    const summary = stripAnsi(
      renderSessionSummary({
        xp: 120,
        level: 7,
        stage: 'teen',
        streak: { current: 4 },
        session: { commits: 3, testPasses: 8, errors: 2, rageMeter: 45 },
        garden: [{ type: 'flower' }, { type: 'tree' }],
      })
    );

    assert.ok(summary.includes('Buddy Session Summary'));
    assert.ok(summary.includes('XP: 120'));
    assert.ok(summary.includes('Level: 7'));
    assert.ok(summary.includes('Stage: Teen'));
    assert.ok(summary.includes('Streak: 4'));
    assert.ok(summary.includes('Commits: 3'));
    assert.ok(summary.includes('Tests: 8'));
    assert.ok(summary.includes('Errors: 2'));
    assert.ok(summary.includes('Garden: [*] [Y]'));
    assert.ok(summary.includes('[█████░░░░░] 45% RAGE'));
  });
});

describe('wrapOutput', () => {
  test('draws a box around plain text', () => {
    const wrapped = wrapOutput('alpha\nbeta');
    const lines = wrapped.split('\n');

    assert.equal(lines[0], '┌───────┐');
    assert.equal(lines[1], '│ alpha │');
    assert.equal(lines[2], '│ beta  │');
    assert.equal(lines[3], '└───────┘');
  });

  test('computes width correctly when ANSI escapes are present', () => {
    const wrapped = wrapOutput('\x1b[32mgreen\x1b[0m');
    assert.equal(wrapped.split('\n')[0], '┌───────┐');
    assert.ok(wrapped.includes('\x1b[32mgreen\x1b[0m'));
  });
});

describe('implementation constraints', () => {
  test('render module does not depend on chalk', () => {
    const source = readFileSync(new URL('../src/render.js', import.meta.url), 'utf8');
    assert.equal(source.includes('chalk'), false);
  });
});
