import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function testOrderInventory({ db, database, userId }) {
  const rollback = await readFile(new URL('../migrations/030_allow_order_product_variants.down.sql', import.meta.url), 'utf8')
  await database.exec(rollback)
  await database.exec(await readFile(new URL('../migrations/030_allow_order_product_variants.up.sql', import.meta.url), 'utf8'))
  const base = await db.createProduct({ name: 'Inventory RAM base', category: 'RAM', brand: 'Test', price: 100000, stock: 100 })
  const upgrade = await db.createProduct({ name: 'Inventory RAM upgrade', category: 'RAM', brand: 'Test', price: 200000, stock: 100 })
  const product = await db.createProduct({ name: 'Inventory PC variants', category: 'PC Gaming', brand: 'Test', price: 1000000, stock: 20,
    upgradeOptions: [{ name: 'RAM', options: [{ productId: base.id, name: '16GB' }, { productId: upgrade.id, name: '32GB' }] }] })
  const items = [
    { productId: product.id, quantity: 2 },
    { productId: product.id, quantity: 3, upgrades: [{ groupIndex: 0, productId: base.id }] },
    { productId: product.id, quantity: 4, upgrades: [{ groupIndex: 0, productId: upgrade.id }] },
  ]
  const stock = async () => (await db.findProductById(product.id)).stock
  const cod = await db.createOrder({ userId, items })
  assert.equal(cod.items.length, 3, 'Each configuration keeps its own price/name line')
  assert.deepEqual(cod.items.map(item => item.lineNumber), [1, 2, 3])
  await assert.rejects(database.exec(rollback), /orders contain multiple product variants/, 'Rollback preserves variant order history')
  assert.equal(await stock(), 11)
  await db.updateOrderStatus(cod.id, 'cancelled')
  assert.equal(await stock(), 20, 'Cancel restores the sum of all variant quantities for one inventory product')
  await db.updateOrderStatus(cod.id, 'cancelled')
  assert.equal(await stock(), 20, 'Repeated cancel does not restore stock twice')
  await db.updateOrderStatus(cod.id, 'pending')
  assert.equal(await stock(), 11, 'Restore reserves the sum of all variants')
  await db.updateOrderStatus(cod.id, 'cancelled')
  await db.updateProduct(product.id, { stock: 8 })
  await assert.rejects(db.updateOrderStatus(cod.id, 'pending'), error => error.code === 'INSUFFICIENT_STOCK')
  assert.equal(await stock(), 8, 'Failed restore leaves inventory unchanged')
  assert.equal((await db.findOrderById(cod.id)).status, 'cancelled')
  await db.updateProduct(product.id, { stock: 20 })
  for (const paymentMethod of ['stripe', 'vnpay']) {
    const order = await db.createOrder({ userId, items, paymentMethod })
    assert.equal(await stock(), 11)
    const cancel = paymentMethod === 'stripe' ? db.cancelUnpaidStripeOrder : db.cancelUnpaidVnpayOrder
    await cancel({ orderId: order.id })
    assert.equal(await stock(), 20, `${paymentMethod} cancellation restores every variant`)
    await cancel({ orderId: order.id })
    assert.equal(await stock(), 20, `${paymentMethod} cancellation remains idempotent`)
  }
  console.log('PASS inventory: aggregate variant cancellation/restoration, insufficient aggregate stock, repeated COD/Stripe/VNPay cancellation.')
}
