import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProductFolders, getProductFolderPath } from './product-folders.js'

const categories = [
  { id: 1, name: 'PC', parentId: null },
  { id: 2, name: 'PC Gaming', parentId: 1 },
  { id: 3, name: 'PC văn phòng', parentId: 1 },
  { id: 4, name: 'PC Intel', parentId: 2 },
  { id: 5, name: 'PC Workstation', parentId: 1 },
  { id: 6, name: 'Laptop', parentId: null },
]
const products = [
  { id: 10, name: 'PC trực tiếp', category: 'PC' },
  { id: 11, name: 'Gaming PC', category: 'PC Gaming' },
  { id: 12, name: 'Office PC', category: 'PC văn phòng' },
  { id: 13, name: 'Intel PC', category: 'PC Intel' },
  { id: 14, name: 'Laptop test', category: 'Laptop' },
]

test('keeps products in their exact category while summing counts in ancestor folders', () => {
  const folders = buildProductFolders(categories, products)
  const root = folders.find(folder => folder.id === 'category:1')
  const gaming = folders.find(folder => folder.id === 'category:2')
  assert.deepEqual(root.products.map(product => product.id), [10])
  assert.deepEqual(root.allProducts.map(product => product.id), [10, 11, 12, 13])
  assert.deepEqual(gaming.products.map(product => product.id), [11])
  assert.deepEqual(gaming.allProducts.map(product => product.id), [11, 13])
  assert.deepEqual(folders.filter(folder => folder.parentFolderId === root.id).map(folder => folder.name).sort(), ['PC Gaming', 'PC Workstation', 'PC văn phòng'].sort())
})

test('builds nested breadcrumb paths and retains empty child folders', () => {
  const folders = buildProductFolders(categories, products)
  assert.deepEqual(getProductFolderPath('category:4', folders).map(folder => folder.name), ['PC', 'PC Gaming', 'PC Intel'])
  assert.deepEqual(getProductFolderPath(null, folders), [])
  assert.deepEqual(folders.find(folder => folder.id === 'category:5').products, [])
})

test('keeps unrecognized products accessible and treats orphan categories as root folders', () => {
  const folders = buildProductFolders([...categories, { id: 7, name: 'Orphan', parentId: 999 }], [...products, { id: 99, category: 'Unknown' }])
  assert.equal(folders.find(folder => folder.id === 'category:7').parentFolderId, null)
  assert.deepEqual(folders.find(folder => folder.id === 'uncategorized').products.map(product => product.id), [99])
})

test('automatically updates folders after recategorization and supports case-insensitive Vietnamese names', () => {
  const changedProducts = products.map(product => product.id === 11 ? { ...product, category: 'PC VĂN PHÒNG' } : product)
  const folders = buildProductFolders(categories, changedProducts)
  assert.equal(folders.find(folder => folder.id === 'category:2').products.length, 0)
  assert.deepEqual(folders.find(folder => folder.id === 'category:3').products.map(product => product.id), [11, 12])
  assert.deepEqual(products.map(product => product.category), ['PC', 'PC Gaming', 'PC văn phòng', 'PC Intel', 'Laptop'])
})
