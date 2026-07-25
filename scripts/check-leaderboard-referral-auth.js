#!/usr/bin/env node
/**
 * Guards: public leaderboard must not leak user_id (simple-auth password),
 * and referral signup/claim must require verifyUser + self match.
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
const credit = fs.readFileSync(path.join(root, 'trigger-credit.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const lbFn = src.match(/async function handleLeaderboard[\s\S]*?^async function |async function handleLeaderboard[\s\S]*?^export /m);
const lbBody = (() => {
  const start = src.indexOf('async function handleLeaderboard');
  ok(start >= 0, 'handleLeaderboard exists');
  if (start < 0) return '';
  const end = src.indexOf('\nexport { GeminiProxy }', start);
  return src.slice(start, end > start ? end : start + 4000);
})();

ok(
  /items\.push\(\{[\s\S]*?display_name:/.test(lbBody) && !/items\.push\(\{[\s\S]*?user_id\s*:/.test(lbBody),
  'leaderboard items omit user_id'
);
ok(!/user_id:\s*userId/.test(lbBody), 'leaderboard push has no user_id: userId');

const signupFnStart = src.indexOf('async function handleReferralSignup');
const claimFnStart = src.indexOf('async function handleReferralClaim');
ok(signupFnStart >= 0 && claimFnStart >= 0, 'referral handlers exist');
const signupFn = src.slice(signupFnStart, claimFnStart);
const claimFn = src.slice(claimFnStart, src.indexOf('function maskLeaderboardName'));

ok(/verifyUser\(env,\s*userId,\s*password\)/.test(signupFn), 'referral signup calls verifyUser');
ok(/phoneFromUserId\(userId\)\s*!==\s*refereePhone/.test(signupFn), 'referral signup requires self phone');
ok(/verifyUser\(env,\s*userId,\s*password\)/.test(claimFn), 'referral claim calls verifyUser');
ok(/referrerId\s*!==\s*myRef/.test(claimFn), 'referral claim requires own referrer_id');

ok(
  /postReferralApi\('\/api\/referral\/claim'[\s\S]*?user_id:\s*auth\.user_id[\s\S]*?password:\s*auth\.password/.test(
    credit
  ),
  'client claim sends user_id/password'
);
ok(
  /postReferralApi\('\/api\/referral\/signup'[\s\S]*?user_id:\s*auth\.user_id[\s\S]*?password:\s*auth\.password/.test(
    credit
  ),
  'client signup sends user_id/password'
);
ok(
  /reportReferralSignup\(referredBy,\s*phone,\s*\{[\s\S]*?user_id:[\s\S]*?auth_password/.test(indexHtml),
  'login reports referral only after auth with credentials'
);
ok(
  !/reportReferralSignup\(referredBy,\s*phone\);/.test(indexHtml),
  'login no longer reports referral before auth'
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll leaderboard/referral auth checks passed');
