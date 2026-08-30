const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

module.exports = function moduleAt(file, dependencies = {}, globals = {}) {
  const context = {
    exports: {},
    console,
    Date,
    URL,
    AbortSignal,
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://squared.example.test",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
      },
    },
    ...globals,
    require(name) {
      if (!(name in dependencies))
        throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    context,
  );
  return context.exports;
};
