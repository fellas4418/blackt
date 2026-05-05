import assert from "node:assert/strict";
import test from "node:test";

import { promoteLegacySimpleAuthUser } from "./index.js";

function createMockDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          return { sql, params };
        },
      };
    },
    async batch(statements) {
      calls.push(...statements);
    },
  };
}

test("legacy simple-auth promotion preserves foreign-key order", async () => {
  const DB = createMockDb();

  await promoteLegacySimpleAuthUser(
    { DB },
    "01012345678",
    "01012345678::kim",
    "new-password-hash"
  );

  assert.deepEqual(
    DB.calls.map((call) => call.sql),
    [
      "INSERT INTO users (id, password_hash) VALUES (?1, ?2)",
      "UPDATE saved_voca SET user_id = ?1 WHERE user_id = ?2",
      "UPDATE saved_grammar SET user_id = ?1 WHERE user_id = ?2",
      "DELETE FROM users WHERE id = ?1",
    ]
  );
  assert.deepEqual(DB.calls[0].params, ["01012345678::kim", "new-password-hash"]);
  assert.deepEqual(DB.calls[1].params, ["01012345678::kim", "01012345678"]);
  assert.deepEqual(DB.calls[2].params, ["01012345678::kim", "01012345678"]);
  assert.deepEqual(DB.calls[3].params, ["01012345678"]);
});
