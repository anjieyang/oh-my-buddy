import { renderGarden } from './render.js';

const STAGES = ['seed', 'sprout', 'flower', 'tree'];
const MAX_PLOTS = 10;
const DAY_MS = 1000 * 60 * 60 * 24;

function getPlotType(plot) {
  return typeof plot === 'string' ? plot : plot?.type ?? null;
}

function normalizeGarden(garden) {
  return (garden ?? [])
    .slice(0, MAX_PLOTS)
    .flatMap((plot) => {
      const type = getPlotType(plot);
      return type ? [{ type }] : [];
    });
}

function cloneState(state) {
  return {
    ...state,
    garden: normalizeGarden(state?.garden),
  };
}

function advanceStage(type) {
  const index = STAGES.indexOf(type);

  if (index === -1 || index === STAGES.length - 1) {
    return type;
  }

  return STAGES[index + 1];
}

function downgradeStage(type) {
  const index = STAGES.indexOf(type);

  if (index <= 0) {
    return null;
  }

  return STAGES[index - 1];
}

function isTodayOrYesterday(dateString) {
  const today = new Date().toISOString().slice(0, 10);

  if (dateString === today) {
    return true;
  }

  const todayDate = new Date(today + 'T00:00:00');
  const lastDate = new Date(dateString + 'T00:00:00');
  const diffMs = todayDate - lastDate;
  const diffDays = Math.round(diffMs / DAY_MS);

  return diffDays === 1;
}

export function growGarden(state) {
  const nextState = cloneState(state);

  nextState.garden = nextState.garden.map((plot) => ({
    type: advanceStage(plot.type),
  }));

  return nextState;
}

export function plantSeed(state) {
  const nextState = cloneState(state);

  if (nextState.garden.length < MAX_PLOTS) {
    nextState.garden.push({ type: 'seed' });
    return nextState;
  }

  const oldestTreeIndex = nextState.garden.findIndex((plot) => plot.type === 'tree');
  const replaceIndex = oldestTreeIndex === -1 ? 0 : oldestTreeIndex;

  nextState.garden[replaceIndex] = { type: 'seed' };
  return nextState;
}

export function wiltGarden(state) {
  const nextState = cloneState(state);
  const lastDate = state?.streak?.lastDate;

  if (lastDate === null || isTodayOrYesterday(lastDate)) {
    return nextState;
  }

  const lastPlot = nextState.garden.at(-1);

  if (!lastPlot) {
    return nextState;
  }

  const downgraded = downgradeStage(lastPlot.type);

  if (downgraded === null) {
    nextState.garden.pop();
    return nextState;
  }

  nextState.garden[nextState.garden.length - 1] = { type: downgraded };
  return nextState;
}

export function getGardenDisplay(state) {
  return renderGarden(cloneState(state).garden);
}
