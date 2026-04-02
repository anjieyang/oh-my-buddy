import {
  ACHIEVEMENT_BANNER,
  ADULT_FRAMES,
  BABY_FRAMES,
  EGG_FRAMES,
  EXPLOSIONS,
  LEGENDARY_FRAMES,
  LEVEL_UP_BANNER,
  TEEN_FRAMES,
} from './art/frames.js';

const ANSI = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const FILLED = '\u2588';
const EMPTY = '\u2591';
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stripAnsi(text) {
  return text.replace(ANSI_PATTERN, '');
}

function pickFrame(frames, level) {
  const index = clamp((Number(level) || 1) - 1, 0, frames.length - 1);
  return frames[index];
}

function titleCase(value) {
  const text = String(value || 'egg');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function renderBuddyArt(stage, level = 1) {
  switch (stage) {
    case 'egg':
      return pickFrame(EGG_FRAMES, level);
    case 'baby':
      return pickFrame(BABY_FRAMES, level);
    case 'teen':
      return pickFrame(TEEN_FRAMES, level);
    case 'adult':
      return pickFrame(ADULT_FRAMES, level);
    case 'legendary':
      return pickFrame(LEGENDARY_FRAMES, level);
    default:
      return EGG_FRAMES[0];
  }
}

export function renderRageMeter(percent) {
  const clamped = clamp(Number(percent) || 0, 0, 100);
  const color =
    clamped <= 33 ? ANSI.green : clamped <= 66 ? ANSI.yellow : ANSI.red;
  const filledCount = Math.round(clamped / 10);
  const emptyCount = 10 - filledCount;
  const bar = `[${FILLED.repeat(filledCount)}${EMPTY.repeat(emptyCount)}]`;
  return `${color}${bar} ${clamped}% RAGE${ANSI.reset}`;
}

export function renderExplosion(errorCount) {
  const totalErrors = Math.max(0, Number(errorCount) || 0);

  if (totalErrors >= 6) {
    return EXPLOSIONS.large;
  }

  if (totalErrors >= 3) {
    return EXPLOSIONS.medium;
  }

  if (totalErrors >= 1) {
    return EXPLOSIONS.small;
  }

  return '';
}

export function renderLevelUp(level, stage) {
  const art = renderBuddyArt(stage, level);
  return [
    `${ANSI.bold}${ANSI.magenta}${LEVEL_UP_BANNER.trim()}${ANSI.reset}`,
    art,
    `${ANSI.cyan}Stage:${ANSI.reset} ${titleCase(stage)}`,
    `${ANSI.yellow}Level:${ANSI.reset} ${level}`,
  ].join('\n');
}

export function renderAchievement(name, badge) {
  return [
    `${ANSI.bold}${ANSI.yellow}${ACHIEVEMENT_BANNER.trim()}${ANSI.reset}`,
    `${ANSI.green}Name:${ANSI.reset} ${name}`,
    `${ANSI.blue}Badge:${ANSI.reset} ${badge}`,
  ].join('\n');
}

export function renderGarden(plots) {
  const icons = {
    seed: '[.]',
    sprout: '[i]',
    flower: '[*]',
    tree: '[Y]',
  };
  const row = (plots || [])
    .map((plot) => icons[plot?.type] || '[?]')
    .join(' ');
  return `Garden: ${row || '(empty)'}`;
}

export function renderSessionSummary(state) {
  const session = state?.session || {};
  const summary = [
    `${ANSI.bold}${ANSI.blue}Buddy Session Summary${ANSI.reset}`,
    renderBuddyArt(state?.stage, state?.level),
    `XP: ${state?.xp ?? 0}`,
    `Level: ${state?.level ?? 1}`,
    `Stage: ${titleCase(state?.stage)}`,
    `Streak: ${state?.streak?.current ?? 0}`,
    `Commits: ${session.commits ?? 0}`,
    `Tests: ${session.testPasses ?? 0}`,
    `Errors: ${session.errors ?? 0}`,
    renderRageMeter(session.rageMeter ?? 0),
    renderGarden(state?.garden ?? []),
  ].join('\n');

  return wrapOutput(summary);
}

export function wrapOutput(text) {
  const lines = String(text).split('\n');
  const width = lines.reduce(
    (max, line) => Math.max(max, stripAnsi(line).length),
    0
  );
  const top = `┌${'─'.repeat(width + 2)}┐`;
  const bottom = `└${'─'.repeat(width + 2)}┘`;
  const middle = lines.map((line) => {
    const visibleLength = stripAnsi(line).length;
    const padding = ' '.repeat(width - visibleLength);
    return `│ ${line}${padding} │`;
  });
  return [top, ...middle, bottom].join('\n');
}
