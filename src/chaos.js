/**
 * chaos.js — Rage meter, sass, roasts, and destruction tracking for buddy-hooks.
 *
 * Zero dependencies beyond internal modules; Node.js built-in modules only.
 */

import { addXP } from './state.js';
import { renderRageMeter, renderExplosion } from './render.js';
import { RAGE_FACES, RELIEF, SKULL, GRAVESTONE } from './art/frames.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SASS_MESSAGES = [
  'hmm.',
  'you sure about that?',
  'this is fine. everything is fine.',
  'have you tried turning it off and on again?',
  'I believe in you... I think.',
  'okay this is getting concerning',
];

const ROAST_MESSAGES = [
  'you live here now huh',
  'this file owes you rent',
  'at this point just rewrite it',
  'you and {filename} need couples therapy',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Picks the rage face based on rage meter percentage.
 */
function getRageFace(rageMeter) {
  if (rageMeter >= 100) return RAGE_FACES.meltdown;
  if (rageMeter >= 75) return RAGE_FACES.flames;
  if (rageMeter >= 50) return RAGE_FACES.sweating;
  if (rageMeter >= 25) return RAGE_FACES.sideEye;
  return RAGE_FACES.calm;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Handles an error event.
 * Increments session.errors by 1 and session.rageMeter by a PATIENCE-tuned amount (capped at 100).
 * Rage increment = Math.round(10 * (1.5 - patience/100)), where patience defaults to 50.
 * Returns { state, rageResponse } where rageResponse is the rendered rage meter
 * + rage face + explosion art.
 */
export function handleError(state, buddy = null) {
  const patience = buddy?.stats?.patience ?? 50;
  const rageIncrement = Math.round(10 * (1.5 - patience / 100));
  const newErrors = state.session.errors + 1;
  const newRageMeter = Math.min(100, state.session.rageMeter + rageIncrement);

  const newState = {
    ...state,
    streak: { ...state.streak },
    stats: { ...state.stats },
    achievements: [...state.achievements],
    garden: [...state.garden],
    session: {
      ...state.session,
      edits: { ...state.session.edits },
      errors: newErrors,
      rageMeter: newRageMeter,
    },
  };

  const rageFace = getRageFace(newRageMeter);
  const meter = renderRageMeter(newRageMeter);
  const explosion = renderExplosion(newErrors);
  const rageResponse = [meter, rageFace, explosion].filter(Boolean).join('\n');

  return { state: newState, rageResponse };
}

/**
 * Handles a test failure event.
 * Calls handleError internally to increment errors and rage meter.
 * Returns escalating sass at 3+ consecutive failures.
 *
 * Returns { state, rageResponse, sass }
 */
export function handleTestFail(state, buddy = null) {
  const { state: newState, rageResponse } = handleError(state, buddy);

  const errors = newState.session.errors;
  let sass = '';
  if (errors >= 3) {
    const idx = (errors - 3) % SASS_MESSAGES.length;
    sass = SASS_MESSAGES[idx];
  }

  return { state: newState, rageResponse, sass };
}

/**
 * Handles a test pass event.
 * Increments session.testPasses, awards +10 XP via addXP.
 * If rageMeter was > 0, resets to 0 and returns RELIEF art.
 *
 * Returns { state, reliefResponse }
 */
export function handleTestPass(state, buddy = null) {
  // Patient buddies (patience > 60) get partial rage decay before checking reset
  let effectiveRage = state.session.rageMeter;
  if ((buddy?.stats?.patience ?? 0) > 60 && effectiveRage > 0) {
    effectiveRage = Math.max(0, effectiveRage - 5);
  }

  const hadRage = effectiveRage > 0;

  // Award XP first (addXP does a deep-ish copy)
  const { state: xpState } = addXP(state, 10);

  const newState = {
    ...xpState,
    session: {
      ...xpState.session,
      edits: { ...xpState.session.edits },
      testPasses: xpState.session.testPasses + 1,
      rageMeter: hadRage ? 0 : effectiveRage,
    },
  };

  const reliefResponse = hadRage ? RELIEF : '';

  return { state: newState, reliefResponse };
}

/**
 * Handles a file edit event.
 * Tracks edits in session.edits[filePath].
 * Returns a roast at 5+ edits to the same file.
 *
 * Returns { state, roast }
 */
export function handleFileEdit(state, filePath) {
  const currentEdits = state.session.edits[filePath] ?? 0;
  const newEditCount = currentEdits + 1;

  const newState = {
    ...state,
    streak: { ...state.streak },
    stats: { ...state.stats },
    achievements: [...state.achievements],
    garden: [...state.garden],
    session: {
      ...state.session,
      edits: {
        ...state.session.edits,
        [filePath]: newEditCount,
      },
    },
  };

  let roast = '';
  if (newEditCount >= 5) {
    const idx = (newEditCount - 5) % ROAST_MESSAGES.length;
    const template = ROAST_MESSAGES[idx];
    const filename = filePath.split('/').pop();
    roast = template.replace('{filename}', filename);
  }

  return { state: newState, roast };
}

/**
 * Handles a destructive operation.
 * Increments stats.destructiveOps.
 * Returns SKULL art + "bold move." message.
 * Returns achievement 'daredevil' at 5+ destructive ops, null otherwise.
 *
 * Returns { state, response, achievement }
 */
export function handleDestructiveOp(state, command) {
  const newDestructiveOps = state.stats.destructiveOps + 1;

  const newState = {
    ...state,
    streak: { ...state.streak },
    achievements: [...state.achievements],
    garden: [...state.garden],
    session: {
      ...state.session,
      edits: { ...state.session.edits },
    },
    stats: {
      ...state.stats,
      destructiveOps: newDestructiveOps,
    },
  };

  const response = [SKULL, 'bold move.'].join('\n');
  const achievement = newDestructiveOps >= 5 ? 'daredevil' : null;

  return { state: newState, response, achievement };
}

/**
 * Handles a file deletion event.
 * Returns GRAVESTONE art + filename.
 *
 * Returns { state, response }
 */
export function handleFileDelete(state, filePath) {
  const newState = {
    ...state,
    streak: { ...state.streak },
    stats: { ...state.stats },
    achievements: [...state.achievements],
    garden: [...state.garden],
    session: {
      ...state.session,
      edits: { ...state.session.edits },
    },
  };

  const filename = filePath.split('/').pop();
  const response = [GRAVESTONE, filename].join('\n');

  return { state: newState, response };
}
