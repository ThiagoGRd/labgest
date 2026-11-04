import assert from 'node:assert/strict'
import test from 'node:test'
import { dataCivilDoLaboratorio } from '../src/date-civil'

for (const [instant, expected] of [
  ['2027-01-01T02:59:59.999Z', '2026-12-31T00:00:00.000Z'],
  ['2027-01-01T03:00:00.000Z', '2027-01-01T00:00:00.000Z'],
  ['2028-03-01T02:59:59.999Z', '2028-02-29T00:00:00.000Z'],
]) test(`lab civil day for actual event ${instant}`, () => {
  assert.equal(dataCivilDoLaboratorio(new Date(instant)).toISOString(), expected)
})
