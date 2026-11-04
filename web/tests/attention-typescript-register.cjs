/* eslint-disable @typescript-eslint/no-require-imports */
// Safe fallback for this checkout's macOS-only esbuild. Never loads env files.
const ts = require('typescript'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const original = Module._resolveFilename
Module._resolveFilename = function(name, parent, ...args) {
  if(name === '@labgest/shared') name = path.join(root, 'packages/shared/src/index.ts')
  if(name.startsWith('@/')) name = path.join(root, 'web/src', name.slice(2))
  return original.call(this, name, parent, ...args)
}
for(const ext of ['.ts','.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename)
