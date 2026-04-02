/**
 * personality.js — Personality engine for buddy-hooks.
 *
 * Builds personality-flavored additionalContext strings using the buddy's
 * species, stats, and current game state. No LLM calls — pure string construction.
 *
 * Zero dependencies; Node.js built-in modules only.
 */

import { renderRageMeter, renderGarden } from './render.js';

// ─── Species Mappings ─────────────────────────────────────────────────────────

export const SPECIES_EMOJI = {
  duck:     '🦆',
  goose:    '🪿',
  blob:     '🫠',
  cat:      '🐱',
  dragon:   '🐉',
  octopus:  '🐙',
  owl:      '🦉',
  penguin:  '🐧',
  turtle:   '🐢',
  snail:    '🐌',
  ghost:    '👻',
  axolotl:  '🌊',
  capybara: '🦫',
  cactus:   '🌵',
  robot:    '🤖',
  rabbit:   '🐰',
  mushroom: '🍄',
  chonk:    '😸',
};

export const SPECIES_VERBS = {
  duck:     'quacks',
  goose:    'honks',
  blob:     'wobbles',
  cat:      'purrs',
  dragon:   'growls',
  octopus:  'waves tentacles',
  owl:      'hoots',
  penguin:  'waddles',
  turtle:   'slowly nods',
  snail:    'oozes thoughtfully',
  ghost:    'haunts',
  axolotl:  'wiggles',
  capybara: 'chills',
  cactus:   'prickles',
  robot:    'computes',
  rabbit:   'twitches',
  mushroom: 'spores',
  chonk:    'chonks',
};

// ─── Reaction Pools ───────────────────────────────────────────────────────────

// Three tiers per event type: encouraging (snark < 34), neutral (< 67), savage (≥ 67)
const REACTIONS = {
  test_fail: {
    encouraging: [
      "You'll get it next time — bugs are just undiscovered features.",
      "Every failure is a clue. You're basically a detective.",
      "Test red is just pre-green. Keep going!",
    ],
    neutral: [
      "Tests failed. Happens to everyone, even the good ones.",
      "Red. Probably a typo somewhere. Check the stack trace.",
      "Failed tests noted. Time to debug.",
    ],
    savage: [
      "Incredible. Not a single test passing. Truly an achievement.",
      "The tests didn't just fail, they gave up on you.",
      "I've seen rubber ducks write better code.",
    ],
  },
  test_pass: {
    encouraging: [
      "All green! You absolute legend.",
      "Tests passing — the universe is briefly in balance.",
      "Look at you go! Every test a victory.",
    ],
    neutral: [
      "Tests passed. As expected, hopefully.",
      "Green across the board. Good.",
      "Passing. Don't celebrate too hard, there's still more work.",
    ],
    savage: [
      "Oh wow, tests passed. Want a medal?",
      "Congratulations on doing the bare minimum.",
      "Tests green. I'll believe it when I see it in production.",
    ],
  },
  commit: {
    encouraging: [
      "Committed! Your future self will thank you for this.",
      "Nice commit. History is being made, literally.",
      "Snapshot taken. Progress is progress.",
    ],
    neutral: [
      "Commit recorded. Message was... fine.",
      "Added to history. Don't look back.",
      "Committed. Moving on.",
    ],
    savage: [
      "Another commit for the blame log. Bold.",
      "Committed. The diff reviewers will have opinions.",
      "Git will remember this. Unfortunately.",
    ],
  },
  fix_commit: {
    encouraging: [
      "Fix committed! Redemption arc complete.",
      "Bug squashed and documented. Textbook.",
      "The fix is in. You handled that beautifully.",
    ],
    neutral: [
      "Fix committed. Let's hope that's the last one.",
      "Bug addressed. Check if it's actually fixed though.",
      "Patch pushed. Fingers crossed.",
    ],
    savage: [
      "Fixed the bug you introduced three commits ago. Full circle.",
      "A fix for a fix. We call this progress.",
      "Committing the fix for the thing that should have worked the first time.",
    ],
  },
  destructive: {
    encouraging: [
      "Brave move. Destruction can be the first step to creation.",
      "Sometimes you have to tear it down to build it right.",
      "Bold. Destructive ops are just aggressive refactoring.",
    ],
    neutral: [
      "Destructive operation executed. Hope you meant to do that.",
      "Done. Irreversible. No backsies.",
      "That happened. Moving on.",
    ],
    savage: [
      "There it goes. Was it backed up? That's a rhetorical question.",
      "Wow. Chaotic. Did you even read the command you typed?",
      "Destructive op confirmed. Somewhere a server is crying.",
    ],
  },
  file_delete: {
    encouraging: [
      "Clean delete. A tidy workspace is a tidy mind.",
      "Gone but not forgotten. Probably in git somewhere.",
      "Pruning the tree. Good instinct.",
    ],
    neutral: [
      "File deleted. It's in git if you need it back. Probably.",
      "Gone. Check that nothing imported it.",
      "Deleted. Let's hope nothing breaks.",
    ],
    savage: [
      "And it's gone. Classic.",
      "File deleted. You'll need it back in ten minutes, I guarantee.",
      "Deleted. The filesystem has no memory. Lucky for you.",
    ],
  },
  edit_roast: {
    encouraging: [
      "Making it better, one edit at a time. I believe in this.",
      "Iteration is the soul of great software.",
      "Another edit, another step toward something good.",
    ],
    neutral: [
      "File edited. Hope it's an improvement.",
      "Changed. We'll see how that plays out.",
      "Edit noted. The diff will tell the story.",
    ],
    savage: [
      "That file has been edited so many times it has trust issues.",
      "Another edit. Is it better? Statistically, probably not.",
      "You've touched that file more than any file deserves.",
    ],
  },
  level_up: {
    encouraging: [
      "Level up! You earned every XP of this.",
      "Growth! The journey continues and you're crushing it.",
      "New level achieved. The grind is paying off.",
    ],
    neutral: [
      "Level up. Stats increasing, presumably.",
      "Leveled. Progress in numerical form.",
      "New level unlocked. Keep it up.",
    ],
    savage: [
      "Level up. Took long enough.",
      "Leveled. The bar was clearing the floor, but sure.",
      "Another level. Now do something worthy of it.",
    ],
  },
  achievement: {
    encouraging: [
      "Achievement unlocked! You're leaving a legacy.",
      "Badge earned! Collect them all.",
      "Achievement get! This one was worth it.",
    ],
    neutral: [
      "Achievement unlocked. It's been logged.",
      "Badge acquired. Noted.",
      "Achievement registered. Moving on.",
    ],
    savage: [
      "Achievement unlocked. For a thing you should have done sooner.",
      "Congrats on the badge nobody asked for.",
      "Achievement earned. Doesn't change the test suite though.",
    ],
  },
  unsolicited: {
    encouraging: [
      "Just checking in — you're doing well, keep at it.",
      "Unprompted positivity: you're better at this than you think.",
      "Random thought: this codebase has come a long way.",
    ],
    neutral: [
      "Still here. Watching. No particular reason.",
      "Unsolicited update: things are happening.",
      "Just noting that time continues to pass.",
    ],
    savage: [
      "Interjecting with nothing useful to add, as is tradition.",
      "Thought I'd drop by to observe your choices.",
      "Unsolicited opinion: something could probably be cleaner.",
    ],
  },
  rage_milestone: {
    encouraging: [
      "Rage is high, but you're still here. That's resilience.",
      "Frustration is just passion with nowhere to go yet.",
      "Rage meter climbing — it means you care. Channel it.",
    ],
    neutral: [
      "Rage milestone reached. Might be time for a break.",
      "Stress levels noted. Hydrate.",
      "High frustration detected. Take five if you need to.",
    ],
    savage: [
      "The rage meter doesn't lie. Something has gone very wrong.",
      "Milestone: full tilt. Impressive in the worst way.",
      "Rage maxing out. Whatever you're debugging, it's winning.",
    ],
  },
};

// ─── Wisdom Notes ─────────────────────────────────────────────────────────────

const WISDOM_NOTES = [
  ' (Wise note: complexity is the enemy of reliability.)',
  ' (Ancient wisdom: the simplest fix is usually the right one.)',
  ' (Sage advice: read the error message. The whole thing.)',
  ' (Remember: code is read more often than it is written.)',
  ' (Observe: naming things well is half the battle.)',
  ' (Consider: if it hurts, do it more often — then automate it.)',
  ' (Truth: untested code is broken code you haven\'t found yet.)',
];

// ─── Interesting Events ───────────────────────────────────────────────────────

const INTERESTING_EVENTS = new Set([
  'test_fail', 'test_pass', 'commit', 'fix_commit', 'destructive',
  'file_delete', 'achievement', 'rage_milestone', 'level_up', 'edit_roast',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Determines whether the buddy should speak.
 *
 * If isInteresting is true, always returns true.
 * Otherwise, returns true only if Math.random() < chaos / 200.
 */
export function shouldSpeak(isInteresting, buddy) {
  if (isInteresting) return true;
  return Math.random() < buddy.stats.chaos / 200;
}

/**
 * Builds the single-line status bar string.
 */
export function buildStatusBar(state) {
  const ragePart  = `Rage: ${renderRageMeter(state.session.rageMeter)}`;
  const xpPart    = `XP: ${state.xp}`;
  const lvlPart   = `Lvl: ${state.level}`;
  const streakPart = `Streak: ${state.streak.current}d`;
  const gardenPart = renderGarden(state.garden);
  return `${ragePart} | ${xpPart} | ${lvlPart} | ${streakPart} | ${gardenPart}`;
}

/**
 * Builds the reaction line in the format:
 *   Name verb: "message"
 *
 * Tone is selected based on snark stat:
 *   < 34  → encouraging
 *   < 67  → neutral
 *   ≥ 67  → savage
 *
 * Optional appends:
 *   - WISDOM: wisdom/150 chance to append a wisdom note
 *   - DEBUGGING: if extra.pattern and debugging/100 chance → append pattern
 *   - CHAOS > 75: (chaos-75)/100 chance to invert tone
 */
export function buildReactionLine(eventType, buddy, state, extra) {
  const { chaos, snark, wisdom, debugging } = buddy.stats;
  const pools = REACTIONS[eventType] ?? REACTIONS.unsolicited;

  // Determine base tone from snark
  let tone;
  if (snark < 34) {
    tone = 'encouraging';
  } else if (snark < 67) {
    tone = 'neutral';
  } else {
    tone = 'savage';
  }

  let message = pickFrom(pools[tone]);

  // WISDOM append
  if (Math.random() < wisdom / 150) {
    message += pickFrom(WISDOM_NOTES);
  }

  // DEBUGGING append
  if (extra.pattern && Math.random() < debugging / 100) {
    message += ` Pattern spotted: ${extra.pattern}.`;
  }

  // CHAOS inversion
  let chaosPrefix = '';
  if (chaos > 75 && Math.random() < (chaos - 75) / 100) {
    const oppositeTone = tone === 'encouraging' ? 'savage'
      : tone === 'savage' ? 'encouraging'
      : 'neutral';
    message = pickFrom(pools[oppositeTone]);
    chaosPrefix = '...wait, scratch that. ';
  }

  const name = buddy.name ?? capitalize(buddy.species);
  const verb = SPECIES_VERBS[buddy.species] ?? 'says';

  return `${name} ${verb}: "${chaosPrefix}${message}"`;
}

/**
 * Builds the full additionalContext string:
 *
 *   [emoji Name the Species (lvl level, rarity) verb]
 *   statusBar
 *   reactionLine (only if shouldSpeak returns true)
 */
export function buildContext(eventType, buddy, state, extra = {}) {
  const emoji   = SPECIES_EMOJI[buddy.species] ?? '?';
  const name    = buddy.name ?? capitalize(buddy.species);
  const species = buddy.species;
  const verb    = SPECIES_VERBS[species] ?? 'says';

  const header = `[${emoji} ${name} the ${species} (lvl ${state.level}, ${buddy.rarity}) ${verb}]`;
  const statusBar = buildStatusBar(state);

  const isInteresting = INTERESTING_EVENTS.has(eventType);
  const lines = [header, statusBar];

  if (shouldSpeak(isInteresting, buddy)) {
    lines.push(buildReactionLine(eventType, buddy, state, extra));
  }

  return lines.join('\n');
}
