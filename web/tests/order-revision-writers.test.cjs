/* eslint-disable @typescript-eslint/no-require-imports -- Standalone source-protocol regression. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.ts') ? [path.join(dir, entry.name)] : [])
}
test('every order writer supplies an explicit revision and uses a transaction client', () => {
  const writers = []
  for (const file of ['web/src', 'portal/src', 'packages/database/src'].flatMap(dir => files(path.join(root, dir)))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['update', 'updateMany'].includes(node.expression.name.text)) {
        const model = node.expression.expression
        if (ts.isPropertyAccessExpression(model) && model.name.text === 'ordem') {
          const location = `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
          writers.push(location)
          assert.notEqual(model.expression.getText(source), 'prisma', `${location}: an order write must use a transaction client`)
          const args = node.arguments[0]
          const data = args?.properties?.find(property => property.name?.getText(source) === 'data')?.initializer
          assert.ok(data?.properties?.some(property => property.name?.getText(source) === 'updatedAt'), `${location}: explicit monotonic updatedAt is required; default Prisma wall clock can repeat an old revision`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.ok(writers.length >= 30, 'enumeration must include both applications and shared order writers')
})
