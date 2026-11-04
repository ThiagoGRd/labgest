/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { Client } = require('pg')
assert.equal(process.env.LABGEST_TEST_DATABASE_URL, 'postgresql://labgest_archive_test:synthetic-only@127.0.0.1:5432/labgest_archive_test')
const client = new Client({ host: '127.0.0.1', port: 5432, user: 'labgest_archive_test', password: 'synthetic-only', database: 'labgest_archive_test', ssl: false })
;(async () => {
  await client.connect()
  try {
    const target = (await client.query('SELECT current_database() AS db, host(inet_server_addr()) AS host')).rows[0]
    assert.deepEqual(target, { db: 'labgest_archive_test', host: '127.0.0.1' })
    // CREATE DATABASE fails if a database already exists: never reset/reuse data.
    for (const name of ['labgest_finance_test', 'labgest_stock_test', 'labgest_external_link_test', 'labgest_identity_test']) await client.query(`CREATE DATABASE ${name}`)
  } finally { await client.end() }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
