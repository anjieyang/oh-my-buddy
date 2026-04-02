/**
 * buddy.js — Buddy detection module for buddy-hooks.
 *
 * Reimplements Claude Code's buddy hash algorithm to derive a user's
 * buddy species and stats from their account ID.
 *
 * Zero dependencies; Node.js built-in modules only.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SALT = 'friend-2026-401';

export const SPECIES = [
  'duck', 'goose', 'blob', 'cat', 'dragon', 'octopus', 'owl', 'penguin',
  'turtle', 'snail', 'ghost', 'axolotl', 'capybara', 'cactus', 'robot',
  'rabbit', 'mushroom', 'chonk',
];

export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'];

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const EYES = ['·', '✦', '×', '◉', '@', '°'];

export const HATS = ['none', 'crown', 'tophat', 'propeller', 'halo', 'wizard', 'beanie', 'tinyduck'];

export const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

export const RARITY_FLOOR = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 };

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * FNV-1a hash returning unsigned 32-bit integer.
 */
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG factory. Returns a function that produces floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a random element from arr using rng.
 */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Weighted random rarity selection using RARITY_WEIGHTS.
 */
export function rollRarity(rng) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll <= 0) return rarity;
  }
  return RARITIES[RARITIES.length - 1];
}

/**
 * Generate 5 stats with lowercase keys based on rarity.
 * Peak stat, dump stat, and others are determined by rng draws.
 */
export function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity];
  const peakIdx = Math.floor(rng() * STAT_NAMES.length);
  let dumpIdx;
  do {
    dumpIdx = Math.floor(rng() * STAT_NAMES.length);
  } while (dumpIdx === peakIdx);

  const stats = {};
  for (let i = 0; i < STAT_NAMES.length; i++) {
    const key = STAT_NAMES[i].toLowerCase();
    if (i === peakIdx) {
      stats[key] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (i === dumpIdx) {
      stats[key] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[key] = Math.min(100, Math.max(1, floor + Math.floor(rng() * 40)));
    }
  }
  return stats;
}

/**
 * Derive a buddy from a userId using FNV-1a hash + Mulberry32 PRNG.
 */
export function rollBuddy(userId) {
  const seed = hashString(userId + SALT);
  const rng = mulberry32(seed);

  const rarity = rollRarity(rng);
  const species = pick(rng, SPECIES);
  const eye = pick(rng, EYES);
  const hat = rarity === 'common' ? 'none' : pick(rng, HATS);
  const shiny = rng() < 0.01;
  const stats = rollStats(rng, rarity);

  return { species, rarity, eye, hat, shiny, stats };
}

/**
 * Load buddy config from ~/.claude/buddy-hooks/buddy.json
 * (or BUDDY_CONFIG_PATH env var). Returns fallback on missing/corrupt file.
 */
export function buddyConfigPath() {
  return process.env.BUDDY_CONFIG_PATH ??
    join(homedir(), '.claude', 'oh-my-buddy', 'buddy.json');
}

export function loadBuddy() {
  const fallback = {
    species: 'blob',
    name: 'Mystery',
    rarity: 'common',
    shiny: false,
    stats: { chaos: 50, snark: 50, wisdom: 50, patience: 50, debugging: 50 },
    eye: '·',
    hat: 'none',
  };

  const configPath = buddyConfigPath();

  // Try reading existing config
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    // Not found — try auto-detecting from account ID
  }

  // Auto-detect: derive buddy from user's Claude Code account
  const userId = detectUserId();
  if (userId) {
    const bones = rollBuddy(userId);
    const buddy = {
      ...bones,
      name: bones.species.charAt(0).toUpperCase() + bones.species.slice(1),
      detectedAt: new Date().toISOString().split('T')[0],
    };
    // Save for next time
    try {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(buddy, null, 2));
    } catch { /* best effort */ }
    return buddy;
  }

  return fallback;
}

/**
 * Attempt to read the Claude account user ID from known credential files.
 * Returns a string ID or null. Never throws.
 */
export function detectUserId() {
  const claudeDir = join(homedir(), '.claude');
  const candidates = [
    join(claudeDir, '.credentials.json'),
    join(claudeDir, 'config.json'),
  ];

  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      const id =
        data?.oauthAccount?.accountUuid ??
        data?.userID ??
        null;
      if (id && typeof id === 'string') return id;
    } catch {
      // File missing, unreadable, or not valid JSON — try next
    }
  }

  return null;
}
