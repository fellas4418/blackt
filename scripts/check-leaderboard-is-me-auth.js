#!/usr/bin/env node
/**
 * Guard: /api/leaderboard must not treat caller phone alone as is_me.
 * Phone-only self-claim unmasks display_name, which with simple-auth
 * (password === phone::normalizeName(name)) enables account takeover.
 */
'use strict';

const fs = require('fs');
const path = require('path');

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

const src = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const start = src.indexOf('async function handleLeaderboard');
ok(start >= 0, 'handleLeaderboard exists');
const end = src.indexOf('\nexport { GeminiProxy }', start);
const lbBody = start >= 0 ? src.slice(start, end > start ? end : start + 5000) : '';

const isMeBlock = (() => {
  const i = lbBody.indexOf('const isMe');
  if (i < 0) return '';
  const j = lbBody.indexOf('items.push', i);
  return lbBody.slice(i, j > i ? j : i + 500);
})();

ok(!!isMeBlock, 'isMe assignment found');
ok(/!!myName/.test(isMeBlock) || /myName\s*&&/.test(isMeBlock), 'isMe requires myName (not phone-only)');
ok(
  !/\(phone\s*===\s*myPhone\s*\|\|/.test(isMeBlock),
  'isMe does not treat phone === myPhone alone as sufficient'
);
ok(
  /userId\s*===\s*myUserId/.test(isMeBlock),
  'isMe still matches verified myUserId when name+phone present'
);
ok(
  /normalizeName\(realName\)\s*===\s*normalizeName\(myName\)/.test(isMeBlock),
  'isMe still matches name+phone together'
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll leaderboard is_me auth checks passed');
