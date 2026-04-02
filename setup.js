import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  detectUserId,
  RARITIES,
  rollBuddy,
  SPECIES,
  STAT_NAMES,
} from './src/buddy.js';

const ANSI = {
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
};

const DEFAULT_STATS = {
  chaos: 50,
  debugging: 50,
  patience: 50,
  snark: 50,
  wisdom: 50,
};

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeStats(stats = {}) {
  const nextStats = { ...DEFAULT_STATS };
  for (const [key, value] of Object.entries(stats)) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      nextStats[key] = numericValue;
    }
  }
  return nextStats;
}

export function getProjectRoot() {
  return dirname(fileURLToPath(import.meta.url));
}

export function getBuddyConfigPath() {
  return (
    process.env.BUDDY_CONFIG_PATH ??
    join(homedir(), '.claude', 'buddy-hooks', 'buddy.json')
  );
}

export function getSettingsPath() {
  return (
    process.env.CLAUDE_SETTINGS_PATH ??
    join(homedir(), '.claude', 'settings.json')
  );
}

export function getHookCommand(projectRoot = getProjectRoot()) {
  return `node ${join(projectRoot, 'src', 'index.js')}`;
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

function writeJsonFile(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function removeBuddyHooks(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return entry;
      }

      const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
      const filteredHooks = hooks.filter((hook) => {
        const command = hook?.command;
        return typeof command !== 'string' || !command.includes('buddy-hooks');
      });

      if (hooks.length > 0 && filteredHooks.length === 0) {
        return null;
      }

      if (filteredHooks.length !== hooks.length) {
        return { ...entry, hooks: filteredHooks };
      }

      return entry;
    })
    .filter(Boolean);
}

export function mergeBuddyHooksIntoSettings(
  settings = {},
  projectRoot = getProjectRoot()
) {
  const command = getHookCommand(projectRoot);
  const nextSettings = {
    ...settings,
    hooks:
      settings?.hooks && typeof settings.hooks === 'object'
        ? { ...settings.hooks }
        : {},
  };

  for (const hookName of ['PostToolUse', 'Stop']) {
    const existingEntries = removeBuddyHooks(nextSettings.hooks[hookName]);
    nextSettings.hooks[hookName] = [
      ...existingEntries,
      {
        matcher: '',
        hooks: [{ type: 'command', command }],
      },
    ];
  }

  return nextSettings;
}

export function installBuddyHooks(
  settingsPath = getSettingsPath(),
  projectRoot = getProjectRoot()
) {
  const settings = readJsonFile(settingsPath, {});
  const nextSettings = mergeBuddyHooksIntoSettings(settings, projectRoot);
  writeJsonFile(settingsPath, nextSettings);
  return nextSettings;
}

export function writeBuddyProfile(
  profile,
  configPath = getBuddyConfigPath()
) {
  const nextProfile = {
    ...profile,
    species: String(profile?.species ?? '').trim().toLowerCase(),
    rarity: String(profile?.rarity ?? 'common').trim().toLowerCase() || 'common',
    shiny: Boolean(profile?.shiny),
    eye: String(profile?.eye ?? '·').trim() || '·',
    hat: String(profile?.hat ?? 'none').trim().toLowerCase() || 'none',
    stats: normalizeStats(profile?.stats),
  };

  if (!nextProfile.name) {
    nextProfile.name = titleCase(nextProfile.species) || 'Buddy';
  }

  writeJsonFile(configPath, nextProfile);
  return nextProfile;
}

export function parseBuddyOutput(text) {
  const source = String(text ?? '');
  const lowerSource = source.toLowerCase();

  let species = null;
  for (const candidate of [...SPECIES].sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i');
    if (pattern.test(source)) {
      species = candidate;
      break;
    }
  }

  let rarity = 'common';
  for (const candidate of RARITIES) {
    const pattern = new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i');
    if (pattern.test(source)) {
      rarity = candidate;
      break;
    }
  }

  const stats = {};
  for (const statName of STAT_NAMES) {
    const key = statName.toLowerCase();
    const match = source.match(
      new RegExp(`${escapeRegExp(statName)}\\s*[:=-]?\\s*(\\d{1,3})`, 'i')
    );
    if (match) {
      stats[key] = Number(match[1]);
    }
  }

  const eyeMatch = source.match(/\beye(?:s)?\s*[:=-]\s*(\S+)/i);
  const hatMatch = source.match(/\bhat\s*[:=-]\s*([a-z]+)/i);

  return {
    eye: eyeMatch?.[1] ?? '·',
    hat: hatMatch?.[1]?.toLowerCase() ?? 'none',
    rarity,
    shiny: /\bshiny\b/i.test(lowerSource),
    species,
    stats: normalizeStats(stats),
  };
}

function printBuddyInfo(buddy) {
  const rarityColors = {
    common: ANSI.green,
    epic: ANSI.magenta,
    legendary: ANSI.yellow,
    rare: ANSI.blue,
    uncommon: ANSI.cyan,
  };
  const rarityColor = rarityColors[buddy.rarity] ?? ANSI.green;

  console.log(`${ANSI.bold}${ANSI.cyan}Buddy Detected${ANSI.reset}`);
  console.log(
    `${ANSI.bold}Species:${ANSI.reset} ${ANSI.green}${titleCase(buddy.species)}${ANSI.reset}`
  );
  console.log(
    `${ANSI.bold}Rarity:${ANSI.reset} ${rarityColor}${titleCase(buddy.rarity)}${ANSI.reset}`
  );
  console.log(`${ANSI.bold}Stats:${ANSI.reset}`);

  for (const statName of STAT_NAMES) {
    const key = statName.toLowerCase();
    console.log(
      `  ${ANSI.yellow}${statName}${ANSI.reset}: ${ANSI.magenta}${buddy.stats[key]}${ANSI.reset}`
    );
  }
}

async function promptForBuddyName(rl, species) {
  const answer = await rl.question('Buddy name: ');
  return answer.trim() || titleCase(species) || 'Buddy';
}

export async function runSetup({
  configPath = getBuddyConfigPath(),
  projectRoot = getProjectRoot(),
  settingsPath = getSettingsPath(),
} = {}) {
  const userId = detectUserId();
  const rl = createInterface({ input, output });

  try {
    let buddy;

    if (userId) {
      buddy = rollBuddy(userId);
      printBuddyInfo(buddy);
      buddy = {
        ...buddy,
        name: await promptForBuddyName(rl, buddy.species),
        userId,
      };
    } else {
      const pastedOutput = await rl.question('Paste your /buddy output: ');
      const parsedBuddy = parseBuddyOutput(pastedOutput);

      if (!parsedBuddy.species) {
        throw new Error(
          'Could not parse a buddy species from the provided /buddy output.'
        );
      }

      buddy = {
        ...parsedBuddy,
        name: await promptForBuddyName(rl, parsedBuddy.species),
      };
    }

    writeBuddyProfile(buddy, configPath);
    installBuddyHooks(settingsPath, projectRoot);

    console.log(
      `${ANSI.bold}${ANSI.green}Buddy Hooks installed successfully.${ANSI.reset}`
    );
  } finally {
    rl.close();
  }
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';

if (invokedPath === modulePath) {
  runSetup().catch((error) => {
    console.error(
      `${ANSI.bold}${ANSI.red}Setup failed:${ANSI.reset} ${error.message}`
    );
    process.exitCode = 1;
  });
}
