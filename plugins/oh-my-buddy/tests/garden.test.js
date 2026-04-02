import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getGardenDisplay,
  growGarden,
  plantSeed,
  wiltGarden,
} from '../src/garden.js';

function createState({ garden = [], lastDate = null } = {}) {
  return {
    garden,
    streak: {
      current: 0,
      best: 0,
      lastDate,
    },
  };
}

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

describe('growGarden', () => {
  test('advances each plot one stage and keeps trees at tree', () => {
    const state = createState({
      garden: [
        { type: 'seed' },
        { type: 'sprout' },
        { type: 'flower' },
        { type: 'tree' },
      ],
    });

    const next = growGarden(state);

    assert.deepEqual(next.garden, [
      { type: 'sprout' },
      { type: 'flower' },
      { type: 'tree' },
      { type: 'tree' },
    ]);
  });

  test('handles an empty garden', () => {
    const next = growGarden(createState());
    assert.deepEqual(next.garden, []);
  });

  test('does not mutate the original state', () => {
    const state = createState({ garden: [{ type: 'seed' }] });

    growGarden(state);

    assert.deepEqual(state.garden, [{ type: 'seed' }]);
  });
});

describe('plantSeed', () => {
  test('adds a seed when the garden has room', () => {
    const next = plantSeed(
      createState({
        garden: [{ type: 'sprout' }, { type: 'flower' }],
      })
    );

    assert.deepEqual(next.garden, [
      { type: 'sprout' },
      { type: 'flower' },
      { type: 'seed' },
    ]);
  });

  test('replaces the oldest tree when the garden is full', () => {
    const next = plantSeed(
      createState({
        garden: [
          { type: 'flower' },
          { type: 'tree' },
          { type: 'sprout' },
          { type: 'tree' },
          { type: 'flower' },
          { type: 'tree' },
          { type: 'sprout' },
          { type: 'flower' },
          { type: 'tree' },
          { type: 'tree' },
        ],
      })
    );

    assert.deepEqual(next.garden, [
      { type: 'flower' },
      { type: 'seed' },
      { type: 'sprout' },
      { type: 'tree' },
      { type: 'flower' },
      { type: 'tree' },
      { type: 'sprout' },
      { type: 'flower' },
      { type: 'tree' },
      { type: 'tree' },
    ]);
  });

  test('replaces the first plot when the garden is full and has no trees', () => {
    const next = plantSeed(
      createState({
        garden: [
          { type: 'flower' },
          { type: 'sprout' },
          { type: 'flower' },
          { type: 'sprout' },
          { type: 'flower' },
          { type: 'sprout' },
          { type: 'flower' },
          { type: 'sprout' },
          { type: 'flower' },
          { type: 'sprout' },
        ],
      })
    );

    assert.deepEqual(next.garden[0], { type: 'seed' });
    assert.equal(next.garden.length, 10);
  });
});

describe('wiltGarden', () => {
  test('does nothing when lastDate is null', () => {
    const state = createState({
      garden: [{ type: 'flower' }],
      lastDate: null,
    });

    const next = wiltGarden(state);

    assert.deepEqual(next.garden, [{ type: 'flower' }]);
  });

  test('does nothing when lastDate is today', () => {
    const state = createState({
      garden: [{ type: 'tree' }],
      lastDate: daysAgo(0),
    });

    const next = wiltGarden(state);

    assert.deepEqual(next.garden, [{ type: 'tree' }]);
  });

  test('does nothing when lastDate is yesterday', () => {
    const state = createState({
      garden: [{ type: 'tree' }],
      lastDate: daysAgo(1),
    });

    const next = wiltGarden(state);

    assert.deepEqual(next.garden, [{ type: 'tree' }]);
  });

  test('downgrades the last non-empty plot when the streak is broken', () => {
    const state = createState({
      garden: [{ type: 'sprout' }, { type: 'tree' }],
      lastDate: daysAgo(2),
    });

    const next = wiltGarden(state);

    assert.deepEqual(next.garden, [{ type: 'sprout' }, { type: 'flower' }]);
  });

  test('removes the last plot when it is a seed', () => {
    const state = createState({
      garden: [{ type: 'flower' }, { type: 'seed' }],
      lastDate: daysAgo(3),
    });

    const next = wiltGarden(state);

    assert.deepEqual(next.garden, [{ type: 'flower' }]);
  });

  test('handles an empty garden when wilting', () => {
    const next = wiltGarden(createState({ garden: [], lastDate: daysAgo(2) }));
    assert.deepEqual(next.garden, []);
  });
});

describe('getGardenDisplay', () => {
  test('returns the rendered garden output', () => {
    const state = createState({
      garden: [{ type: 'seed' }, { type: 'tree' }],
    });

    assert.equal(getGardenDisplay(state), 'Garden: [.] [Y]');
  });
});
