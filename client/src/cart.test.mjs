import assert from 'node:assert/strict'
import test from 'node:test'
import { cartItemKey, normalizeCart } from './cart.mjs'

const pc = { id: 10, upgradeOptions: [{ options: [{ productId: 1 }, { productId: 2 }] }, { options: [{ productId: 3 }, { productId: 4 }] }] }

test('cards, detail and default PC choices share one cart identity', () => {
  for (const item of [pc, { ...pc, cartKey: '10:', upgrades: [] }, { ...pc, cartKey: '10:0-1|1-3', upgrades: [{ groupIndex: 0, productId: 1 }, { groupIndex: 1, productId: 3 }] }]) {
    assert.equal(cartItemKey(item), '10')
  }
})

test('upgraded configurations stay separate and choice order does not change their identity', () => {
  const a = { ...pc, upgrades: [{ groupIndex: 1, productId: 4 }, { groupIndex: 0, productId: 2 }] }
  assert.equal(cartItemKey(a), '10:0-2|1-4')
  assert.equal(cartItemKey(a), cartItemKey({ ...a, upgrades: [...a.upgrades].reverse() }))
  assert.notEqual(cartItemKey(a), cartItemKey(pc))
  assert.notEqual(cartItemKey(a), cartItemKey({ ...pc, upgrades: [{ groupIndex: 0, productId: 2 }] }))
  assert.equal(cartItemKey({ id: 10, cartKey: '10-upgrade' }), '10-upgrade')
})

test('loading a saved cart merges legacy duplicate base rows while retaining upgrades and quantities', () => {
  const saved = [{ ...pc, quantity: 2 }, { ...pc, cartKey: '10:', upgrades: [], quantity: 3 }, { ...pc, upgrades: [{ groupIndex: 0, productId: 2 }], quantity: 1 }]
  const result = normalizeCart(saved)
  assert.equal(result.length, 2)
  assert.equal(result[0].quantity, 5)
  assert.equal(result[1].quantity, 1)
  assert.equal(saved[0].quantity, 2)
  assert.deepEqual(normalizeCart(result), result)
  assert.deepEqual(normalizeCart(null), [])
})
