export const staffPermissions = [
  { id: 'overview', name: 'Tổng quan', description: 'Xem doanh thu, thống kê và giao dịch gần đây.' },
  { id: 'inventory', name: 'Nhập hàng', description: 'Thêm sản phẩm mới hoặc nhập hàng loạt bằng Excel; không sửa, xóa sản phẩm cũ.' },
  { id: 'products', name: 'Sản phẩm', description: 'Xem, thêm, sửa, xóa và nhập Excel sản phẩm.' },
  { id: 'categories', name: 'Danh mục', description: 'Quản lý danh mục cha, con và hiển thị trang chủ.' },
  { id: 'showrooms', name: 'Thông tin', description: 'Quản lý showroom, số điện thoại, email và link Messenger/Zalo của cửa hàng.' },
  { id: 'orders', name: 'Đơn hàng', description: 'Xem thông tin khách đặt hàng và cập nhật trạng thái đơn.' },
  { id: 'online-payments', name: 'Thanh toán', description: 'Xem giao dịch trực tuyến, báo cáo và số dư Stripe.' },
  { id: 'settings', name: 'Hiệu ứng chuyển cảnh', description: 'Thay đổi hiệu ứng ảnh và dải sản phẩm của cửa hàng.' },
  { id: 'promotions', name: 'Khuyến mãi', description: 'Chọn sản phẩm, thời gian Flash Sale và quản lý mã voucher giảm tiền.' },
]

const validPermissions = new Set(staffPermissions.map(item => item.id))
export function hasAdminPermission(user, permission) {
  if (!user || user.status === 'blocked') return false
  if (user.role === 'admin') return true
  return user.role === 'staff' && validPermissions.has(permission) && Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export function canEnterAdmin(user) {
  return user?.status !== 'blocked' && ['admin', 'staff'].includes(user?.role)
}

export function normalizeStaffRole(body = {}) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 60) throw new Error('Tên vai trò phải từ 2 đến 60 ký tự.')
  if (!Array.isArray(body.permissions) || !body.permissions.length || body.permissions.some(item => !validPermissions.has(item))) throw new Error('Chọn ít nhất một quyền hợp lệ cho nhân viên.')
  return { name, permissions: [...new Set(body.permissions)] }
}

// Paths are relative to /api/admin. Unknown paths and methods are denied to staff.
export function canAccessAdminEndpoint(user, method, path) {
  if (!canEnterAdmin(user)) return false
  if (user.role === 'admin') return true
  const verb = String(method).toUpperCase()
  const pathname = String(path).replace(/\/+$/, '') || '/'
  const any = (...permissions) => permissions.some(permission => hasAdminPermission(user, permission))
  if (verb === 'GET' && pathname === '/access') return true
  if (verb === 'GET' && pathname === '/stats') return any('overview')
  if (verb === 'GET' && pathname === '/products') return any('products', 'inventory', 'settings', 'promotions')
  if (verb === 'GET' && pathname === '/categories') return any('products', 'inventory', 'categories')
  if (verb === 'POST' && ['/products', '/products/bulk'].includes(pathname)) return any('products', 'inventory')
  if ((verb === 'PUT' && /^\/products\/\d+$/.test(pathname)) || (verb === 'DELETE' && /^\/products(?:\/\d+)?$/.test(pathname))) return any('products')
  if ((verb === 'POST' && pathname === '/categories') || (verb === 'PATCH' && /^\/categories\/\d+$/.test(pathname)) || (verb === 'DELETE' && /^\/categories(?:\/\d+)?$/.test(pathname))) return any('categories')
  if ((verb === 'GET' || verb === 'POST') && pathname === '/showrooms') return any('showrooms')
  if (['PUT', 'DELETE'].includes(verb) && /^\/showrooms\/\d+$/.test(pathname)) return any('showrooms')
  if (['GET', 'PATCH'].includes(verb) && pathname === '/contact') return any('showrooms')
  if ((verb === 'GET' && pathname === '/promotions') || (verb === 'PATCH' && pathname === '/promotions/flash-sale') || (verb === 'POST' && pathname === '/vouchers') || (verb === 'PATCH' && /^\/vouchers\/\d+$/.test(pathname))) return any('promotions')
  if ((verb === 'GET' && pathname === '/orders') || (verb === 'PATCH' && /^\/orders\/[^/]+\/status$/.test(pathname))) return any('orders')
  if (verb === 'GET' && ['/payments', '/stripe/overview'].includes(pathname)) return any('online-payments')
  if (['GET', 'PATCH'].includes(verb) && pathname === '/settings') return any('settings')
  return false
}
