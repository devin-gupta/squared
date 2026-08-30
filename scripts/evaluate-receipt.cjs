// Explicit, opt-in live evaluation. Sends only the supplied image to the app's
// configured AI providers (including the paid OpenAI fallback, if configured);
// never uploads it to storage or writes a trip.
// Usage: node scripts/evaluate-receipt.cjs /path/to/image.png [runs:1-5]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
require("@next/env").loadEnvConfig(process.cwd(), false);
const cache = new Map();
function sourceModule(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const load = (name) => {
    if (name === "server-only") return {};
    if (name === "openai") {
      const OpenAI = require("openai").default;
      class EvaluatedClient extends OpenAI {
        constructor(options) {
          super(options);
          const create = this.chat.completions.create.bind(
            this.chat.completions,
          );
          this.chat.completions.create = async (...args) => {
            try {
              const response = await create(...args);
              console.log(
                JSON.stringify({
                  providerModel: response.model,
                  finishReason: response.choices[0]?.finish_reason,
                }),
              );
              return response;
            } catch (error) {
              const message = String(error.message || "");
              console.log(
                JSON.stringify({
                  providerStatus: error.status,
                  errorType: error.constructor.name,
                  limitWindow: /per.day|daily/i.test(message)
                    ? "daily"
                    : /per.minute/i.test(message)
                      ? "minute"
                      : undefined,
                  retryAfter: error.headers?.get?.("retry-after") || undefined,
                }),
              );
              throw error;
            }
          };
        }
      }
      return { default: EvaluatedClient };
    }
    if (name.startsWith("."))
      return sourceModule(path.resolve(path.dirname(filename), name) + ".ts");
    if (name.startsWith("@/"))
      return sourceModule(path.resolve(name.slice(2)) + ".ts");
    return require(name);
  };
  const run = vm.runInThisContext(
    `(function(require,module,exports){${code}\n})`,
    { filename },
  );
  run(load, module, module.exports);
  return module.exports;
}
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Supply a local receipt image path.");
  const runs = Math.max(1, Math.min(5, Number(process.argv[3]) || 1));
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[path.extname(file).toLowerCase()];
  if (!mime) throw new Error("Use a PNG, JPEG, or WebP image.");
  const data = fs.readFileSync(file).toString("base64");
  const { parseReceiptImage } = sourceModule("lib/ai/parser.ts");
  for (let run = 1; run <= runs; run++) {
    const start = Date.now();
    try {
      const parsed = await parseReceiptImage(data, [], mime);
      console.log(
        JSON.stringify({ run, elapsedMs: Date.now() - start, ...parsed }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          run,
          elapsedMs: Date.now() - start,
          error: error.message,
        }),
      );
      process.exitCode = 1;
      break; // Do not hammer a rate-limited or unavailable provider.
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
