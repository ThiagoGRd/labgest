/* eslint-disable @typescript-eslint/no-require-imports */
// Compile the project's real CSS inside a sanitized validation checkout.
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..')
const webRequire = createRequire(path.join(root, 'web/package.json'))
const postcss = webRequire('postcss')
const tailwind = webRequire('@tailwindcss/postcss')
const source = path.join(root, 'web/src/app/globals.css')
fs.mkdirSync(path.join(root, 'delivery'), { recursive: true })
postcss([tailwind({ base: path.join(root, 'web') })])
  .process(fs.readFileSync(source, 'utf8'), { from: source })
  .then(result => {
    const output = path.join(root, 'delivery/tailwind.css')
    fs.writeFileSync(output, result.css)
    console.log(output)
  }).catch(error => { console.error(error); process.exitCode = 1 })
