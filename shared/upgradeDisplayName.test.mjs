import assert from 'node:assert/strict'
import test from 'node:test'
import { getUpgradeDisplayName } from './upgradeDisplayName.mjs'

test('uses the admin label while keeping the linked inventory product unchanged', () => {
  const product = { id: 10, name: 'Ram SSTC 16GB DDR4 3200MHz AMD/Intel (U3200A-C22)', price: 500000 }
  const option = { productId: 10, name: '  RAM 16GB DDR4  ' }
  assert.equal(getUpgradeDisplayName(option, product), 'RAM 16GB DDR4')
  assert.equal(product.name, 'Ram SSTC 16GB DDR4 3200MHz AMD/Intel (U3200A-C22)')
  assert.equal(option.productId, product.id)
  assert.equal(product.price, 500000)
})

test('keeps legacy labels and falls back to inventory names for older records', () => {
  assert.equal(getUpgradeDisplayName('RAM 32GB DDR5'), 'RAM 32GB DDR5')
  assert.equal(getUpgradeDisplayName({ productId: 10 }, { name: 'RAM gốc' }), 'RAM gốc')
  assert.equal(getUpgradeDisplayName({ name: '   ' }, { name: 'RAM gốc' }), 'RAM gốc')
  assert.equal(getUpgradeDisplayName(null), 'Lựa chọn nâng cấp')
})
