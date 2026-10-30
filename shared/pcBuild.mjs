export const pcBuildSlots = [
  { id: 'cpu', name: 'CPU', keywords: ['cpu', 'vi xu ly', 'processor', 'processors'] },
  { id: 'mainboard', name: 'Mainboard', keywords: ['mainboard', 'bo mach chu', 'motherboard'] },
  { id: 'ram', name: 'RAM', keywords: ['ram', 'bo nho', 'ddr4', 'ddr5', 'memory'] },
  { id: 'gpu', name: 'Card đồ họa', keywords: ['vga', 'card do hoa', 'card man hinh', 'gpu', 'graphics card'] },
  { id: 'storage', name: 'Ổ cứng', keywords: ['ssd', 'hdd', 'o cung', 'luu tru', 'storage'] },
  { id: 'psu', name: 'Nguồn (PSU)', keywords: ['nguon', 'psu', 'power supply'] },
  { id: 'cooler', name: 'Tản nhiệt', keywords: ['tan nhiet', 'cooler'] },
  { id: 'case', name: 'Vỏ case', keywords: ['case', 'vo may'] },
  { id: 'monitor', name: 'Màn hình', keywords: ['man hinh', 'monitor'] },
]

export const normalizeBuildText = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function getBuildCategoryRoot(category, categories) {
  const byId = new Map(categories.map(item => [String(item.id), item]))
  const visited = new Set()
  let current = category
  while (current && current.parentId != null && !visited.has(String(current.id))) {
    visited.add(String(current.id))
    const parent = byId.get(String(current.parentId))
    if (!parent) break
    current = parent
  }
  return current
}

export function isPcBuildCategory(categoryName, categories) {
  const category = categories.find(item => normalizeBuildText(item.name) === normalizeBuildText(categoryName))
  return normalizeBuildText(getBuildCategoryRoot(category, categories)?.name) === 'pc'
}

export function getBuildCategoryScope(categoryId, categories) {
  const ids = new Set([String(categoryId)])
  let changed = true
  while (changed) {
    changed = false
    categories.forEach(category => {
      if (category.parentId != null && ids.has(String(category.parentId)) && !ids.has(String(category.id))) {
        ids.add(String(category.id))
        changed = true
      }
    })
  }
  return new Set(categories.filter(category => ids.has(String(category.id))).map(category => normalizeBuildText(category.name)))
}

export function getPcBuildCategories(categories) {
  return categories.filter(category => {
    const rootName = normalizeBuildText(getBuildCategoryRoot(category, categories)?.name)
    return rootName === 'linh kien' || rootName.startsWith('linh kien ') || rootName === 'man hinh' || rootName.startsWith('man hinh ')
  }).sort((left, right) => (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0) || left.name.localeCompare(right.name, 'vi'))
}

function matchesSlotCategory(slot, categoryName) {
  const name = ` ${normalizeBuildText(categoryName)} `
  const matches = keywords => keywords.some(keyword => name.includes(` ${keyword} `))
  // A graphics card category can contain “màn hình”; it is not a monitor category.
  if (slot.id === 'monitor' && matches(pcBuildSlots.find(item => item.id === 'gpu').keywords)) return false
  if (slot.id === 'ram' && matches(pcBuildSlots.find(item => item.id === 'storage').keywords)) return false
  return matches(slot.keywords)
}

export function getPcBuildSlotCategories(slotId, categories) {
  const slot = pcBuildSlots.find(item => item.id === slotId)
  if (!slot) return []
  return getPcBuildCategories(categories).filter(category => matchesSlotCategory(slot, category.name))
}

export function getPcBuildSlotScope(slotId, categories) {
  const scope = new Set()
  getPcBuildSlotCategories(slotId, categories).forEach(category => {
    getBuildCategoryScope(category.id, categories).forEach(name => scope.add(name))
  })
  return scope
}

export function normalizePcComponents(value) {
  if (!Array.isArray(value) || value.length > pcBuildSlots.length) throw new Error('Cấu hình PC chỉ được có tối đa 9 nhóm linh kiện.')
  const seen = new Set()
  return value.map(item => {
    const slot = pcBuildSlots.find(slot => slot.id === item?.slotId)
    const productId = Number(item?.productId)
    const categoryId = Number(item?.categoryId)
    const quantity = Number(item?.quantity)
    const warranty = String(item?.warranty || '').trim()
    if (!slot || seen.has(slot.id)) throw new Error('Nhóm linh kiện PC bị trùng hoặc không hợp lệ.')
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(categoryId) || categoryId < 1) throw new Error(`Sản phẩm hoặc danh mục ${slot.name} không hợp lệ.`)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error(`Số lượng ${slot.name} phải từ 1 đến 99.`)
    if (warranty.length > 40) throw new Error(`Bảo hành ${slot.name} tối đa 40 ký tự.`)
    seen.add(slot.id)
    return { slotId: slot.id, categoryId, productId, quantity, warranty }
  })
}

export function calculatePcBuild(components, products) {
  const productsById = new Map(products.map(product => [Number(product.id), product]))
  let price = 0
  let oldPrice = 0
  const specifications = components.map(component => {
    const product = productsById.get(Number(component.productId))
    if (!product) throw new Error('Một linh kiện đã bị xóa khỏi kho. Hãy chọn lại trước khi áp dụng cấu hình.')
    const quantity = Number(component.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Số lượng linh kiện phải từ 1 đến 99.')
    const unitPrice = Number(product.price)
    const unitOldPrice = Math.max(unitPrice, Number(product.oldPrice) || unitPrice)
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 1 || !Number.isSafeInteger(unitOldPrice)) throw new Error(`Giá của ${product.name} không hợp lệ.`)
    price += unitPrice * quantity
    oldPrice += unitOldPrice * quantity
    return { description: product.name, quantity, warranty: component.warranty || '' }
  })
  if (!Number.isSafeInteger(price) || !Number.isSafeInteger(oldPrice)) throw new Error('Tổng giá cấu hình quá lớn.')
  return { price, oldPrice, savings: oldPrice - price, specifications }
}

export function validatePcBuild(components, products, categories, pcCategory, currentProductId) {
  if (!isPcBuildCategory(pcCategory, categories)) throw new Error('Xây dựng cấu hình chỉ áp dụng cho sản phẩm thuộc danh mục cha PC.')
  const allowedCategoryIds = new Set(getPcBuildCategories(categories).map(category => Number(category.id)))
  const requested = new Map()
  components.forEach(component => {
    if (!allowedCategoryIds.has(component.categoryId)) throw new Error('Danh mục của linh kiện không còn thuộc nhóm Linh kiện hoặc Màn hình.')
    const product = products.find(item => Number(item.id) === component.productId)
    if (!product || product.id === currentProductId) throw new Error('Linh kiện không còn tồn tại hoặc trùng với PC đang sửa.')
    if (!getBuildCategoryScope(component.categoryId, categories).has(normalizeBuildText(product.category))) throw new Error(`${product.name} không thuộc danh mục linh kiện đã chọn.`)
    if (Array.isArray(product.pcComponents) && product.pcComponents.length) throw new Error('Không thể chọn một cấu hình PC làm linh kiện.')
    requested.set(component.productId, (requested.get(component.productId) || 0) + component.quantity)
  })
  for (const [productId, quantity] of requested) {
    const product = products.find(item => Number(item.id) === productId)
    if (Number(product.stock) < quantity) throw new Error(`${product.name} chỉ còn ${product.stock} sản phẩm trong kho.`)
  }
  return calculatePcBuild(components, products)
}
