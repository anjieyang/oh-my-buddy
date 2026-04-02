import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

// Set up a temp dir for buddy config before importing the module
const tmpBase = mkdtempSync(join(tmpdir(), 'buddy-test-'));
const BUDDY_CONFIG_DIR = join(tmpBase, 'buddy-hooks');
mkdirSync(BUDDY_CONFIG_DIR, { recursive: true });
const BUDDY_CONFIG_FILE = join(BUDDY_CONFIG_DIR, 'buddy.json');
process.env.BUDDY_CONFIG_PATH = BUDDY_CONFIG_FILE;

const {
  SALT,
  SPECIES,
  STAT_NAMES,
  RARITIES,
  EYES,
  HATS,
  RARITY_WEIGHTS,
  RARITY_FLOOR,
  hashString,
  mulberry32,
  pick,
  rollRarity,
  rollStats,
  rollBuddy,
  loadBuddy,
  detectUserId,
} = await import('../src/buddy.js');

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('SALT is correct', () => {
    assert.equal(SALT, 'friend-2026-401');
  });

  test('SPECIES has 18 entries', () => {
    assert.equal(SPECIES.length, 18);
  });

  test('SPECIES contains expected values', () => {
    assert.ok(SPECIES.includes('duck'));
    assert.ok(SPECIES.includes('axolotl'));
    assert.ok(SPECIES.includes('capybara'));
    assert.ok(SPECIES.includes('robot'));
  });

  test('STAT_NAMES has 5 entries', () => {
    assert.equal(STAT_NAMES.length, 5);
    assert.deepEqual(STAT_NAMES, ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK']);
  });

  test('RARITIES has 5 entries', () => {
    assert.equal(RARITIES.length, 5);
    assert.deepEqual(RARITIES, ['common', 'uncommon', 'rare', 'epic', 'legendary']);
  });

  test('EYES has 6 entries', () => {
    assert.equal(EYES.length, 6);
  });

  test('HATS has 8 entries including none', () => {
    assert.equal(HATS.length, 8);
    assert.ok(HATS.includes('none'));
    assert.ok(HATS.includes('crown'));
    assert.ok(HATS.includes('tinyduck'));
  });

  test('RARITY_WEIGHTS keys match RARITIES', () => {
    for (const r of RARITIES) {
      assert.ok(r in RARITY_WEIGHTS, `RARITY_WEIGHTS missing key: ${r}`);
    }
  });

  test('RARITY_WEIGHTS values sum to 100', () => {
    const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(total, 100);
  });

  test('RARITY_FLOOR keys match RARITIES', () => {
    for (const r of RARITIES) {
      assert.ok(r in RARITY_FLOOR, `RARITY_FLOOR missing key: ${r}`);
    }
  });
});

// ─── hashString ───────────────────────────────────────────────────────────────

describe('hashString', () => {
  test('returns an unsigned 32-bit integer', () => {
    const h = hashString('hello');
    assert.ok(Number.isInteger(h), 'must be an integer');
    assert.ok(h >= 0, 'must be non-negative');
    assert.ok(h <= 0xFFFFFFFF, 'must be <= 2^32-1');
  });

  test('is consistent for the same input', () => {
    assert.equal(hashString('user123'), hashString('user123'));
  });

  test('differs for different inputs', () => {
    assert.notEqual(hashString('alice'), hashString('bob'));
  });

  test('handles empty string', () => {
    const h = hashString('');
    assert.ok(h >= 0 && h <= 0xFFFFFFFF);
  });

  test('known FNV-1a value: empty string = 2166136261', () => {
    // FNV offset basis with no iterations = 2166136261
    assert.equal(hashString(''), 2166136261);
  });

  test('produces unsigned output (never negative)', () => {
    const inputs = ['a', 'b', 'test', 'friend-2026-401', 'user-uuid-1234'];
    for (const s of inputs) {
      assert.ok(hashString(s) >= 0, `hashString("${s}") should be non-negative`);
    }
  });
});

// ─── mulberry32 ───────────────────────────────────────────────────────────────

describe('mulberry32', () => {
  test('returns a function', () => {
    assert.equal(typeof mulberry32(42), 'function');
  });

  test('produces values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
    }
  });

  test('is deterministic for the same seed', () => {
    const rng1 = mulberry32(999);
    const rng2 = mulberry32(999);
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  test('differs for different seeds', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    // At least one of the first 5 values should differ
    let different = false;
    for (let i = 0; i < 5; i++) {
      if (rng1() !== rng2()) different = true;
    }
    assert.ok(different, 'different seeds should produce different sequences');
  });

  test('seed 0 still produces valid output', () => {
    const rng = mulberry32(0);
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  });
});

// ─── pick ─────────────────────────────────────────────────────────────────────

describe('pick', () => {
  test('returns an element from the array', () => {
    const arr = ['a', 'b', 'c'];
    const rng = mulberry32(1);
    const result = pick(rng, arr);
    assert.ok(arr.includes(result));
  });

  test('returns single-element array item', () => {
    const rng = mulberry32(42);
    assert.equal(pick(rng, ['only']), 'only');
  });
});

// ─── rollRarity ──────────────────────────────────────────────────────────────

describe('rollRarity', () => {
  test('returns a valid rarity', () => {
    const rng = mulberry32(42);
    const r = rollRarity(rng);
    assert.ok(RARITIES.includes(r), `unexpected rarity: ${r}`);
  });

  test('common is the most frequent rarity', () => {
    const counts = {};
    for (const r of RARITIES) counts[r] = 0;

    // Run 1000 rolls with fresh RNG each time to count distribution
    for (let seed = 0; seed < 1000; seed++) {
      const rng = mulberry32(seed);
      counts[rollRarity(rng)]++;
    }

    // common should appear most often (weight 60 out of 100)
    assert.ok(counts.common > counts.uncommon, 'common should beat uncommon');
    assert.ok(counts.common > counts.rare, 'common should beat rare');
    assert.ok(counts.common > counts.epic, 'common should beat epic');
    assert.ok(counts.common > counts.legendary, 'common should beat legendary');
  });

  test('legendary is the rarest', () => {
    const counts = {};
    for (const r of RARITIES) counts[r] = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const rng = mulberry32(seed);
      counts[rollRarity(rng)]++;
    }
    assert.ok(counts.legendary < counts.rare, 'legendary should be rarer than rare');
  });
});

// ─── rollStats ────────────────────────────────────────────────────────────────

describe('rollStats', () => {
  test('returns object with all 5 lowercase stat keys', () => {
    const rng = mulberry32(1);
    const stats = rollStats(rng, 'common');
    assert.ok('debugging' in stats);
    assert.ok('patience' in stats);
    assert.ok('chaos' in stats);
    assert.ok('wisdom' in stats);
    assert.ok('snark' in stats);
  });

  test('all stat values are integers in [1, 100]', () => {
    for (const rarity of RARITIES) {
      const rng = mulberry32(77);
      const stats = rollStats(rng, rarity);
      for (const [key, val] of Object.entries(stats)) {
        assert.ok(Number.isInteger(val), `stat ${key} should be an integer`);
        assert.ok(val >= 1, `stat ${key}=${val} below minimum 1`);
        assert.ok(val <= 100, `stat ${key}=${val} above maximum 100`);
      }
    }
  });

  test('stats differ by rarity (legendary floor is higher)', () => {
    // Run multiple seeds to compare average stats
    let commonSum = 0, legendarySum = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng1 = mulberry32(seed * 7 + 1);
      const rng2 = mulberry32(seed * 7 + 1);
      const cs = rollStats(rng1, 'common');
      const ls = rollStats(rng2, 'legendary');
      commonSum += Object.values(cs).reduce((a, b) => a + b, 0);
      legendarySum += Object.values(ls).reduce((a, b) => a + b, 0);
    }
    assert.ok(legendarySum > commonSum, 'legendary stats should average higher than common');
  });

  test('is deterministic for same rng state and rarity', () => {
    const rng1 = mulberry32(55);
    const rng2 = mulberry32(55);
    const s1 = rollStats(rng1, 'rare');
    const s2 = rollStats(rng2, 'rare');
    assert.deepEqual(s1, s2);
  });
});

// ─── rollBuddy ────────────────────────────────────────────────────────────────

describe('rollBuddy', () => {
  test('returns object with all required fields', () => {
    const b = rollBuddy('user-123');
    assert.ok('species' in b);
    assert.ok('rarity' in b);
    assert.ok('eye' in b);
    assert.ok('hat' in b);
    assert.ok('shiny' in b);
    assert.ok('stats' in b);
  });

  test('species is in SPECIES list', () => {
    const b = rollBuddy('test-user');
    assert.ok(SPECIES.includes(b.species), `unexpected species: ${b.species}`);
  });

  test('rarity is in RARITIES list', () => {
    const b = rollBuddy('test-user');
    assert.ok(RARITIES.includes(b.rarity), `unexpected rarity: ${b.rarity}`);
  });

  test('eye is in EYES list', () => {
    const b = rollBuddy('test-user');
    assert.ok(EYES.includes(b.eye), `unexpected eye: ${b.eye}`);
  });

  test('hat is in HATS list', () => {
    const b = rollBuddy('test-user');
    assert.ok(HATS.includes(b.hat), `unexpected hat: ${b.hat}`);
  });

  test('shiny is a boolean', () => {
    const b = rollBuddy('test-user');
    assert.equal(typeof b.shiny, 'boolean');
  });

  test('common rarity always gets hat=none', () => {
    // Try many seeds until we find a common-rarity buddy, then check hat
    let foundCommon = false;
    for (let i = 0; i < 500; i++) {
      const b = rollBuddy(`seed-user-${i}`);
      if (b.rarity === 'common') {
        assert.equal(b.hat, 'none', `common rarity buddy should have hat=none but got ${b.hat}`);
        foundCommon = true;
      }
    }
    assert.ok(foundCommon, 'should have rolled at least one common rarity in 500 tries');
  });

  test('non-common rarities can get non-none hats', () => {
    let foundNonNoneHat = false;
    for (let i = 0; i < 500; i++) {
      const b = rollBuddy(`seed-user-${i}`);
      if (b.rarity !== 'common' && b.hat !== 'none') {
        foundNonNoneHat = true;
        break;
      }
    }
    assert.ok(foundNonNoneHat, 'should find at least one non-common buddy with a non-none hat');
  });

  test('is consistent for the same userId', () => {
    const b1 = rollBuddy('my-user-id');
    const b2 = rollBuddy('my-user-id');
    assert.deepEqual(b1, b2);
  });

  test('differs for different userIds', () => {
    const b1 = rollBuddy('user-aaa');
    const b2 = rollBuddy('user-bbb');
    // They can't be the same in every field (extremely improbable)
    const allSame =
      b1.species === b2.species &&
      b1.rarity === b2.rarity &&
      b1.eye === b2.eye &&
      b1.hat === b2.hat &&
      b1.shiny === b2.shiny;
    assert.ok(!allSame, 'different userIds should produce different buddies');
  });

  test('all 18 species are reachable across many seeds', () => {
    const found = new Set();
    for (let i = 0; i < 500; i++) {
      found.add(rollBuddy(`species-test-seed-${i}`).species);
    }
    for (const sp of SPECIES) {
      assert.ok(found.has(sp), `species "${sp}" was never rolled in 500 tries`);
    }
  });

  test('stats have all required keys', () => {
    const { stats } = rollBuddy('stats-test-user');
    assert.ok('debugging' in stats);
    assert.ok('patience' in stats);
    assert.ok('chaos' in stats);
    assert.ok('wisdom' in stats);
    assert.ok('snark' in stats);
  });

  test('stats values are in 1-100 range', () => {
    const { stats } = rollBuddy('stats-range-user');
    for (const [key, val] of Object.entries(stats)) {
      assert.ok(val >= 1 && val <= 100, `stat ${key}=${val} out of range`);
    }
  });
});

// ─── loadBuddy ────────────────────────────────────────────────────────────────

describe('loadBuddy', () => {
  test('returns fallback when file is missing', () => {
    // BUDDY_CONFIG_FILE does not exist at this point
    const b = loadBuddy();
    assert.equal(b.species, 'blob');
    assert.equal(b.name, 'Mystery');
    assert.equal(b.rarity, 'common');
    assert.equal(b.shiny, false);
    assert.equal(b.eye, '·');
    assert.equal(b.hat, 'none');
  });

  test('fallback has correct stats shape', () => {
    const b = loadBuddy();
    assert.deepEqual(b.stats, {
      chaos: 50,
      snark: 50,
      wisdom: 50,
      patience: 50,
      debugging: 50,
    });
  });

  test('returns parsed JSON when file is present', () => {
    const data = {
      species: 'dragon',
      name: 'Sparky',
      rarity: 'legendary',
      shiny: true,
      stats: { chaos: 90, snark: 80, wisdom: 70, patience: 60, debugging: 95 },
      eye: '◉',
      hat: 'crown',
    };
    writeFileSync(BUDDY_CONFIG_FILE, JSON.stringify(data), 'utf8');
    const b = loadBuddy();
    assert.equal(b.species, 'dragon');
    assert.equal(b.name, 'Sparky');
    assert.equal(b.rarity, 'legendary');
    assert.equal(b.shiny, true);
  });

  test('returns fallback when file is corrupt JSON', () => {
    writeFileSync(BUDDY_CONFIG_FILE, '{ BAD JSON !!!', 'utf8');
    const b = loadBuddy();
    assert.equal(b.species, 'blob');
  });
});

// ─── detectUserId ─────────────────────────────────────────────────────────────

describe('detectUserId', () => {
  test('returns null when no credentials files exist', () => {
    // In test environment, the real ~/.claude files may or may not exist.
    // We can only reliably test the no-throw guarantee and the return type.
    const result = detectUserId();
    assert.ok(result === null || typeof result === 'string', 'should return null or string');
  });

  test('never throws', () => {
    assert.doesNotThrow(() => detectUserId());
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

after(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});
