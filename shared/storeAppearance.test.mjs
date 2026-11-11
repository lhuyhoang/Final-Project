import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultStoreAppearance, normalizeAppearanceImage, normalizeStoreAppearance, readStoreAppearance } from './storeAppearance.mjs'
import { canAccessAdminEndpoint } from './adminAccess.mjs'

test('preserves supplied logo and original banners, supports partial edits and empty banner lists', () => {
  assert.deepEqual(normalizeStoreAppearance(), defaultStoreAppearance)
  const changed = normalizeStoreAppearance({ logoUrl: 'https://res.cloudinary.com/test/image/upload/new.png' })
  assert.deepEqual(changed.banners, defaultStoreAppearance.banners)
  assert.equal(normalizeStoreAppearance({ hoverEffect: 'none' }, changed).logoUrl, changed.logoUrl)
  assert.deepEqual(normalizeStoreAppearance({ banners: [] }).banners, [])
  assert.equal(normalizeStoreAppearance({ logoUrl: '' }, changed).logoUrl, defaultStoreAppearance.logoUrl)
  assert.deepEqual(readStoreAppearance({ store_appearance: { value: JSON.stringify(changed) } }), changed)
  assert.deepEqual(readStoreAppearance({}), defaultStoreAppearance)
  assert.deepEqual(readStoreAppearance({ store_appearance: { value: '{invalid' } }), defaultStoreAppearance)
})

test('validates image destinations, banner limits, hover selection and durations', () => {
  assert.equal(normalizeAppearanceImage('/images/brand/quadpro-logo.png'), '/images/brand/quadpro-logo.png')
  for (const logoUrl of ['javascript:alert(1)', '//evil.example/logo.png', 'data:image/png;base64,x', 'https://user:pass@example.com/a.png', 'http://example.com/a.png', '/images/../index.html', '/images/%2e%2e/index.html', '/images/%00logo.png', '/images/%ZZlogo.png', 'https://example.com/a\nb.png']) assert.throws(() => normalizeStoreAppearance({ logoUrl }))
  for (const body of [{ banners: Array(13).fill(defaultStoreAppearance.banners[0]) }, { banners: [{ image: '', label: 'Missing image' }] }, { banners: [{ image: '/images/a.png', label: 'x'.repeat(121) }] }, { hoverEffect: 'unknown' }, { hoverDurationMs: 0 }, { hoverDurationMs: 1201 }, { bannerIntervalSeconds: 1 }, { bannerIntervalSeconds: 61 }, { bannerIntervalSeconds: 2.5 }]) assert.throws(() => normalizeStoreAppearance(body))
  assert.throws(() => normalizeStoreAppearance(null))
})

test('banner destinations persist independently and older banners without links remain valid', () => {
  const banner = defaultStoreAppearance.banners[0]
  for (const href of ['', '/build-pc', '/products/165?campaign=banner#details', 'https://example.com/sale?from=banner']) {
    const saved = normalizeStoreAppearance({ banners: [{ ...banner, href }] })
    assert.equal(saved.banners[0].href, href)
    assert.deepEqual(readStoreAppearance({ store_appearance: { value: JSON.stringify(saved) } }), saved)
    assert.equal(normalizeStoreAppearance({ hoverEffect: 'lift' }, saved).banners[0].href, href)
  }
  assert.equal(normalizeStoreAppearance({ banners: [{ image: banner.image, label: banner.label }] }).banners[0].href, '')
  assert.equal(normalizeStoreAppearance({ banners: [{ ...banner, href: '#products' }] }).banners[0].href, '/#products')
  assert.equal(normalizeStoreAppearance({ banners: [{ ...banner, href: '?category=RAM' }] }).banners[0].href, '/?category=RAM')
})

test('rejects unsafe and malformed banner destinations', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', '/%5cevil.example', 'https://user:pass@example.com', 'http://example.com', 'ftp://example.com', 'example.com', 'https:example.com', '/%ZZ', 'https://example.com/a\nb', '/%0afoo', 'https://example.com/' + 'a'.repeat(2000)]) {
    assert.throws(() => normalizeStoreAppearance({ banners: [{ ...defaultStoreAppearance.banners[0], href }] }), /Đường dẫn banner/)
  }
})

test('existing settings permission controls all appearance changes without granting inventory access', () => {
  const staff = permissions => ({ role: 'staff', permissions })
  for (const method of ['GET', 'PATCH']) {
    assert.equal(canAccessAdminEndpoint(staff(['settings']), method, '/appearance'), true)
    assert.equal(canAccessAdminEndpoint(staff(['inventory']), method, '/appearance'), false)
  }
  assert.equal(canAccessAdminEndpoint(staff(['settings']), 'PUT', '/products/1'), false)
})
