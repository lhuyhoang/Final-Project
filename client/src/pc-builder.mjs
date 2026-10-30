import { calculatePcBuild, getPcBuildSlotScope, normalizeBuildText, pcBuildSlots } from '../../shared/pcBuild.mjs'

export const PC_BUILDER_KEY = 'quadpro-pc-builder-v1'

export function loadPcSelection(storage) {
  try {
    const saved = JSON.parse(storage.getItem(PC_BUILDER_KEY))
    if (!Array.isArray(saved)) return []
    const used = new Set()
    return saved.filter(row => {
      if (!pcBuildSlots.some(slot => slot.id === row?.slotId) || used.has(row.slotId)) return false
      if (!Number.isSafeInteger(row.productId) || row.productId < 1 || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) return false
      used.add(row.slotId)
      return true
    }).map(({ slotId, productId, quantity }) => ({ slotId, productId, quantity }))
  } catch { return [] }
}

export function resolvePcSelection(selection, products, categories) {
  if (!selection.length) throw new Error('Chọn ít nhất một linh kiện để tiếp tục.')
  const used = new Set()
  const rows = pcBuildSlots.flatMap(slot => selection.filter(row => row.slotId === slot.id).map(row => {
    if (used.has(slot.id)) throw new Error('Mỗi nhóm chỉ được chọn một sản phẩm.')
    used.add(slot.id)
    const product = products.find(product => Number(product.id) === Number(row.productId))
    if (!product) throw new Error(`Linh kiện ${slot.name} không còn trong kho. Hãy chọn lại.`)
    if (!getPcBuildSlotScope(slot.id, categories).has(normalizeBuildText(product.category))) throw new Error(`${product.name} không còn thuộc nhóm ${slot.name}. Hãy chọn lại.`)
    if (Array.isArray(product.pcComponents) && product.pcComponents.length) throw new Error('Không thể chọn một bộ PC làm linh kiện.')
    return { ...row, productId: product.id, product, slot }
  }))
  if (rows.length !== selection.length) throw new Error('Nhóm linh kiện không hợp lệ.')
  const totals = calculatePcBuild(rows, products)
  const requested = new Map()
  for (const row of rows) requested.set(row.productId, (requested.get(row.productId) || 0) + Number(row.quantity))
  for (const [productId, quantity] of requested) {
    const product = products.find(product => product.id === productId)
    if (!Number.isFinite(Number(product.stock)) || Number(product.stock) < quantity) throw new Error(`${product.name} chỉ còn ${Number(product.stock) || 0} sản phẩm trong kho.`)
  }
  return { rows, ...totals }
}

export function mergePcBuildCart(cart, rows) {
  const next = cart.map(item => ({ ...item }))
  for (const { product, quantity } of rows) {
    const reserved = next.filter(item => Number(item.id) === Number(product.id)).reduce((sum, item) => sum + Number(item.quantity), 0)
    if (reserved + Number(quantity) > Number(product.stock)) throw new Error(`${product.name} chỉ còn ${product.stock} sản phẩm; giỏ hàng đã có ${reserved}.`)
    const existing = next.find(item => (item.cartKey || String(item.id)) === String(product.id))
    if (existing) Object.assign(existing, product, { quantity: Number(existing.quantity) + Number(quantity) })
    else next.push({ ...product, quantity: Number(quantity) })
  }
  return next
}
