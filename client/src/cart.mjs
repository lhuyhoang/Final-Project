// The unmodified configuration has the same identity everywhere it is added.
export function cartItemKey(item) {
  const id = String(item.id)
  if (Array.isArray(item.upgrades)) {
    const upgrades = item.upgrades.filter(choice =>
      Number(choice.productId) !== Number(item.upgradeOptions?.[choice.groupIndex]?.options?.[0]?.productId)
    ).sort((a, b) => a.groupIndex - b.groupIndex)
    return upgrades.length ? `${id}:${upgrades.map(choice => `${choice.groupIndex}-${choice.productId}`).join('|')}` : id
  }
  return item.cartKey && item.cartKey !== `${id}:` ? item.cartKey : id
}

export function normalizeCart(items) {
  if (!Array.isArray(items)) return []
  const merged = new Map()
  for (const item of items) {
    if (!item?.id || !Number.isInteger(item.quantity) || item.quantity < 1) continue
    const key = cartItemKey(item)
    const existing = merged.get(key)
    if (existing) existing.quantity += item.quantity
    else merged.set(key, { ...item, cartKey: key })
  }
  return [...merged.values()]
}
