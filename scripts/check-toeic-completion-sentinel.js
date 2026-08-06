const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createStorage(initial) {
  const store = Object.assign({}, initial);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

function loadToeicUnlock(initialStorage) {
  const localStorage = createStorage(initialStorage);
  const sessionStorage = createStorage({});
  const context = {
    console,
    localStorage,
    sessionStorage,
    performance: {
      getEntriesByType() {
        return [{ type: 'navigate' }];
      },
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() {
        return null;
      },
    },
    TriggerToeicSchedule: {
      TOEIC_TOTAL_DAYS: 54,
    },
    alert() {},
    prompt() {
      return null;
    },
    window: {},
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'toeic-unlock.js'), 'utf8'),
    context,
    { filename: 'toeic-unlock.js' }
  );
  return context;
}

let ctx = loadToeicUnlock({
  trigger_level: 'toeic',
  trigger_toeic_unlocked: '1',
  trigger_current_day_toeic: '55',
  trigger_unlocked_day_toeic: '55',
});
ctx.window.syncLevelOnLoad();
assert.strictEqual(ctx.localStorage.getItem('trigger_current_day_toeic'), '55');
assert.strictEqual(ctx.localStorage.getItem('trigger_unlocked_day_toeic'), '55');

ctx = loadToeicUnlock({
  trigger_level: 'toeic',
  trigger_toeic_unlocked: '1',
  trigger_current_day_toeic: '80',
  trigger_unlocked_day_toeic: '80',
});
ctx.window.syncLevelOnLoad();
assert.strictEqual(ctx.localStorage.getItem('trigger_current_day_toeic'), '55');
assert.strictEqual(ctx.localStorage.getItem('trigger_unlocked_day_toeic'), '55');

ctx = loadToeicUnlock({
  trigger_level: 'toeic',
  trigger_toeic_unlocked: '1',
  trigger_current_day_toeic: '54',
  trigger_unlocked_day_toeic: '54',
});
ctx.window.syncLevelOnLoad();
assert.strictEqual(ctx.localStorage.getItem('trigger_current_day_toeic'), '54');
assert.strictEqual(ctx.localStorage.getItem('trigger_unlocked_day_toeic'), '54');

console.log('TOEIC completion sentinel check passed');
