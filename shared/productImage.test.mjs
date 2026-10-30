import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PRODUCT_IMAGE, normalizeProductImage } from './productImage.mjs'

test('missing, null and blank image values use the local placeholder', () => {
  for (const image of [undefined, null, '', '   ']) assert.equal(normalizeProductImage(image), DEFAULT_PRODUCT_IMAGE)
})
test('the placeholder remains valid when editing an imported product', () => {
  assert.equal(normalizeProductImage(DEFAULT_PRODUCT_IMAGE), DEFAULT_PRODUCT_IMAGE)
})
test('real HTTP and HTTPS image URLs are preserved when adding images later', () => {
  for (const image of ['https://res.cloudinary.com/example/image/upload/test.jpg', 'http://example.test/product.png']) {
    assert.equal(normalizeProductImage(` ${image} `), image)
  }
})
test('supplied invalid image URLs still fail validation', () => {
  for (const image of ['not-a-url', '/not-allowed.svg', 'javascript:alert(1)', 'data:image/svg+xml,test', 'ftp://example.test/image.png']) {
    assert.throws(() => normalizeProductImage(image), /URL hình ảnh không hợp lệ/)
  }
  assert.throws(() => normalizeProductImage(`https://example.test/${'x'.repeat(500)}`), /URL hình ảnh không hợp lệ/)
})
