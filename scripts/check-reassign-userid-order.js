#!/usr/bin/env node
/**
 * Guard: reassignUserId must migrate CASCADE child tables BEFORE deleting the old user.
 * Wrong order (DELETE users then UPDATE saved_*) permanently wipes vocabulary/grammar notes
 * because d1-schema.sql defines ON DELETE CASCADE on those FKs and D1 enforces FKs.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'd1-schema.sql'), 'utf8');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}
function pass(msg) {
  console.log('OK:', msg);
}

if (!/saved_voca[\s\S]*?ON DELETE CASCADE/.test(schema)) {
  fail('d1-schema.sql: saved_voca missing ON DELETE CASCADE');
} else {
  pass('schema: saved_voca has ON DELETE CASCADE');
}
if (!/saved_grammar[\s\S]*?ON DELETE CASCADE/.test(schema)) {
  fail('d1-schema.sql: saved_grammar missing ON DELETE CASCADE');
} else {
  pass('schema: saved_grammar has ON DELETE CASCADE');
}

const start = src.indexOf('async function reassignUserId');
if (start < 0) {
  fail('reassignUserId not found');
  process.exit(1);
}
const end = src.indexOf('\nasync function handleAdminMemberUpdate', start);
const block = end > start ? src.slice(start, end) : src.slice(start, start + 2000);

const insertPos = block.indexOf('INSERT INTO users');
const updateVocaPos = block.indexOf('UPDATE ${table} SET user_id') >= 0
  ? block.indexOf('UPDATE ${table} SET user_id')
  : block.indexOf('saved_voca');
const updateTablesPos = block.indexOf('const tables');
const deletePos = block.indexOf('DELETE FROM users');

if (insertPos < 0) fail('reassignUserId: INSERT INTO users missing');
else pass('reassignUserId: INSERT INTO users present');

if (updateTablesPos < 0) fail('reassignUserId: child table migration list missing');
else pass('reassignUserId: child table migration list present');

if (deletePos < 0) fail('reassignUserId: DELETE FROM users missing');
else pass('reassignUserId: DELETE FROM users present');

if (insertPos >= 0 && updateTablesPos >= 0 && insertPos > updateTablesPos) {
  fail('reassignUserId: INSERT users must come before child UPDATEs');
}
if (updateTablesPos >= 0 && deletePos >= 0 && deletePos < updateTablesPos) {
  fail(
    'reassignUserId: DELETE FROM users runs before child UPDATEs — CASCADE wipes saved_voca/saved_grammar'
  );
} else if (deletePos >= 0 && updateTablesPos >= 0) {
  pass('reassignUserId: child UPDATEs run before DELETE FROM users');
}

for (const table of ['daily_session', 'exam_analysis', 'chat_history', 'saved_voca', 'saved_grammar']) {
  if (!block.includes(`"${table}"`)) fail(`reassignUserId missing table: ${table}`);
  else pass(`reassignUserId migrates: ${table}`);
}

if (process.exitCode) {
  console.error('\ncheck-reassign-userid-order: FAILED');
  process.exit(1);
}
console.log('\ncheck-reassign-userid-order: passed');
