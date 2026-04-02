import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ANSI = {
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

export function getBuddyConfigPath() {
  return (
    process.env.BUDDY_CONFIG_PATH ??
    join(homedir(), '.claude', 'buddy-hooks', 'buddy.json')
  );
}

export function getBuddyStatsPath() {
  return (
    process.env.BUDDY_STATE_PATH ?? join(homedir(), '.claude', 'buddy-stats.json')
  );
}

export function getSettingsPath() {
  return (
    process.env.CLAUDE_SETTINGS_PATH ??
    join(homedir(), '.claude', 'settings.json')
  );
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

export function removeBuddyHooksFromSettings(settings = {}) {
  if (!settings?.hooks || typeof settings.hooks !== 'object') {
    return { ...settings };
  }

  const nextHooks = {};

  for (const [hookName, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) {
      nextHooks[hookName] = entries;
      continue;
    }

    const filteredEntries = entries
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

    if (filteredEntries.length > 0) {
      nextHooks[hookName] = filteredEntries;
    }
  }

  const nextSettings = { ...settings };

  if (Object.keys(nextHooks).length > 0) {
    nextSettings.hooks = nextHooks;
  } else {
    delete nextSettings.hooks;
  }

  return nextSettings;
}

export function uninstallBuddyHooks(settingsPath = getSettingsPath()) {
  const settings = readJsonFile(settingsPath, {});
  const nextSettings = removeBuddyHooksFromSettings(settings);
  writeJsonFile(settingsPath, nextSettings);
  return nextSettings;
}

export function deleteBuddyData({
  buddyConfigPath = getBuddyConfigPath(),
  buddyStatsPath = getBuddyStatsPath(),
} = {}) {
  rmSync(buddyConfigPath, { force: true });
  rmSync(buddyStatsPath, { force: true });
}

export async function runUninstall({
  buddyConfigPath = getBuddyConfigPath(),
  buddyStatsPath = getBuddyStatsPath(),
  settingsPath = getSettingsPath(),
} = {}) {
  uninstallBuddyHooks(settingsPath);

  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question(
      'Delete buddy data? (buddy.json + buddy-stats.json) [y/N] '
    );

    if (/^y(es)?$/i.test(answer.trim())) {
      deleteBuddyData({ buddyConfigPath, buddyStatsPath });
    }

    console.log(
      `${ANSI.bold}${ANSI.green}Buddy Hooks uninstalled successfully.${ANSI.reset}`
    );
  } finally {
    rl.close();
  }
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';

if (invokedPath === modulePath) {
  runUninstall().catch((error) => {
    console.error(
      `${ANSI.bold}${ANSI.red}Uninstall failed:${ANSI.reset} ${error.message}`
    );
    process.exitCode = 1;
  });
}
