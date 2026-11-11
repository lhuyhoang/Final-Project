import assert from 'node:assert/strict'

export async function testFlashSalePrices({ db, request, write, customer, fake }) {
  const pc = await db.createProduct({ name: 'Sale price PC', category: 'PC Gaming', brand: 'Test', price: 1000000, oldPrice: 1200000, stock: 100 })
  const base = await db.createProduct({ name: 'Sale base RAM', category: 'RAM', brand: 'Test', price: 100000, stock: 100 })
  const upgrade = await db.createProduct({ name: 'Sale upgrade RAM', category: 'RAM', brand: 'Test', price: 200000, stock: 100 })
  const sale = { productIds: [pc.id, base.id], prices: { [pc.id]: 800000 }, startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() }
  const save = value => write('/api/admin/promotions/flash-sale', value)
  assert.equal((await save(sale)).status, 200)
  assert.deepEqual((await request('/api/settings')).data.flashSale.prices, sale.prices)
  for (const prices of [{ [pc.id]: 1000001 }, { [pc.id]: -1 }, { [pc.id]: 1.5 }, { [upgrade.id]: 50000 }]) assert.equal((await save({ ...sale, prices })).status, 400)
  assert.deepEqual((await request('/api/settings')).data.flashSale.prices, sale.prices)
  const checkout = { items: [{ productId: pc.id, quantity: 2, expectedPrice: 800000 }, { productId: base.id, quantity: 1, expectedPrice: 100000 }], customer: { name: 'Sale Customer', phone: '0901234567' }, shipping: { address: '123 Sale Test Street' } }
  for (const method of ['cod', 'stripe', 'vnpay']) {
    const path = method === 'cod' ? '/api/orders' : `/api/payments/${method}/checkout`
    const result = await request(path, { cookie: customer, method: 'POST', body: checkout })
    assert.equal(result.status, 201)
    const order = method === 'cod' ? result.data : await db.findOrderById(result.data.orderId)
    assert.equal(order.total, 1700000)
    assert.equal(order.items[0].price, 800000)
    if (method === 'stripe') assert.equal(fake.sessions.at(-1).line_items[0].price_data.unit_amount, 800000)
    if (method === 'vnpay') assert.equal(Number(new URL(result.data.paymentUrl).searchParams.get('vnp_Amount')), 170000000)
  }
  assert.equal((await db.findProductById(pc.id)).price, 1000000, 'Sale leaves inventory price intact')
  await save({ ...sale, prices: { [pc.id]: 700000 } })
  const stock = (await db.findProductById(pc.id)).stock
  const changed = await request('/api/orders', { cookie: customer, method: 'POST', body: checkout })
  assert.equal(changed.status, 409)
  assert.equal(changed.data.code, 'PRODUCT_PRICE_CHANGED')
  assert.equal((await db.findProductById(pc.id)).stock, stock)
  await save({ ...sale, endsAt: new Date(Date.now() - 1000).toISOString() })
  assert.equal((await request('/api/orders', { cookie: customer, method: 'POST', body: checkout })).status, 409, 'Expired price requires confirmation of regular price')
  const regular = await request('/api/orders', { cookie: customer, method: 'POST', body: { ...checkout, items: [{ productId: pc.id, quantity: 1, expectedPrice: 1000000 }] } })
  assert.equal(regular.status, 201)
  assert.equal(regular.data.total, 1000000)
  await db.updateProduct(pc.id, { upgradeOptions: [{ name: 'RAM', options: [{ productId: base.id, name: '16GB' }, { productId: upgrade.id, name: '32GB' }] }] })
  await save({ ...sale, productIds: [pc.id, upgrade.id], prices: { [pc.id]: 800000, [upgrade.id]: 150000 } })
  const configured = await request('/api/orders', { cookie: customer, method: 'POST', body: { ...checkout, items: [{ productId: pc.id, quantity: 1, expectedPrice: 850000, upgrades: [{ groupIndex: 0, productId: upgrade.id }] }] } })
  assert.equal(configured.status, 201)
  assert.equal(configured.data.total, 850000)
  await save({ productIds: [] })
  console.log('PASS Flash Sale prices: persisted per-product prices, validation, COD/Stripe/VNPay totals, regular-price fallback, price-change/expiry confirmation, inventory unchanged and upgrade price differences.')
}
