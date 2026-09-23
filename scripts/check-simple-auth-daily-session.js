#!/usr/bin/env node
/**
 * Guard: legacy phone-only → phone::name promotion must reassign daily_session.
 * Without this, /api/streak and leaderboard detach from the live account.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}
function pass(msg) {
  console.log('OK:', msg);
}

const promoStart = src.indexOf('ids.length === 1 && ids[0] === phone');
if (promoStart < 0) {
  fail('legacy phone-only promotion branch not found');
  process.exit(1);
}
const promoEnd = src.indexOf('// 2-2)', promoStart);
if (promoEnd < 0) {
  fail('promotion branch end marker // 2-2) not found');
  process.exit(1);
}
const promoBlock = src.slice(promoStart, promoEnd);

const required = [
  'UPDATE saved_voca SET user_id',
  'UPDATE saved_grammar SET user_id',
  'UPDATE daily_session SET user_id',
];

for (const token of required) {
  if (!promoBlock.includes(token)) fail('promotion missing: ' + token);
  else pass('promotion has: ' + token);
}

const reassignStart = src.indexOf('async function reassignUserId');
if (reassignStart < 0) {
  fail('reassignUserId not found');
} else {
  const reassignSlice = src.slice(reassignStart, reassignStart + 1200);
  if (!reassignSlice.includes('"daily_session"')) {
    fail('reassignUserId no longer migrates daily_session');
  } else {
    pass('reassignUserId still migrates daily_session');
  }
}

if (process.exitCode) {
  console.error('\ncheck-simple-auth-daily-session: FAILED');
  process.exit(1);
}
console.log('\ncheck-simple-auth-daily-session: passed');
