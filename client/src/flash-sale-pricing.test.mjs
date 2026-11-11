import test from 'node:test'
import assert from 'node:assert/strict'
import { priceStorefrontProducts, repriceCart } from './flash-sale-pricing.mjs'

test('cart prices follow active, edited and expired sales, including upgrades and quantities', () => {
  const inventory = [
    { id: 1, price: 1000000, oldPrice: 1200000, upgradeOptions: [{ options: [{ productId: 2 }, { productId: 3 }] }] },
    { id: 2, price: 100000, oldPrice: 100000 },
    { id: 3, price: 200000, oldPrice: 200000 },
  ]
  const sale = { productIds: [1, 3], prices: { 1: 800000, 3: 150000 }, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-02T00:00:00Z' }
  const cart = [{ id: 1, price: 1100000, oldPrice: 1300000, quantity: 2, cartKey: 'upgraded', name: 'PC RAM upgrade', upgrades: [{ groupIndex: 0, productId: 3 }] }, { id: 2, price: 100000, oldPrice: 100000, quantity: 1 }]
  const active = priceStorefrontProducts(inventory, sale, Date.parse(sale.startsAt))
  const priced = repriceCart(cart, active)
  assert.equal(priced[0].price, 850000)
  assert.equal(priced[0].quantity, 2)
  assert.equal(priced[0].cartKey, 'upgraded')
  assert.equal(priced[0].name, cart[0].name)
  assert.equal(priced[1], cart[1])
  assert.equal(repriceCart(priced, active), priced)
  assert.equal(repriceCart(priced, priceStorefrontProducts(inventory, sale, Date.parse(sale.endsAt)))[0].price, 1100000)
  assert.equal(cart[0].price, 1100000)
  assert.equal(inventory[0].price, 1000000)
})
