import assert from 'node:assert/strict'
import test from 'node:test'
import { readSheet } from 'read-excel-file/node'
import { loadPcSelection, mergePcBuildCart, resolvePcSelection } from './pc-builder.mjs'
import { createBuildWorkbook } from './pc-builder-export.mjs'

const categories = [
  { id: 1, name: 'Linh kiện điện tử', parentId: null },
  { id: 2, name: 'CPU', parentId: 1 },
  { id: 3, name: 'RAM', parentId: 1 },
  { id: 4, name: 'DDR5', parentId: 3 },
]
const products = [
  { id: 10, name: 'CPU & <Intel>', category: 'CPU', price: 4000000, oldPrice: 5000000, stock: 3 },
  { id: 11, name: 'RAM = 16GB', category: 'DDR5', price: 1000000, oldPrice: 1200000, stock: 4 },
]
const selection = [{ slotId: 'cpu', productId: 10, quantity: 1 }, { slotId: 'ram', productId: 11, quantity: 2 }]

test('uses current inventory prices, quantities and nested categories, in slot order', () => {
  const build = resolvePcSelection([...selection].reverse(), products, categories)
  assert.equal(build.price, 6000000)
  assert.equal(build.oldPrice, 7400000)
  assert.equal(build.savings, 1400000)
  assert.deepEqual(build.rows.map(row => row.slotId), ['cpu', 'ram'])
})

test('blocks stale, miscategorized, unavailable and invalid component selections', () => {
  assert.throws(() => resolvePcSelection([], products, categories), /ít nhất/)
  assert.throws(() => resolvePcSelection([{ ...selection[0], productId: 999 }], products, categories), /không còn trong kho/)
  assert.throws(() => resolvePcSelection([{ ...selection[0], productId: 11 }], products, categories), /không còn thuộc nhóm/)
  assert.throws(() => resolvePcSelection([{ ...selection[0], quantity: 4 }], products, categories), /chỉ còn 3/)
  assert.throws(() => resolvePcSelection([{ ...selection[0], quantity: '' }], products, categories), /Số lượng/)
  assert.throws(() => resolvePcSelection([selection[0], selection[0]], products, categories), /một sản phẩm/)
})

test('restores only valid draft identifiers, without trusting cached prices', () => {
  const storage = { getItem: () => JSON.stringify([selection[0], selection[0], { ...selection[1], price: 1 }, { slotId: 'other', productId: 10, quantity: 1 }, { ...selection[1], quantity: -1 }]) }
  assert.deepEqual(loadPcSelection(storage), selection)
  assert.deepEqual(loadPcSelection({ getItem: () => '{bad json' }), [])
  assert.deepEqual(loadPcSelection({ getItem: () => { throw new Error('denied') } }), [])
})

test('adds exact quantities and leaves the entire cart untouched if any stock check fails', () => {
  const rows = resolvePcSelection(selection, products, categories).rows
  const cart = [{ ...products[0], quantity: 1 }]
  const merged = mergePcBuildCart(cart, rows)
  assert.deepEqual(merged.map(item => item.quantity), [2, 2])
  assert.equal(cart[0].quantity, 1)
  const full = [{ ...products[1], quantity: 4 }]
  assert.throws(() => mergePcBuildCart(full, rows), /giỏ hàng đã có 4/)
  assert.deepEqual(full, [{ ...products[1], quantity: 4 }])
})

test('counts upgraded cart lines toward the same inventory stock without merging variants', () => {
  const rows = resolvePcSelection(selection, products, categories).rows
  const cart = [{ ...products[0], cartKey: '10-upgrade', quantity: 2 }]
  const merged = mergePcBuildCart(cart, [rows[0]])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].cartKey, '10-upgrade')
  assert.throws(() => mergePcBuildCart(merged, [rows[0]]), /chỉ còn 3/)
})

test('exports a readable XLSX with Unicode, escaped names, numeric quantities and totals', async () => {
  const build = resolvePcSelection(selection, products, categories)
  const file = await createBuildWorkbook(build)
  const rows = await readSheet(Buffer.from(file))
  assert.equal(rows[0][0], 'QUADPRO - CẤU HÌNH PC')
  assert.equal(rows[2][2], 'CPU & <Intel>')
  assert.equal(rows[3][2], 'RAM = 16GB')
  assert.equal(rows[3][3], 2)
  assert.equal(rows[3][6], 2000000)
  assert.equal(rows.at(-1)[6], 6000000)
})
