import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";

function createEnv() {
  return {
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "test-model",
    DB: {
      prepare(sql) {
        return {
          bind(userId) {
            return {
              async first() {
                if (sql.includes("SELECT id FROM users")) {
                  return userId === "user-1" ? { id: "user-1" } : null;
                }
                return null;
              },
            };
          },
        };
      },
    },
  };
}

test("Gemini proxy rejects unauthenticated requests before calling Gemini", async () => {
  const originalFetch = globalThis.fetch;
  let geminiCalled = false;
  globalThis.fetch = async () => {
    geminiCalled = true;
    throw new Error("Gemini should not be called");
  };

  try {
    const response = await worker.fetch(
      new Request("https://worker.example/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hello" }] }] }),
      }),
      createEnv()
    );

    assert.equal(response.status, 401);
    assert.equal(geminiCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gemini proxy strips auth fields from forwarded payload", async () => {
  const originalFetch = globalThis.fetch;
  let forwardedBody;
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await worker.fetch(
      new Request("https://worker.example/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "user-1",
          password: "secret",
          contents: [{ parts: [{ text: "hello" }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }),
      createEnv()
    );

    assert.equal(response.status, 200);
    assert.deepEqual(forwardedBody, {
      contents: [{ parts: [{ text: "hello" }] }],
      generationConfig: { temperature: 0.1 },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
