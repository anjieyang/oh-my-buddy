import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpBase = mkdtempSync(join(tmpdir(), 'buddy-setup-test-'));
const claudeDir = join(tmpBase, 'claude');

mkdirSync(claudeDir, { recursive: true });

after(() => {
  rmSync(tmpBase, { force: true, recursive: true });
});

test('writeBuddyProfile writes buddy.json to BUDDY_CONFIG_PATH', async () => {
  const buddyConfigPath = join(tmpBase, 'claude', 'buddy-hooks', 'buddy.json');
  process.env.BUDDY_CONFIG_PATH = buddyConfigPath;

  const { writeBuddyProfile } = await import('../setup.js');

  const writtenProfile = writeBuddyProfile({
    species: 'owl',
    name: 'Tuftwise',
    rarity: 'rare',
    shiny: true,
    eye: '✦',
    hat: 'wizard',
    stats: {
      debugging: 81,
      patience: 62,
      chaos: 45,
      wisdom: 77,
      snark: 53,
    },
  });

  const storedProfile = JSON.parse(readFileSync(buddyConfigPath, 'utf8'));

  assert.deepEqual(storedProfile, writtenProfile);
});

test('installBuddyHooks preserves existing settings keys and adds hooks', async () => {
  const settingsPath = join(claudeDir, 'settings.json');
  const projectRoot = '/tmp/buddy-hooks-project';

  writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        theme: 'dark',
        nested: { keep: true },
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'node /tmp/existing.js' }],
            },
          ],
          PreToolUse: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: 'node /tmp/pre.js' }],
            },
          ],
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const { installBuddyHooks } = await import('../setup.js');
  const nextSettings = installBuddyHooks(settingsPath, projectRoot);
  const storedSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

  assert.deepEqual(storedSettings, nextSettings);
  assert.equal(storedSettings.theme, 'dark');
  assert.deepEqual(storedSettings.nested, { keep: true });
  assert.equal(storedSettings.hooks.PreToolUse.length, 1);
  assert.equal(storedSettings.hooks.PostToolUse.length, 2);
  assert.deepEqual(storedSettings.hooks.PostToolUse[0], {
    matcher: 'Write',
    hooks: [{ type: 'command', command: 'node /tmp/existing.js' }],
  });
  assert.deepEqual(storedSettings.hooks.Stop, [
    {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: 'node /tmp/buddy-hooks-project/src/index.js',
        },
      ],
    },
  ]);
  assert.equal(
    storedSettings.hooks.PostToolUse[1].hooks[0].command,
    'node /tmp/buddy-hooks-project/src/index.js'
  );
});

test('uninstallBuddyHooks removes buddy-hooks commands from settings.json', async () => {
  const settingsPath = join(claudeDir, 'settings-uninstall.json');

  writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        hooks: {
          PostToolUse: [
            {
              matcher: '',
              hooks: [
                {
                  type: 'command',
                  command: 'node /Users/anjieyang/Development/buddy-hooks/src/index.js',
                },
                {
                  type: 'command',
                  command: 'node /tmp/keep-post.js',
                },
              ],
            },
          ],
          Stop: [
            {
              matcher: '',
              hooks: [
                {
                  type: 'command',
                  command: 'node /Users/anjieyang/Development/buddy-hooks/src/index.js',
                },
              ],
            },
          ],
          PreToolUse: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: 'node /tmp/pre.js' }],
            },
          ],
        },
        other: true,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const { uninstallBuddyHooks } = await import('../uninstall.js');
  const nextSettings = uninstallBuddyHooks(settingsPath);
  const storedSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));

  assert.deepEqual(storedSettings, nextSettings);
  assert.equal(storedSettings.other, true);
  assert.equal(storedSettings.hooks.PostToolUse.length, 1);
  assert.deepEqual(storedSettings.hooks.PostToolUse[0].hooks, [
    { type: 'command', command: 'node /tmp/keep-post.js' },
  ]);
  assert.ok(!('Stop' in storedSettings.hooks));
  assert.deepEqual(storedSettings.hooks.PreToolUse, [
    {
      matcher: '',
      hooks: [{ type: 'command', command: 'node /tmp/pre.js' }],
    },
  ]);
});
