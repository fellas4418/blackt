#!/usr/bin/env node
/**
 * Guards: legacy middle_note/high_note → extra_note migration must
 * preserve day maps and always copy progress (not only when trigger_level is legacy).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    console.log('OK  ' + msg);
  } else {
    console.error('FAIL ' + msg);
    failed += 1;
  }
}

const src = fs.readFileSync(path.join(root, 'voca-extra-ocr.js'), 'utf8');

ok(
  /function migrateLegacyExtraNote\s*\(/.test(src),
  'migrateLegacyExtraNote exists'
);
ok(
  !/allWords\s*=\s*allWords\.concat/.test(src),
  'migration does not flatten allWords via concat'
);
ok(
  !/chunkWords\(normalizeEntries\(allWords\)/.test(src),
  'migration does not rechunk flattened allWords'
);
ok(
  /trigger_current_day_middle_note/.test(src) && /trigger_current_day_high_note/.test(src),
  'progress reads both legacy levels'
);
ok(
  !/if\s*\(\s*isLegacyExtraLevel\(\s*lvl\s*\)\s*\)\s*\{\s*\[['"]trigger_current_day_/.test(src),
  'progress copy is not gated only on legacy trigger_level'
);
ok(
  /middleMax\s*\+\s*d/.test(src) || /String\(\s*middleMax\s*\+\s*d\s*\)/.test(src),
  'dual-track merge appends high days after middle with offset'
);
ok(
  /removeItem\(\s*key\s*\)/.test(src) || /LEGACY_STORAGE_KEYS\.forEach/.test(src),
  'legacy storage keys cleaned after migrate'
);

function runWithStorage(initial) {
  const store = Object.assign({}, initial);
  const localStorage = {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem: function (k, v) {
      store[k] = String(v);
    },
    removeItem: function (k) {
      delete store[k];
    }
  };
  const sandbox = {
    localStorage: localStorage,
    document: {
      readyState: 'loading',
      addEventListener: function () {}
    },
    console: console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'voca-extra-ocr.js' });
  return store;
}

// Scenario A: short Day1 + full Day2 must keep day boundaries (no rechunk scramble)
(function () {
  const day1 = [{ word: 'a', meanings: ['1'] }, { word: 'b', meanings: ['2'] }];
  const day2 = [];
  for (let i = 0; i < 30; i++) day2.push({ word: 'w' + i, meanings: ['m'] });
  const store = runWithStorage({
    trigger_level: 'middle',
    trigger_middle_note_user_days: JSON.stringify({ '1': day1, '2': day2 }),
    trigger_current_day_middle_note: '2',
    trigger_unlocked_day_middle_note: '2',
    trigger_session_middle_note: '1'
  });
  const days = JSON.parse(store.trigger_extra_note_user_days || '{}');
  ok(Array.isArray(days['1']) && days['1'].length === 2, 'short Day1 preserved (len 2)');
  ok(Array.isArray(days['2']) && days['2'].length === 30, 'Day2 preserved (len 30)');
  ok(store.trigger_current_day_extra_note === '2', 'progress current copied while on middle');
  ok(store.trigger_unlocked_day_extra_note === '2', 'progress unlocked copied while on middle');
  ok(!store.trigger_middle_note_user_days, 'legacy middle days removed');
  ok(!store.trigger_current_day_middle_note, 'legacy middle progress removed');
})();

// Scenario B: STORAGE_KEY already migrated, progress was reset to 1 — heal from legacy
(function () {
  const store = runWithStorage({
    trigger_level: 'high',
    trigger_extra_note_user_days: JSON.stringify({
      '1': [{ word: 'x', meanings: ['1'] }]
    }),
    trigger_current_day_extra_note: '1',
    trigger_unlocked_day_extra_note: '1',
    trigger_session_extra_note: '1',
    trigger_current_day_middle_note: '4',
    trigger_unlocked_day_middle_note: '5',
    trigger_session_middle_note: '2'
  });
  ok(store.trigger_current_day_extra_note === '4', 'heals current_day from legacy after reset');
  ok(store.trigger_unlocked_day_extra_note === '5', 'heals unlocked_day from legacy after reset');
  ok(store.trigger_session_extra_note === '2', 'heals session from legacy');
})();

// Scenario C: both tracks — high days append after middle; high progress offset
(function () {
  const store = runWithStorage({
    trigger_level: 'high_note',
    trigger_middle_note_user_days: JSON.stringify({
      '1': [{ word: 'm1', meanings: ['1'] }],
      '2': [{ word: 'm2', meanings: ['2'] }]
    }),
    trigger_high_note_user_days: JSON.stringify({
      '1': [{ word: 'h1', meanings: ['1'] }]
    }),
    trigger_current_day_high_note: '1',
    trigger_unlocked_day_high_note: '1',
    trigger_session_high_note: '1'
  });
  const days = JSON.parse(store.trigger_extra_note_user_days || '{}');
  ok(days['1'] && days['1'][0].word === 'm1', 'middle Day1 stays at 1');
  ok(days['2'] && days['2'][0].word === 'm2', 'middle Day2 stays at 2');
  ok(days['3'] && days['3'][0].word === 'h1', 'high Day1 becomes Day3');
  ok(store.trigger_current_day_extra_note === '3', 'high current_day offset by middleMax');
  ok(store.trigger_level === 'extra_note', 'legacy trigger_level normalized');
})();

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll extra_note migration checks passed');
