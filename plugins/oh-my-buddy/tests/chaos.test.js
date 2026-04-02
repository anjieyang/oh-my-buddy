import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultState } from '../src/state.js';

const {
  handleError,
  handleTestFail,
  handleTestPass,
  handleFileEdit,
  handleDestructiveOp,
  handleFileDelete,
} = await import('../src/chaos.js');

// ─── handleError ─────────────────────────────────────────────────────────────

describe('handleError', () => {
  test('increments session.errors by 1', () => {
    const s = getDefaultState();
    const { state } = handleError(s);
    assert.equal(state.session.errors, 1);
  });

  test('increments session.rageMeter by 10', () => {
    const s = getDefaultState();
    const { state } = handleError(s);
    assert.equal(state.session.rageMeter, 10);
  });

  test('caps rageMeter at 100', () => {
    const s = getDefaultState();
    s.session.rageMeter = 95;
    const { state } = handleError(s);
    assert.equal(state.session.rageMeter, 100);
  });

  test('rageMeter does not exceed 100 even when already at 100', () => {
    const s = getDefaultState();
    s.session.rageMeter = 100;
    const { state } = handleError(s);
    assert.equal(state.session.rageMeter, 100);
  });

  test('returns rageResponse string', () => {
    const s = getDefaultState();
    const { rageResponse } = handleError(s);
    assert.equal(typeof rageResponse, 'string');
    assert.ok(rageResponse.length > 0);
  });

  test('rageResponse includes rage meter output', () => {
    const s = getDefaultState();
    const { rageResponse } = handleError(s);
    assert.ok(rageResponse.includes('RAGE'));
  });

  test('rageResponse includes calm face below 25%', () => {
    const s = getDefaultState(); // rageMeter starts at 0, goes to 10 after error
    const { rageResponse } = handleError(s);
    // sideEye triggers at 25+, so 10% should show calm
    assert.ok(rageResponse.includes('^_^'));
  });

  test('rageResponse includes sideEye face at 25%+', () => {
    const s = getDefaultState();
    s.session.rageMeter = 15; // will become 25 after +10
    const { rageResponse } = handleError(s);
    assert.ok(rageResponse.includes('-_-'));
  });

  test('rageResponse includes sweating face at 50%+', () => {
    const s = getDefaultState();
    s.session.rageMeter = 40; // will become 50 after +10
    const { rageResponse } = handleError(s);
    assert.ok(rageResponse.includes("^_^'"));
  });

  test('rageResponse includes flames face at 75%+', () => {
    const s = getDefaultState();
    s.session.rageMeter = 65; // will become 75 after +10
    const { rageResponse } = handleError(s);
    assert.ok(rageResponse.includes('>:('));
  });

  test('rageResponse includes meltdown face at 100%', () => {
    const s = getDefaultState();
    s.session.rageMeter = 90; // will become 100 after +10
    const { rageResponse } = handleError(s);
    assert.ok(rageResponse.includes('x_x'));
  });

  test('rageResponse includes explosion art', () => {
    const s = getDefaultState();
    s.session.errors = 0; // 1 error after handleError → small explosion
    const { rageResponse } = handleError(s);
    // small explosion has * in it
    assert.ok(rageResponse.includes('*') || rageResponse.includes('BOOM') || rageResponse.includes('KABOOOM'));
  });

  test('does not mutate input state', () => {
    const s = getDefaultState();
    const originalErrors = s.session.errors;
    handleError(s);
    assert.equal(s.session.errors, originalErrors);
  });
});

// ─── handleError (PATIENCE-based rage tuning) ────────────────────────────────

describe('handleError with buddy parameter', () => {
  test('no buddy → +10 rage (backward compat)', () => {
    const s = getDefaultState();
    const { state } = handleError(s);
    assert.equal(state.session.rageMeter, 10);
  });

  test('null buddy → +10 rage (backward compat)', () => {
    const s = getDefaultState();
    const { state } = handleError(s, null);
    assert.equal(state.session.rageMeter, 10);
  });

  test('patience=80 → +7 rage', () => {
    const s = getDefaultState();
    const buddy = { stats: { patience: 80 } };
    const { state } = handleError(s, buddy);
    // Math.round(10 * (1.5 - 80/100)) = Math.round(10 * 0.7) = 7
    assert.equal(state.session.rageMeter, 7);
  });

  test('patience=20 → +13 rage', () => {
    const s = getDefaultState();
    const buddy = { stats: { patience: 20 } };
    const { state } = handleError(s, buddy);
    // Math.round(10 * (1.5 - 20/100)) = Math.round(10 * 1.3) = 13
    assert.equal(state.session.rageMeter, 13);
  });

  test('patience=100 → +5 rage', () => {
    const s = getDefaultState();
    const buddy = { stats: { patience: 100 } };
    const { state } = handleError(s, buddy);
    // Math.round(10 * (1.5 - 100/100)) = Math.round(10 * 0.5) = 5
    assert.equal(state.session.rageMeter, 5);
  });

  test('patience=0 → +15 rage', () => {
    const s = getDefaultState();
    const buddy = { stats: { patience: 0 } };
    const { state } = handleError(s, buddy);
    // Math.round(10 * (1.5 - 0/100)) = Math.round(10 * 1.5) = 15
    assert.equal(state.session.rageMeter, 15);
  });

  test('patience=100 still caps at 100', () => {
    const s = getDefaultState();
    s.session.rageMeter = 98;
    const buddy = { stats: { patience: 100 } };
    const { state } = handleError(s, buddy);
    assert.equal(state.session.rageMeter, 100);
  });

  test('patience=0 still caps at 100', () => {
    const s = getDefaultState();
    s.session.rageMeter = 90;
    const buddy = { stats: { patience: 0 } };
    const { state } = handleError(s, buddy);
    assert.equal(state.session.rageMeter, 100);
  });
});

// ─── handleTestFail ───────────────────────────────────────────────────────────

describe('handleTestFail', () => {
  test('returns state with incremented errors', () => {
    const s = getDefaultState();
    const { state } = handleTestFail(s);
    assert.equal(state.session.errors, 1);
  });

  test('returns rageResponse string', () => {
    const s = getDefaultState();
    const { rageResponse } = handleTestFail(s);
    assert.equal(typeof rageResponse, 'string');
    assert.ok(rageResponse.length > 0);
  });

  test('returns empty sass when errors < 3', () => {
    const s = getDefaultState();
    s.session.errors = 1; // will become 2 after handleTestFail → handleError
    const { sass } = handleTestFail(s);
    assert.equal(sass, '');
  });

  test('returns sass string at 3+ consecutive errors', () => {
    const s = getDefaultState();
    s.session.errors = 2; // will become 3 after error increment
    const { sass } = handleTestFail(s);
    assert.equal(typeof sass, 'string');
    assert.ok(sass.length > 0);
  });

  test('returns sass at exactly 3 errors', () => {
    const s = getDefaultState();
    s.session.errors = 2;
    const { sass } = handleTestFail(s);
    assert.ok(sass.length > 0);
  });

  test('sass rotates through messages', () => {
    const sassMessages = [
      'hmm.',
      'you sure about that?',
      'this is fine. everything is fine.',
      'have you tried turning it off and on again?',
      'I believe in you... I think.',
      'okay this is getting concerning',
    ];

    // errors=2 → becomes 3 → index 0 (3-3=0)
    let s = getDefaultState();
    s.session.errors = 2;
    const { sass: sass0 } = handleTestFail(s);
    assert.equal(sass0, sassMessages[0]);

    // errors=3 → becomes 4 → index 1 (4-3=1)
    s = getDefaultState();
    s.session.errors = 3;
    const { sass: sass1 } = handleTestFail(s);
    assert.equal(sass1, sassMessages[1]);

    // errors=8 → becomes 9 → index (9-3)%6 = 0
    s = getDefaultState();
    s.session.errors = 8;
    const { sass: sass_wrap } = handleTestFail(s);
    assert.equal(sass_wrap, sassMessages[0]);
  });

  test('does not mutate input state', () => {
    const s = getDefaultState();
    handleTestFail(s);
    assert.equal(s.session.errors, 0);
  });

  test('passes buddy through to handleError (patience=100 → +5 rage)', () => {
    const s = getDefaultState();
    const buddy = { stats: { patience: 100 } };
    const { state } = handleTestFail(s, buddy);
    assert.equal(state.session.rageMeter, 5);
  });

  test('passes buddy through to handleError (patience=0 → +15 rage)', () => {
    const s = getDefaultState();
    const buddy = { stats: { patience: 0 } };
    const { state } = handleTestFail(s, buddy);
    assert.equal(state.session.rageMeter, 15);
  });
});

// ─── handleTestPass ───────────────────────────────────────────────────────────

describe('handleTestPass', () => {
  test('increments session.testPasses by 1', () => {
    const s = getDefaultState();
    const { state } = handleTestPass(s);
    assert.equal(state.session.testPasses, 1);
  });

  test('awards 10 XP via addXP', () => {
    const s = getDefaultState();
    const { state } = handleTestPass(s);
    assert.equal(state.xp, 10);
  });

  test('resets rageMeter to 0 when it was > 0', () => {
    const s = getDefaultState();
    s.session.rageMeter = 50;
    const { state } = handleTestPass(s);
    assert.equal(state.session.rageMeter, 0);
  });

  test('returns reliefResponse with RELIEF art when rageMeter was > 0', () => {
    const s = getDefaultState();
    s.session.rageMeter = 30;
    const { reliefResponse } = handleTestPass(s);
    assert.equal(typeof reliefResponse, 'string');
    assert.ok(reliefResponse.includes('\\o/') || reliefResponse.includes('ahhh'));
  });

  test('reliefResponse is empty string when rageMeter was 0', () => {
    const s = getDefaultState();
    s.session.rageMeter = 0;
    const { reliefResponse } = handleTestPass(s);
    assert.equal(reliefResponse, '');
  });

  test('does not mutate input state', () => {
    const s = getDefaultState();
    s.session.rageMeter = 50;
    handleTestPass(s);
    assert.equal(s.session.rageMeter, 50);
    assert.equal(s.session.testPasses, 0);
  });
});

// ─── handleTestPass (PATIENCE-based partial decay) ───────────────────────────

describe('handleTestPass with patient buddy', () => {
  test('patience > 60 with rageMeter > 5: subtracts 5 then resets to 0, returns RELIEF', () => {
    const s = getDefaultState();
    s.session.rageMeter = 30;
    const buddy = { stats: { patience: 80 } };
    const { state, reliefResponse } = handleTestPass(s, buddy);
    // 30 - 5 = 25, still > 0, so full reset to 0 + RELIEF
    assert.equal(state.session.rageMeter, 0);
    assert.ok(reliefResponse.length > 0);
  });

  test('patience > 60 with rageMeter = 5: subtracts 5 → 0, rageMeter not > 0, no RELIEF', () => {
    const s = getDefaultState();
    s.session.rageMeter = 5;
    const buddy = { stats: { patience: 80 } };
    const { state, reliefResponse } = handleTestPass(s, buddy);
    // 5 - 5 = 0, not > 0, so no reset and no RELIEF
    assert.equal(state.session.rageMeter, 0);
    assert.equal(reliefResponse, '');
  });

  test('patience > 60 with rageMeter = 3: subtracts 5 → 0 (min 0), rageMeter not > 0, no RELIEF', () => {
    const s = getDefaultState();
    s.session.rageMeter = 3;
    const buddy = { stats: { patience: 80 } };
    const { state, reliefResponse } = handleTestPass(s, buddy);
    // Math.max(0, 3-5) = 0, not > 0, no RELIEF
    assert.equal(state.session.rageMeter, 0);
    assert.equal(reliefResponse, '');
  });

  test('patience <= 60: no partial decay, behaves like default (resets to 0 if hadRage)', () => {
    const s = getDefaultState();
    s.session.rageMeter = 30;
    const buddy = { stats: { patience: 60 } };
    const { state, reliefResponse } = handleTestPass(s, buddy);
    assert.equal(state.session.rageMeter, 0);
    assert.ok(reliefResponse.length > 0);
  });

  test('patience > 60 with rageMeter = 0: no partial decay, rageMeter stays 0, no RELIEF', () => {
    const s = getDefaultState();
    s.session.rageMeter = 0;
    const buddy = { stats: { patience: 80 } };
    const { state, reliefResponse } = handleTestPass(s, buddy);
    assert.equal(state.session.rageMeter, 0);
    assert.equal(reliefResponse, '');
  });

  test('no buddy: default behavior unchanged (resets to 0, returns RELIEF)', () => {
    const s = getDefaultState();
    s.session.rageMeter = 50;
    const { state, reliefResponse } = handleTestPass(s);
    assert.equal(state.session.rageMeter, 0);
    assert.ok(reliefResponse.length > 0);
  });
});

// ─── handleFileEdit ───────────────────────────────────────────────────────────

describe('handleFileEdit', () => {
  test('tracks edits in session.edits[filePath]', () => {
    const s = getDefaultState();
    const { state } = handleFileEdit(s, 'src/foo.js');
    assert.equal(state.session.edits['src/foo.js'], 1);
  });

  test('increments edit count on subsequent calls', () => {
    let s = getDefaultState();
    ({ state: s } = handleFileEdit(s, 'src/foo.js'));
    ({ state: s } = handleFileEdit(s, 'src/foo.js'));
    assert.equal(s.session.edits['src/foo.js'], 2);
  });

  test('returns empty roast string below 5 edits', () => {
    let s = getDefaultState();
    let roast;
    for (let i = 0; i < 4; i++) {
      ({ state: s, roast } = handleFileEdit(s, 'src/foo.js'));
    }
    assert.equal(roast, '');
  });

  test('returns roast string at 5+ edits to same file', () => {
    let s = getDefaultState();
    let roast;
    for (let i = 0; i < 5; i++) {
      ({ state: s, roast } = handleFileEdit(s, 'src/foo.js'));
    }
    assert.equal(typeof roast, 'string');
    assert.ok(roast.length > 0);
  });

  test('roast contains one of the expected messages or filename', () => {
    const roastMessages = [
      'you live here now huh',
      'this file owes you rent',
      'at this point just rewrite it',
      'couples therapy',
    ];
    let s = getDefaultState();
    let roast;
    for (let i = 0; i < 5; i++) {
      ({ state: s, roast } = handleFileEdit(s, 'src/foo.js'));
    }
    const hasMatch = roastMessages.some((msg) => roast.includes(msg));
    assert.ok(hasMatch, `Expected roast to contain one of the roast messages, got: "${roast}"`);
  });

  test('roast rotates messages', () => {
    // 5th edit → index (5-5)%4=0 → "you live here now huh"
    let s = getDefaultState();
    let roast;
    for (let i = 0; i < 5; i++) {
      ({ state: s, roast } = handleFileEdit(s, 'file.js'));
    }
    assert.ok(roast.includes('you live here now huh'));

    // 6th edit → index (6-5)%4=1 → "this file owes you rent"
    ({ state: s, roast } = handleFileEdit(s, 'file.js'));
    assert.ok(roast.includes('this file owes you rent'));
  });

  test('couples therapy roast includes filename', () => {
    // 8th edit → index (8-5)%4=3 → couples therapy roast
    let s = getDefaultState();
    let roast;
    for (let i = 0; i < 8; i++) {
      ({ state: s, roast } = handleFileEdit(s, 'myfile.js'));
    }
    assert.ok(roast.includes('myfile.js'));
  });

  test('tracks different files independently', () => {
    let s = getDefaultState();
    ({ state: s } = handleFileEdit(s, 'a.js'));
    ({ state: s } = handleFileEdit(s, 'b.js'));
    assert.equal(s.session.edits['a.js'], 1);
    assert.equal(s.session.edits['b.js'], 1);
  });

  test('does not mutate input state', () => {
    const s = getDefaultState();
    handleFileEdit(s, 'foo.js');
    assert.equal(s.session.edits['foo.js'], undefined);
  });
});

// ─── handleDestructiveOp ──────────────────────────────────────────────────────

describe('handleDestructiveOp', () => {
  test('increments stats.destructiveOps by 1', () => {
    const s = getDefaultState();
    const { state } = handleDestructiveOp(s, 'rm -rf .');
    assert.equal(state.stats.destructiveOps, 1);
  });

  test('returns response string containing SKULL art', () => {
    const s = getDefaultState();
    const { response } = handleDestructiveOp(s, 'rm -rf .');
    assert.equal(typeof response, 'string');
    // SKULL art contains x x
    assert.ok(response.includes('x x') || response.includes('.-"-.') || response.includes("'---'"));
  });

  test('returns response containing bold move message', () => {
    const s = getDefaultState();
    const { response } = handleDestructiveOp(s, 'rm -rf .');
    assert.ok(response.includes('bold move'));
  });

  test('returns achievement null below 5 destructive ops', () => {
    const s = getDefaultState();
    s.stats.destructiveOps = 3; // will become 4
    const { achievement } = handleDestructiveOp(s, 'git reset --hard');
    assert.equal(achievement, null);
  });

  test('returns achievement daredevil at exactly 5 destructive ops', () => {
    const s = getDefaultState();
    s.stats.destructiveOps = 4; // will become 5
    const { achievement } = handleDestructiveOp(s, 'rm -rf');
    assert.equal(achievement, 'daredevil');
  });

  test('returns achievement daredevil beyond 5 destructive ops', () => {
    const s = getDefaultState();
    s.stats.destructiveOps = 10; // will become 11
    const { achievement } = handleDestructiveOp(s, 'rm -rf');
    assert.equal(achievement, 'daredevil');
  });

  test('does not mutate input state', () => {
    const s = getDefaultState();
    handleDestructiveOp(s, 'rm -rf .');
    assert.equal(s.stats.destructiveOps, 0);
  });
});

// ─── handleFileDelete ─────────────────────────────────────────────────────────

describe('handleFileDelete', () => {
  test('returns response string', () => {
    const s = getDefaultState();
    const { response } = handleFileDelete(s, 'src/foo.js');
    assert.equal(typeof response, 'string');
    assert.ok(response.length > 0);
  });

  test('response includes GRAVESTONE art', () => {
    const s = getDefaultState();
    const { response } = handleFileDelete(s, 'src/foo.js');
    // GRAVESTONE has R I P
    assert.ok(response.includes('R') && response.includes('I') && response.includes('P'));
  });

  test('response includes the filename', () => {
    const s = getDefaultState();
    const { response } = handleFileDelete(s, 'src/my-module.js');
    assert.ok(response.includes('my-module.js'));
  });

  test('returns state unchanged', () => {
    const s = getDefaultState();
    const { state } = handleFileDelete(s, 'foo.js');
    assert.equal(state.xp, s.xp);
    assert.equal(state.level, s.level);
  });

  test('does not mutate input state', () => {
    const s = getDefaultState();
    handleFileDelete(s, 'foo.js');
    assert.equal(s.xp, 0);
  });
});
