const normalizeCategoryName = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').trim().toLowerCase()

export function buildProductFolders(categories, products) {
  const categoryIds = new Set(categories.map(category => String(category.id)))
  const sortedCategories = [...categories].sort((left, right) =>
    (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0) || left.name.localeCompare(right.name, 'vi'))
  const folders = sortedCategories.map(category => ({
    id: `category:${category.id}`,
    categoryId: category.id,
    parentFolderId: category.parentId != null && categoryIds.has(String(category.parentId)) ? `category:${category.parentId}` : null,
    name: category.name,
    color: category.color || '#e6332a',
    products: [],
    allProducts: [],
    subcategories: sortedCategories.filter(child => child.parentId != null && String(child.parentId) === String(category.id)),
  }))
  const byName = new Map(folders.map(folder => [normalizeCategoryName(folder.name), folder]))
  const byId = new Map(folders.map(folder => [folder.id, folder]))
  const uncategorized = []

  products.forEach(product => {
    const directFolder = byName.get(normalizeCategoryName(product.category))
    if (!directFolder) { uncategorized.push(product); return }
    directFolder.products.push(product)
    const visited = new Set()
    let folder = directFolder
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id)
      folder.allProducts.push(product)
      folder = byId.get(folder.parentFolderId)
    }
  })
  if (uncategorized.length) folders.push({
    id: 'uncategorized', categoryId: null, parentFolderId: null,
    name: 'Chưa phân loại', color: '#7c8491',
    products: uncategorized, allProducts: uncategorized, subcategories: [],
  })
  return folders
}

export function getProductFolderPath(folderId, folders) {
  const byId = new Map(folders.map(folder => [folder.id, folder]))
  const path = []
  const visited = new Set()
  let folder = byId.get(folderId)
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id)
    path.unshift(folder)
    folder = byId.get(folder.parentFolderId)
  }
  return path
}
