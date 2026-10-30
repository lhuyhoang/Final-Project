export function getUpgradeDisplayName(option, product) {
  const name = typeof option === 'string' ? option : option?.name
  return (typeof name === 'string' && name.trim()) || product?.name || 'Lựa chọn nâng cấp'
}
