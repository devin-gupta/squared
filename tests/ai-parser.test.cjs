const test = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("zod");
const moduleAt = require("./load-module.cjs");
const amounts = moduleAt("lib/ai/amounts.ts", {}, { Intl });
const categories = moduleAt("lib/categories.ts");
const currency = moduleAt("lib/currency/convert.ts");
const normalize = moduleAt("lib/ai/normalize.ts", {
  "../categories": categories,
  "./amounts": amounts,
});
const schemas = moduleAt("lib/ai/schemas.ts", { zod: { z } });
const prompts = moduleAt("lib/ai/prompts.ts", {
  "../categories": categories,
  "../currency/convert": currency,
});
function harness(result) {
  const requests = [];
  class APIError extends Error {
    constructor(status) {
      super("Private upstream details");
      this.status = status;
    }
  }
  class Client {
    static APIError = APIError;
    constructor(options) {
      assert.equal(options.maxRetries, 0);
      this.chat = {
        completions: {
          create: async (body) => {
            requests.push(body);
            if (result instanceof Error) throw result;
            return { choices: [{ message: { content: result } }] };
          },
        },
      };
    }
  }

  return {
    requests,
    APIError,
    parser: moduleAt(
      "lib/ai/parser.ts",
      {
        "server-only": {},
        openai: { default: Client },
        "./schemas": schemas,
        "./prompts": prompts,
        "./normalize": normalize,
      },
      { process: { env: { OPENROUTER_API_KEY: "synthetic-test-key" } } },
    ),
  };
}
const booking = {
  description: "Car rental — MG ZS, Keflavik Airport",
  amount_text: "79.086 ISK",
  total_amount: 79.086,
  currency: "ISK",
  split_type: "equal",
  category: "car_rental",
};
test("image parser sends the note and correct MIME to a pinned free vision model and normalizes the printed total", async () => {
  const h = harness("```json\n" + JSON.stringify(booking) + "\n```");
  const result = await h.parser.parseReceiptImage(
    "synthetic-image",
    ["Sam"],
    "image/png",
    "Sam paid, split equally",
  );
  assert.equal(result.total_amount, 79086);
  assert.equal(result.line_items[0].amount, 79086);
  assert.equal(result.line_items[0].category, "car_rental");
  const req = h.requests[0];
  assert.equal(req.model, "google/gemma-4-31b-it:free");
  assert.equal(
    req.messages[1].content[1].image_url.url,
    "data:image/png;base64,synthetic-image",
  );
  assert.match(req.messages[1].content[0].text, /Sam paid, split equally/);
  assert.equal(h.requests.length, 1);
});
test("a missing image currency requires selection while ordinary text retains its USD default", async () => {
  const { currency: ignored, ...withoutCurrency } = booking;
  const h = harness(JSON.stringify(withoutCurrency));
  assert.equal((await h.parser.parseReceiptImage("image")).currency, "UNKNOWN");
  assert.equal(
    (await h.parser.parseTransactionText("Car rental $100")).currency,
    "USD",
  );
});
test("malformed and schema-invalid AI output fail safely, with no paid fallback or retry", async () => {
  for (const content of ["not JSON", "{}"]) {
    const h = harness(content);
    await assert.rejects(
      h.parser.parseReceiptImage("image"),
      (error) => error.status === 422 && !error.message.includes("Private"),
    );
    assert.equal(h.requests.length, 1);
  }
});
test("rate limits remain actionable and never trigger another model call", async () => {
  let calls = 0;
  class APIError extends Error {
    constructor() {
      super("Private upstream details");
      this.status = 429;
    }
  }
  class Client {
    static APIError = APIError;
    constructor() {
      this.chat = {
        completions: {
          create: async () => {
            calls++;
            throw new APIError();
          },
        },
      };
    }
  }
  const parser = moduleAt(
    "lib/ai/parser.ts",
    {
      "server-only": {},
      openai: { default: Client },
      "./schemas": schemas,
      "./prompts": prompts,
      "./normalize": normalize,
    },
    { process: { env: { OPENROUTER_API_KEY: "synthetic-test-key" } } },
  );
  await assert.rejects(
    parser.parseReceiptImage("image"),
    (error) =>
      error.status === 429 &&
      /usage limit/.test(error.message) &&
      !error.message.includes("Private"),
  );
  assert.equal(calls, 1);
});

function fallbackHarness(primary, secondary, configured = true) {
  const calls = [];
  const clients = [];
  class APIError extends Error {
    constructor(status) {
      super("Private upstream response");
      this.status = status;
    }
  }
  class Client {
    static APIError = APIError;
    constructor(options) {
      clients.push(options);
      this.chat = {
        completions: {
          create: async (body) => {
            calls.push(body);
            const result =
              options.baseURL === "https://api.openai.com/v1"
                ? secondary
                : primary;
            if (typeof result === "number") throw new APIError(result);
            if (result === "timeout")
              throw new Error("Private timeout information");
            return { choices: [{ message: { content: result } }] };
          },
        },
      };
    }
  }
  const env = {
    OPENROUTER_API_KEY: "free-test-key",
    ...(configured ? { OPENAI_API_KEY: "paid-test-key" } : {}),
  };
  return {
    calls,
    clients,
    parser: moduleAt(
      "lib/ai/parser.ts",
      {
        "server-only": {},
        openai: { default: Client },
        "./schemas": schemas,
        "./prompts": prompts,
        "./normalize": normalize,
      },
      { process: { env } },
    ),
  };
}

test("a primary 429 makes exactly one OpenAI fallback with the same image and note, separate credentials, and bounded usage", async () => {
  const h = fallbackHarness(429, JSON.stringify(booking));
  const result = await h.parser.parseReceiptImage(
    "synthetic-image",
    ["Sam"],
    "image/png",
    "Sam paid",
  );
  assert.equal(result.total_amount, 79086);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].model, "google/gemma-4-31b-it:free");
  assert.equal(h.calls[1].model, "gpt-4.1-mini-2025-04-14");
  assert.deepEqual(h.calls[1].messages, h.calls[0].messages);
  assert.equal(h.calls[1].store, false);
  assert.equal(h.calls[1].max_tokens, 4096);
  assert.equal(h.clients[0].apiKey, "free-test-key");
  assert.equal(h.clients[1].apiKey, "paid-test-key");
  for (const client of h.clients) {
    assert.equal(client.maxRetries, 0);
    assert.equal(client.timeout, 25000);
  }
});

test("a working primary never calls OpenAI, even when a fallback key is configured", async () => {
  const h = fallbackHarness(JSON.stringify(booking), 500);
  await h.parser.parseTransactionText("Rental 79.086 ISK");
  assert.equal(h.calls.length, 1);
  assert.equal(h.clients.length, 1);
});

test("missing fallback credentials, authentication errors, timeouts and invalid output never cause paid calls", async () => {
  for (const [primary, configured, status] of [
    [429, false, 429],
    [401, true, 503],
    [403, true, 503],
    [500, true, 503],
    ["timeout", true, 503],
    ["not JSON", true, 422],
    ["{}", true, 422],
  ]) {
    const h = fallbackHarness(primary, JSON.stringify(booking), configured);
    await assert.rejects(
      h.parser.parseReceiptImage("image"),
      (error) => error.status === status,
    );
    assert.equal(h.calls.length, 1);
    assert.equal(h.clients.length, 1);
  }
});

test("fallback failure remains safe and cannot recurse or trigger further retries", async () => {
  for (const [secondary, status] of [
    [429, 429],
    [401, 503],
    [500, 503],
    ["timeout", 503],
    ["not JSON", 422],
  ]) {
    const h = fallbackHarness(429, secondary);
    await assert.rejects(
      h.parser.parseTransactionText("Dinner $10"),
      (error) => error.status === status && !error.message.includes("Private"),
    );
    assert.equal(h.calls.length, 2);
    assert.equal(h.clients.length, 2);
  }
});
