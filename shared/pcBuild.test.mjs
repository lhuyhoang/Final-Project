import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePcBuild, getBuildCategoryScope, isPcBuildCategory, normalizePcComponents, validatePcBuild } from './pcBuild.mjs'

const categories = [
  { id: 1, name: 'PC', parentId: null },
  { id: 2, name: 'PC Gaming', parentId: 1 },
  { id: 3, name: 'Linh kiện điện tử', parentId: null },
  { id: 4, name: 'CPU', parentId: 3 },
  { id: 5, name: 'RAM', parentId: 3 },
  { id: 6, name: 'DDR5', parentId: 5 },
  { id: 7, name: 'Màn hình', parentId: null },
  { id: 8, name: 'Màn hình Gaming', parentId: 7 },
]
const products = [
  { id: 10, name: 'CPU test', category: 'CPU', price: 4000000, oldPrice: 5000000, stock: 10 },
  { id: 11, name: 'RAM test', category: 'DDR5', price: 1000000, oldPrice: 1200000, stock: 3 },
  { id: 12, name: 'Monitor test', category: 'Màn hình Gaming', price: 2000000, oldPrice: 2200000, stock: 5 },
]
const components = [
  { slotId: 'cpu', categoryId: 4, productId: 10, quantity: 1, warranty: '36 tháng' },
  { slotId: 'ram', categoryId: 5, productId: 11, quantity: 2, warranty: '36 tháng' },
]

test('sums sale and list prices with component quantities and produces specification rows', () => {
  const totals = validatePcBuild(normalizePcComponents(components), products, categories, 'PC Gaming')
  assert.equal(totals.price, 6000000)
  assert.equal(totals.oldPrice, 7400000)
  assert.equal(totals.savings, 1400000)
  assert.deepEqual(totals.specifications[1], { description: 'RAM test', quantity: 2, warranty: '36 tháng' })
})
test('recalculates from current inventory prices instead of component payload prices', () => {
  const updated = products.map(product => product.id === 11 ? { ...product, price: 1100000 } : product)
  const totals = calculatePcBuild(components.map(item => ({ ...item, price: 1 })), updated)
  assert.equal(totals.price, 6200000)
})
test('keeps only inventory references when normalizing a saved build', () => {
  assert.deepEqual(normalizePcComponents(components.map(item => ({ ...item, price: 1, name: 'Forged' }))), components)
  assert.throws(() => normalizePcComponents([...components, components[0]]), /trùng/)
  assert.throws(() => normalizePcComponents([{ ...components[0], quantity: 0 }]), /Số lượng/)
  assert.throws(() => normalizePcComponents([{ ...components[0], productId: -1 }]), /không hợp lệ/)
})
test('accepts descendants of PC and monitor categories', () => {
  assert.equal(isPcBuildCategory('PC Gaming', categories), true)
  assert.equal(isPcBuildCategory('CPU', categories), false)
  assert.equal(getBuildCategoryScope(5, categories).has('ddr5'), true)
  const monitor = { slotId: 'monitor', categoryId: 7, productId: 12, quantity: 1, warranty: '' }
  assert.equal(validatePcBuild([monitor], products, categories, 'PC Gaming').price, 2000000)
})
test('rejects mismatched categories, missing inventory, non-PC products and self references', () => {
  assert.throws(() => validatePcBuild([{ ...components[0], categoryId: 5 }], products, categories, 'PC Gaming'), /không thuộc/)
  assert.throws(() => validatePcBuild([{ ...components[0], productId: 999 }], products, categories, 'PC Gaming'), /không còn/)
  assert.throws(() => validatePcBuild(components, products, categories, 'CPU'), /danh mục cha PC/)
  assert.throws(() => validatePcBuild(components, products, categories, 'PC Gaming', 10), /trùng với PC/)
})
test('rejects insufficient stock including the same product selected in multiple slots', () => {
  assert.throws(() => validatePcBuild([{ ...components[1], quantity: 4 }], products, categories, 'PC Gaming'), /chỉ còn/)
  const repeated = [components[1], { ...components[1], slotId: 'storage' }]
  assert.throws(() => validatePcBuild(repeated, products, categories, 'PC Gaming'), /chỉ còn/)
})
test('legacy products with no build components retain an empty recipe', () => {
  assert.deepEqual(normalizePcComponents([]), [])
  assert.deepEqual(calculatePcBuild([], products), { price: 0, oldPrice: 0, savings: 0, specifications: [] })
})
