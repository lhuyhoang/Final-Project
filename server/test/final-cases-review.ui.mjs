import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import path from 'node:path'
import os from 'node:os'
import { readFile } from 'node:fs/promises'

export async function runFinalCaseUI({ base, admin, customer, password, product, out, one, results }) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  let ip = 40, offline = false
  const app = 'http://127.0.0.1:5173'
  const faults = []
  page.on('pageerror', error => faults.push(error.message))
  await page.route('**/api/**', async route => {
    if (offline) return route.abort('connectionfailed')
    const req = route.request(), url = new URL(req.url())
    const response = await fetch(base + url.pathname + url.search, { method: req.method(), redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${ip}`, ...(req.headers().cookie ? { cookie: req.headers().cookie } : {}) }, ...(req.postData() ? { body: req.postData() } : {}) })
    const headers = { 'content-type': response.headers.get('content-type') || 'application/json', ...(response.headers.get('set-cookie') ? { 'set-cookie': response.headers.get('set-cookie') } : {}) }
    await route.fulfill({ status: response.status, headers, body: await response.text() })
  })
  const go = async route => { await page.goto(app + route); await page.locator('.session-restore-screen').waitFor({ state: 'detached' }) }
  async function login(user) {
    await go('/')
    await page.locator('.account-trigger').click()
    await page.locator('.auth-modal input[name=email]').fill(user.email)
    await page.locator('.auth-modal input[name=password]').fill(password)
    await page.locator('.auth-submit').click()
    await page.locator('.auth-modal').waitFor({ state: 'detached' })
  }
  async function check(ids, work) {
    ip += 1
    try { await work(); results.push({ ids, result: 'ui-verified' }); console.log('UI VERIFIED', ids.join(', ')) }
    catch (error) {
      const filename = 'quadpro-review-' + ids[0] + '.png'
      await page.screenshot({ path: path.join(os.tmpdir(), filename), fullPage: true }).catch(() => {})
      results.push({ ids, result: 'ui-observation', detail: error.message, screenshot: filename })
      console.log('UI OBSERVATION', ids.join(', '), error.message.split('\n')[0])
    }
  }
  try {
    await check(['AUTH-01', 'SEC-01'], async () => {
      await go('/'); await page.locator('.account-trigger').click(); await page.locator('.auth-modal').waitFor()
      assert.equal(await page.locator('.account-panel').count(), 0)
      await page.locator('.auth-close').click()
      for (const route of ['/account', '/admin', '/checkout']) { await go(route); await page.locator('.auth-modal').waitFor(); assert.equal(await page.locator('.admin-shell, .account-page, .checkout-page').count(), 0) }
    })
    await check(['AUTH-04', 'AUTH-08', 'ACC-01'], async () => {
      await login(customer)
      assert.equal(new URL(page.url()).pathname, '/')
      assert.ok((await page.locator('.account-trigger').innerText()).includes('Thành viên'))
      await page.reload(); await page.locator('.account-trigger').filter({ hasText: 'Thành viên' }).waitFor()
      await go('/admin'); assert.equal(new URL(page.url()).pathname, '/'); assert.equal(await page.locator('.admin-shell').count(), 0)
      await go('/account'); await page.locator('.account-form').waitFor()
      assert.equal(await page.locator('.account-form input[name=email]').inputValue(), customer.email)
      const cookies = await context.cookies(); assert.equal(cookies.find(item => item.name === 'quadpro_session')?.httpOnly, true)
    })
    await check(['PRD-01', 'PRD-03', 'PRD-04'], async () => {
      await go('/'); await page.getByRole('searchbox', { name: 'Tìm kiếm trong danh sách sản phẩm', exact: true }).fill('Review Laptop ASUS')
      await page.locator('.product-card').first().waitFor()
      assert.ok((await page.locator('.product-name-link').allTextContents()).every(name => name.includes('Review Laptop ASUS')))
      await page.getByRole('searchbox', { name: 'Tìm kiếm trong danh sách sản phẩm', exact: true }).fill('ZZZ_NO_PRODUCT_REVIEW')
      await page.getByText('Không tìm thấy sản phẩm', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Xem tất cả sản phẩm', exact: true }).click()
      assert.ok(await page.locator('.product-card').count() > 0)
    })
    await check(['PRD-05', 'PRD-06', 'PRD-07'], async () => {
      const media = page.locator('.product-media').last()
      await media.hover(); await page.locator('.product-quick-view').waitFor()
      const box = await page.locator('.product-quick-view').boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= 1440)
      await page.locator('.site-header .logo').hover(); await page.locator('.product-quick-view').waitFor({ state: 'detached' })
      await media.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
      await page.locator('.product-quick-view').waitFor(); await page.keyboard.press('Escape'); await page.locator('.product-quick-view').waitFor({ state: 'detached' })
    })
    await check(['PRD-08', 'PRD-12', 'PRD-14'], async () => {
      await go('/')
      const button = page.locator('.product-name-link').filter({ hasText: product.name }).first()
      await button.click(); await page.locator('#product-title').waitFor()
      assert.ok(new URL(page.url()).pathname.startsWith(`/products/${product.id}-`))
      const relatedCount = await page.locator('.related-product-card').count()
      assert.ok(relatedCount > 0 && relatedCount <= 4)
      await page.goBack(); await page.locator('.products-section').waitFor(); assert.equal(new URL(page.url()).pathname, '/')
      await page.goForward(); await page.locator('#product-title').waitFor()
    })
    await check(['PRD-09', 'CART-05', 'PRD-10'], async () => {
      await go('/products/' + out.id); await page.locator('#product-title').waitFor()
      assert.equal(await page.locator('.detail-add-cart').isDisabled(), true)
      assert.equal(await page.locator('.detail-buy-now').isDisabled(), true)
      await go('/products/' + one.id); await page.locator('#product-title').waitFor()
      assert.equal(await page.getByRole('button', { name: 'Giảm số lượng', exact: true }).isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: 'Tăng số lượng', exact: true }).isDisabled(), true)
    })
    await check(['PRD-11'], async () => {
      await go('/products/99999'); await page.getByRole('heading', { name: 'Không tìm thấy sản phẩm', exact: true }).waitFor()
    })
    await check(['CART-01', 'CART-02', 'CART-06', 'CART-07', 'CART-08', 'CART-09'], async () => {
      await go('/'); await page.evaluate(() => localStorage.removeItem('quadpro-cart')); await page.reload()
      const add = page.getByRole('button', { name: `Thêm ${product.name} vào giỏ`, exact: true }).first()
      await add.click(); await add.click(); await page.locator('.cart-trigger').click()
      assert.equal(await page.locator('.cart-item').count(), 1)
      assert.equal(await page.locator('.cart-item .quantity span').innerText(), '2')
      await page.locator('.cart-item .quantity button').last().click(); assert.equal(await page.locator('.cart-item .quantity span').innerText(), '3')
      await page.reload(); await page.locator('.cart-trigger').click(); assert.equal(await page.locator('.cart-item .quantity span').innerText(), '3')
      await page.locator('.cart-item .remove').click(); assert.equal(await page.locator('.cart-item').count(), 0)
      await page.locator('.drawer-header button').click(); await add.click(); await page.locator('.cart-trigger').click()
      await page.locator('.cart-item .quantity button').first().click(); assert.equal(await page.locator('.cart-item').count(), 0)
    })
    await check(['CART-03', 'CART-04', 'CART-02-cross-page'], async () => {
      await go('/products/' + product.id); await page.locator('#product-title').waitFor()
      await page.getByRole('button', { name: 'Tăng số lượng', exact: true }).click(); await page.getByRole('button', { name: 'Tăng số lượng', exact: true }).click()
      await page.locator('.detail-buy-now').click(); await page.locator('.cart-drawer.open').waitFor()
      assert.equal(await page.locator('.cart-item .quantity span').innerText(), '3')
      await page.locator('.drawer-header button').click(); await go('/')
      await page.getByRole('button', { name: `Thêm ${product.name} vào giỏ`, exact: true }).first().click()
      await page.locator('.cart-trigger').click()
      const rows = await page.locator('.cart-item').count()
      results.push({ ids: ['CART-02'], result: rows === 1 ? 'ui-verified' : 'confirmed-gap', detail: `Adding the same base product from detail then product card creates ${rows} rows.` })
    })
    await check(['CHK-02', 'CHK-03', 'CHK-04', 'CHK-05', 'ACC-06', 'CHK-09'], async () => {
      await page.locator('.cart-summary > button').click(); await page.locator('#checkout-name').waitFor()
      assert.equal(await page.locator('#checkout-phone').inputValue(), '0912345678')
      assert.ok((await page.locator('#checkout-address').inputValue()).includes('123 Updated Street'))
      await page.locator('#checkout-name').fill('')
      await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
      await page.locator('#checkout-name-error').waitFor()
      assert.equal(await page.locator('.checkout-form').getAttribute('novalidate'), '')
      await page.locator('#checkout-name').fill('Review Recipient')
      await page.locator('#checkout-phone').fill('12345'); await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click(); await page.locator('#checkout-phone-error').waitFor()
      await page.locator('#checkout-phone').fill('+84912345678'); await page.locator('#checkout-address').fill('short'); await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click(); await page.locator('#checkout-address-error').waitFor()
      await page.locator('#checkout-address').fill('123 Test Street'); await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
      assert.equal(await page.locator('input[name=paymentMethod]:checked').inputValue(), 'cod')
      await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
      let count = 0
      const listener = req => { if (req.url().endsWith('/api/orders') && req.method() === 'POST') count++ }
      page.on('request', listener)
      await page.getByRole('button', { name: 'Xác nhận đặt hàng', exact: true }).evaluate(button => { button.click(); button.click() })
      await page.locator('.toast').filter({ hasText: 'Đặt hàng thành công' }).waitFor()
      page.off('request', listener); assert.equal(count, 1)
    })
    await check(['SEC-09', 'SEC-10', 'PRD-13'], async () => {
      await page.setViewportSize({ width: 375, height: 812 }); await go('/')
      await page.locator('.theme-toggle').click()
      const theme = await page.locator('html').getAttribute('data-theme'); await page.reload()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.locator('.mobile-menu').click(); await page.locator('nav.nav-open').waitFor()
      await go('/')
      await page.getByRole('button', { name: `Thêm ${product.name} vào giỏ`, exact: true }).first().click()
      await page.locator('.cart-trigger').click()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.locator('.cart-summary > button').click(); await page.locator('#checkout-name').waitFor()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await go('/categories/laptop'); await page.locator('.catalog-toolbar').waitFor()
      await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click(); await page.locator('.catalog-filters.open').waitFor()
      const filter = page.locator('.catalog-filters input[type=checkbox]').first(); await filter.check(); assert.equal(await filter.isChecked(), true)
      await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click(); assert.equal(await filter.isChecked(), false)
      await page.locator('.catalog-filters').getByRole('button', { name: 'Đóng bộ lọc', exact: true }).click()
      await page.locator('.catalog-toolbar select').selectOption('price-asc')
      const prices = await page.locator('.catalog-product-grid .price-row strong').allTextContents()
      const values = prices.map(value => Number(value.replace(/\D/g, '')))
      assert.deepEqual(values, [...values].sort((a, b) => a - b))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await check(['AUTH-07', 'AUTH-06'], async () => {
      await go('/account'); await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
      await page.locator('.account-trigger').filter({ hasText: 'Đăng nhập' }).waitFor()
      await login(admin); await page.locator('.admin-shell').waitFor(); assert.equal(new URL(page.url()).pathname, '/admin')
      await page.reload(); await page.locator('.admin-shell').waitFor()
    })
    await check(['APRD-02', 'AORD-01', 'AORD-05', 'AORD-07', 'AORD-10'], async () => {
      assert.equal(await page.locator('.admin-sidebar nav button').filter({ hasText: 'Thanh toán' }).count(), 1)
      assert.equal(await page.locator('.admin-sidebar nav button').filter({ hasText: 'Stripe Sandbox' }).count(), 0)
      await page.locator('.admin-sidebar nav button').filter({ hasText: 'Đơn hàng' }).click(); await page.locator('.status-select').first().waitFor()
      assert.ok(await page.locator('.status-select:disabled').count() > 0)
      await page.locator('.admin-sidebar nav button').filter({ hasText: 'Thanh toán' }).click(); await page.locator('.stripe-dashboard-error').waitFor()
      await page.locator('.admin-sidebar nav button').filter({ hasText: 'Sản phẩm' }).click(); await page.locator('.product-folder-browser').waitFor()
    })
    await check(['APRD-03', 'APRD-08', 'APRD-09'], async () => {
      await page.locator('.product-folder-card').filter({ hasText: 'Laptop' }).first().click()
      await page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click()
      const editor = page.locator('.product-editor')
      await editor.locator('select[name=category]').selectOption(product.category)
      await editor.locator('input[name=name]').fill('Review UI created')
      await editor.locator('input[name=brand]').fill('asus')
      await editor.locator('input[name=price]').fill('8000000')
      await editor.locator('input[name=oldPrice]').fill('10000000')
      await editor.locator('input[name=stock]').fill('3')
      let uploadCount = 0
      const jpg = await readFile(new URL('../../client/public/images/banners/build-pc-gaming.jpg', import.meta.url))
      await page.route('https://api.cloudinary.com/**', route => { uploadCount++; return route.fulfill({ json: { secure_url: 'https://assets.example.test/review.jpg' } }) })
      await page.route('https://assets.example.test/review.jpg', route => route.fulfill({ contentType: 'image/jpeg', body: jpg }))
      const input = editor.locator('input[type=file]')
      await input.setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not an image') })
      await editor.getByRole('alert').waitFor(); assert.equal(uploadCount, 0)
      await input.setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
      await editor.getByRole('alert').filter({ hasText: '10 MB' }).waitFor(); assert.equal(uploadCount, 0)
      await input.setInputFiles({ name: 'valid.jpg', mimeType: 'image/jpeg', buffer: jpg })
      await page.waitForFunction(() => document.querySelector('.product-editor input[name=image]')?.value === 'https://assets.example.test/review.jpg')
      assert.equal(uploadCount, 1)
      await editor.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click()
      await editor.waitFor({ state: 'detached' }); await page.locator('.admin-notice').waitFor()
      const names = await page.locator('.products-table .admin-product-cell b').allTextContents()
      assert.ok(names.includes('Review UI created'), 'Created product appears in its selected category')
      results.push({ ids: ['APRD-03'], result: names[0] === 'Review UI created' ? 'ui-verified' : 'confirmed-gap', detail: `New product position after dashboard reload: ${names.indexOf('Review UI created') + 1}; expected first row.` })
    })
    await check(['STR-05', 'CHK-01'], async () => {
      await context.clearCookies()
      let cancellations = 0
      page.on('request', req => { if (req.method() === 'POST' && req.url().includes('/cancel')) cancellations++ })
      await go('/checkout?payment=stripe-cancelled&order_id=QP1234567890')
      await page.locator('.auth-modal').waitFor(); assert.equal(cancellations, 0)
      assert.ok((await page.locator('.toast').innerText()).includes('hủy thanh toán Stripe'))
      await go('/'); await page.getByRole('button', { name: `Thêm ${product.name} vào giỏ`, exact: true }).first().click()
      await page.locator('.cart-trigger').click(); await page.locator('.cart-summary > button').click()
      await page.locator('.auth-modal').waitFor(); assert.equal(await page.locator('.checkout-page').count(), 0)
    })
    await check(['PRD-02'], async () => {
      await context.clearCookies(); offline = true; await go('/'); await page.locator('.product-card').first().waitFor()
      await page.locator('.product-name-link').first().click(); await page.locator('#product-title').waitFor()
      await page.locator('.detail-add-cart').click(); assert.ok((await page.locator('.toast').innerText()).includes('Đã thêm'))
      offline = false; await go('/'); await page.locator('.product-name-link').filter({ hasText: product.name }).first().waitFor()
    })
    if (faults.length) results.push({ ids: ['UI-runtime'], result: 'ui-observation', detail: faults.join('; ') })
  } finally { await browser.close() }
}
