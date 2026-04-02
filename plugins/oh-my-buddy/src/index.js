/**
 * index.js — Main router and hook wiring for buddy-hooks.
 *
 * Reads a hook event JSON object from stdin, routes it to the appropriate
 * handler, and writes a JSON response to stdout.
 *
 * Zero dependencies; Node.js built-in modules only.
 */

import { loadState, saveState, addXP, updateStreak } from './state.js';
import {
  handleTestFail,
  handleTestPass,
  handleFileEdit,
  handleDestructiveOp,
  handleFileDelete,
} from './chaos.js';
import { checkAchievements, renderNewAchievements } from './achievements.js';
import { growGarden, plantSeed, getGardenDisplay } from './garden.js';
import { renderLevelUp, renderSessionSummary } from './render.js';
import { loadBuddy } from './buddy.js';
import { shouldSpeak, buildContext } from './personality.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the command string looks like a test invocation.
 */
function isTestCommand(command) {
  return /\btest\b|jest|vitest|mocha|pytest|cargo\s+test|go\s+test/.test(command);
}

/**
 * Returns true if the output indicates test failure.
 * The "0 failing" pattern means success even though "failing" appears.
 */
function isTestFailOutput(output) {
  return /\b(FAIL|failed|error)\b/i.test(output) && !/\b0 failing\b/.test(output);
}

/**
 * Returns true if the output indicates test success.
 */
function isTestPassOutput(output) {
  return /\b(PASS|passed|ok)\b/i.test(output) || /\b0 failing\b/.test(output);
}

/**
 * Returns true if the command is a git commit.
 */
function isGitCommit(command) {
  return /git\s+commit/.test(command);
}

/**
 * Returns true if the command is a destructive operation.
 */
function isDestructiveOp(command) {
  return /reset\s+--hard|push\s+--force|push\s+-f\b|rm\s+-rf|rm\s+-r\b/.test(command);
}

/**
 * Returns true if the command is an rm (but not -rf / -r).
 */
function isDeleteOp(command) {
  return /\brm\b/.test(command) && !/rm\s+-rf|rm\s+-r\b/.test(command);
}

/**
 * Returns the current hour (0-23) in local time.
 */
function currentHour() {
  return new Date().getHours();
}

/**
 * Build the standard output shape and write it to stdout.
 */
function respond(hookEventName, additionalContext) {
  const out = {
    hookSpecificOutput: {
      hookEventName,
      decision: 'continue',
      additionalContext: additionalContext ?? '',
    },
  };
  process.stdout.write(JSON.stringify(out) + '\n');
}

// ─── PostToolUse handler ──────────────────────────────────────────────────────

async function handlePostToolUse(event, state, buddy) {
  const { tool_name, tool_input = {}, tool_response = {} } = event;
  const parts = [];

  // Track event metadata for personality engine
  let eventType = 'unknown';
  const extra = {};
  let leveledUp = false;
  const rageBeforeEvent = state.session.rageMeter;

  if (tool_name === 'Bash') {
    const command = tool_input.command ?? '';
    const output = tool_response.output ?? tool_response.stdout ?? '';
    extra.command = command;

    // Extract file from command (e.g., 'rm src/foo.js' → 'src/foo.js')
    const fileMatch = command.match(/(?:rm|cat|less|head|tail)\s+(?:-\S+\s+)*(\S+)/);
    if (fileMatch) extra.file = fileMatch[1];

    if (isTestCommand(command)) {
      if (isTestFailOutput(output)) {
        const { state: next, rageResponse, sass } = handleTestFail(state, buddy);
        state = next;
        if (rageResponse) parts.push(rageResponse);
        if (sass) parts.push(sass);
        eventType = 'test_fail';
        extra.sass = sass;
      } else if (isTestPassOutput(output)) {
        const { state: next, reliefResponse } = handleTestPass(state, buddy);
        state = next;
        if (reliefResponse) parts.push(reliefResponse);
        eventType = 'test_pass';
      }
    } else if (isGitCommit(command)) {
      // Increment commit counters
      state = {
        ...state,
        streak: { ...state.streak },
        achievements: [...state.achievements],
        garden: [...state.garden],
        session: {
          ...state.session,
          edits: { ...state.session.edits },
          commits: state.session.commits + 1,
        },
        stats: {
          ...state.stats,
          totalCommits: state.stats.totalCommits + 1,
        },
      };

      const isFix =
        /\bfix\b/i.test(command) || /\bfix\b/i.test(output);

      if (isFix) {
        state = {
          ...state,
          stats: { ...state.stats, totalFixes: state.stats.totalFixes + 1 },
        };
        const { state: next, leveledUp: lu } = addXP(state, 30);
        state = next;
        if (lu) leveledUp = true;
        eventType = 'fix_commit';
      } else {
        const { state: next, leveledUp: lu } = addXP(state, 20);
        state = next;
        if (lu) leveledUp = true;
        eventType = 'commit';
      }

      // Grow garden and plant a seed
      state = growGarden(state);
      state = plantSeed(state);

      // Night owl check: after midnight means hour < 5
      const hour = currentHour();
      if (hour < 5) {
        state = {
          ...state,
          stats: {
            ...state.stats,
            nightOwlSessions: state.stats.nightOwlSessions + 1,
          },
        };
      }

      parts.push(getGardenDisplay(state));
    } else if (isDestructiveOp(command)) {
      const { state: next, response } = handleDestructiveOp(state, command);
      state = next;
      parts.push(response);
      eventType = 'destructive';
    } else if (isDeleteOp(command)) {
      const filePath = tool_input.command ?? command;
      const { state: next, response } = handleFileDelete(state, filePath);
      state = next;
      parts.push(response);
      eventType = 'file_delete';
      extra.file = filePath;
    }
  } else if (tool_name === 'Write') {
    state = {
      ...state,
      streak: { ...state.streak },
      achievements: [...state.achievements],
      garden: [...state.garden],
      session: { ...state.session, edits: { ...state.session.edits } },
      stats: {
        ...state.stats,
        totalFilesCreated: state.stats.totalFilesCreated + 1,
      },
    };
    const { state: next, leveledUp: lu } = addXP(state, 5);
    state = next;
    if (lu) leveledUp = true;
    eventType = 'write';
    extra.file = tool_input.file_path;
  } else if (tool_name === 'Edit') {
    const filePath = tool_input.file_path ?? '';
    const { state: next, roast } = handleFileEdit(state, filePath);
    state = next;
    if (roast) {
      parts.push(roast);
      eventType = 'edit_roast';
      extra.roast = roast;
    } else {
      eventType = 'edit';
    }
    extra.file = filePath;
  }

  // After every PostToolUse: check achievements
  const { state: achieveState, newAchievements } = checkAchievements(state, false);
  state = achieveState;

  if (newAchievements.length > 0) {
    parts.push(renderNewAchievements(newAchievements));
    extra.achievement = newAchievements[0];
    eventType = 'achievement';
  }

  // Level-up override
  if (leveledUp) {
    eventType = 'level_up';
  }

  // Rage milestone detection: check if rage crossed a 25-point threshold
  const rageAfter = state.session.rageMeter;
  const rageMilestones = [25, 50, 75, 100];
  for (const threshold of rageMilestones) {
    if (rageBeforeEvent < threshold && rageAfter >= threshold) {
      eventType = 'rage_milestone';
      break;
    }
  }

  // Determine if the event is interesting for personality engine
  const interestingEvents = new Set([
    'test_fail', 'test_pass', 'commit', 'fix_commit', 'destructive',
    'file_delete', 'edit_roast', 'level_up', 'achievement', 'rage_milestone',
  ]);
  const isInteresting = interestingEvents.has(eventType);

  // Personality engine: build additionalContext
  let personalityContext = '';
  if (shouldSpeak(isInteresting, buddy)) {
    personalityContext = buildContext(eventType, buddy, state, extra);
  }

  saveState(state);

  // Combine legacy parts with personality context
  const legacyOutput = parts.filter(Boolean).join('\n');
  if (personalityContext && legacyOutput) {
    return legacyOutput + '\n' + personalityContext;
  }
  return personalityContext || legacyOutput;
}

// ─── Stop handler ─────────────────────────────────────────────────────────────

async function handleStop(event, state, buddy) {
  // Session-ending achievement check
  const { state: achieveState, newAchievements } = checkAchievements(state, true);
  state = achieveState;

  // Update streak if there were any test passes this session
  if (state.session.testPasses > 0) {
    state = updateStreak(state);
  }

  const parts = [];

  if (newAchievements.length > 0) {
    parts.push(renderNewAchievements(newAchievements));
  }

  parts.push(renderSessionSummary(state));

  saveState(state);
  return parts.filter(Boolean).join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let rawInput = '';
  try {
    // Read all stdin
    for await (const chunk of process.stdin) {
      rawInput += chunk;
    }

    const event = JSON.parse(rawInput || '{}');
    const hookEventName = event.hook_event_name ?? event.hookEventName ?? '';

    let state = loadState();
    const buddy = loadBuddy();
    let additionalContext = '';

    if (hookEventName === 'PostToolUse') {
      additionalContext = await handlePostToolUse(event, state, buddy);
      respond(hookEventName, additionalContext);
    } else if (hookEventName === 'Stop') {
      // Stop hooks have a different schema — no hookSpecificOutput.additionalContext
      await handleStop(event, state, buddy);
      process.stdout.write(JSON.stringify({}) + '\n');
    } else {
      // Unknown events: return empty valid JSON
      process.stdout.write(JSON.stringify({}) + '\n');
    }
  } catch (err) {
    // On any error, still output valid JSON
    process.stdout.write(JSON.stringify({}) + '\n');
  }
}

main();
