import { applyFlashSalePrice } from '../../shared/promotions.mjs'

export function priceStorefrontProducts(products, sale, now = Date.now()) {
  return products.map(product => applyFlashSalePrice(product, sale, now))
}

export function repriceCart(cart, products) {
  const byId = new Map(products.map(product => [Number(product.id), product]))
  let changed = false
  const next = cart.map(item => {
    const product = byId.get(Number(item.id))
    if (!product) return item
    let delta = 0
    for (const choice of item.upgrades || []) {
      const options = product.upgradeOptions?.[choice.groupIndex]?.options
      const base = byId.get(Number(options?.[0]?.productId))
      const selected = byId.get(Number(choice.productId))
      if (!base || !selected) return item
      delta += Math.max(0, Number(selected.price) - Number(base.price))
    }
    const price = Number(product.price) + delta
    const oldPrice = Math.max(Number(product.oldPrice) || 0, Number(product.price)) + delta
    if (item.price === price && item.oldPrice === oldPrice) return item
    changed = true
    return { ...item, price, oldPrice }
  })
  return changed ? next : cart
}
