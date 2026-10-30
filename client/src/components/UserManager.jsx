import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Folder, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react'
import { api } from '../api'
import { normalizeStaffRole, staffPermissions } from '../../../shared/adminAccess.mjs'
import '../user-manager.css'

function UserDialog({ title, caption, busy, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector('input, button')?.focus()
    return () => { document.body.style.overflow = overflow; previousFocus?.focus?.() }
  }, [])
  return <div className="user-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()} onKeyDown={event => {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose() }
    if (event.key === 'Tab') {
      const nodes = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
    }
  }}><section className="user-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="user-dialog-title"><header><div><small>{caption}</small><h2 id="user-dialog-title">{title}</h2></div><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={20}/></button></header>{children}</section></div>
}

function RoleEditor({ role, onClose, onSaved }) {
  const [name, setName] = useState(role?.name || '')
  const [permissions, setPermissions] = useState(role?.permissions || ['inventory'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const body = normalizeStaffRole({ name, permissions })
      await api(role ? `/api/admin/roles/${role.id}` : '/api/admin/roles', { method: role ? 'PUT' : 'POST', body: JSON.stringify(body) })
      await onSaved()
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <UserDialog title={role ? 'Chỉnh sửa vai trò' : 'Tạo vai trò nhân viên'} caption="VAI TRÒ & QUYỀN" busy={busy} onClose={onClose}><form onSubmit={save}><div className="user-dialog-body"><label className="user-field">Tên vai trò<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Nhân viên nhập liệu"/></label><div className="role-permissions-heading"><b>Các tab được phép truy cập</b><button type="button" onClick={() => setPermissions(permissions.length === staffPermissions.length ? [] : staffPermissions.map(item => item.id))}>{permissions.length === staffPermissions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button></div><div className="role-permission-grid">{staffPermissions.map(permission => <label className={permissions.includes(permission.id) ? 'selected' : ''} key={permission.id}><input type="checkbox" checked={permissions.includes(permission.id)} onChange={() => setPermissions(current => current.includes(permission.id) ? current.filter(value => value !== permission.id) : [...current, permission.id])}/><span><b>{permission.name}</b><small>{permission.description}</small></span></label>)}</div><p className="user-form-hint"><ShieldCheck size={16}/> Nhân viên chỉ thấy các tab được chọn. Quản lý người dùng và phân quyền thuộc quyền admin.</p>{error && <p className="user-manager-error" role="alert">{error}</p>}</div><footer><span>{permissions.length} quyền được chọn</span><div><button type="button" className="admin-secondary" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="admin-primary" disabled={busy}><Check size={16}/>{busy ? 'Đang lưu…' : 'Lưu vai trò'}</button></div></footer></form></UserDialog>
}

function StaffEditor({ roles, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', staffRoleId: String(roles[0]?.id || '') })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ ...form, staffRoleId: Number(form.staffRoleId) }) })
      await onSaved()
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  const field = key => ({ value: form[key], onChange: event => setForm(current => ({ ...current, [key]: event.target.value })) })
  return <UserDialog title="Thêm nhân viên" caption="TÀI KHOẢN NHÂN VIÊN" busy={busy} onClose={onClose}><form onSubmit={save}><div className="user-dialog-body staff-create-fields"><label className="user-field">Họ và tên<input required minLength={2} maxLength={60} autoComplete="name" {...field('name')}/></label><label className="user-field">Email đăng nhập<input type="email" required maxLength={254} autoComplete="off" {...field('email')}/></label><label className="user-field">Mật khẩu ban đầu<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" {...field('password')}/></label><label className="user-field">Vai trò nhân viên<select required {...field('staffRoleId')}><option value="">Chọn vai trò</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><p className="user-form-hint">Tài khoản đã có sẵn: mở thư mục Khách hàng và đổi vai trò tại tài khoản đó.</p>{error && <p className="user-manager-error" role="alert">{error}</p>}</div><footer><span>Nhân viên đăng nhập bằng email và mật khẩu.</span><div><button type="button" className="admin-secondary" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="admin-primary" disabled={busy || !roles.length}><Plus size={16}/>{busy ? 'Đang tạo…' : 'Tạo nhân viên'}</button></div></footer></form></UserDialog>
}

export default function UserManager({ users, currentUser, onChanged }) {
  const [folder, setFolder] = useState(null)
  const [section, setSection] = useState('accounts')
  const [query, setQuery] = useState('')
  const [roles, setRoles] = useState([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [roleEditor, setRoleEditor] = useState(undefined)
  const [staffEditor, setStaffEditor] = useState(false)
  const [deleteRole, setDeleteRole] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  async function refreshRoles() { setRoles(await api('/api/admin/roles')) }
  useEffect(() => { let active = true; api('/api/admin/roles').then(data => { if (active) setRoles(data) }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setRolesLoading(false) }); return () => { active = false } }, [])
  useEffect(() => { setPage(1) }, [folder, query])
  const staff = users.filter(user => ['admin', 'staff'].includes(user.role))
  const customers = users.filter(user => user.role === 'customer')
  const visible = (folder === 'staff' ? staff : customers).filter(user => `${user.name} ${user.email} ${user.phone} ${user.staffRoleName}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  const pageCount = Math.max(1, Math.ceil(visible.length / 15))
  const safePage = Math.min(page, pageCount)
  const roleMembers = role => users.filter(user => Number(user.staffRoleId) === role.id).length
  async function mutate(action, message) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action(); await Promise.all([onChanged(), refreshRoles()]); setNotice(message) }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  function changeRole(account, value) {
    const isStaff = value.startsWith('staff:')
    return mutate(() => api(`/api/admin/users/${account.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: isStaff ? 'staff' : value, staffRoleId: isStaff ? Number(value.slice(6)) : null }) }), 'Đã cập nhật vai trò người dùng.')
  }
  function openFolder(value) { setFolder(value); setSection('accounts'); setQuery(''); setNotice(''); setError('') }
  async function saved() { await Promise.all([onChanged(), refreshRoles()]); setRoleEditor(undefined); setStaffEditor(false); setNotice('Đã lưu thay đổi.') }

  return <section className="user-manager">
    <div className="user-manager-heading"><div>{folder && <button type="button" className="user-back" onClick={() => openFolder(null)}><ArrowLeft size={15}/> Tất cả người dùng</button>}<small>QUẢN LÝ TÀI KHOẢN</small><h2>{!folder ? 'Người dùng' : folder === 'staff' ? 'Nhân viên' : 'Khách hàng'}</h2><p>{!folder ? 'Tách tài khoản vận hành cửa hàng và tài khoản mua sắm để quản lý dễ hơn.' : folder === 'staff' ? 'Tạo vai trò, chọn quyền và gán cho từng nhân viên.' : 'Quản lý khách mua hàng hoặc chuyển tài khoản thành nhân viên.'}</p></div>{folder === 'staff' && <div className="user-heading-actions"><button type="button" className="admin-secondary" disabled={rolesLoading} onClick={() => setRoleEditor(null)}><ShieldCheck size={16}/> Tạo vai trò</button><button type="button" className="admin-primary" disabled={rolesLoading || !roles.length} onClick={() => setStaffEditor(true)}><Plus size={16}/> Thêm nhân viên</button></div>}</div>
    {error && <p className="user-manager-error" role="alert">{error}</p>}{notice && <p className="user-manager-notice" role="status"><Check size={16}/>{notice}</p>}
    {!folder ? <div className="user-folder-grid">{[{ id: 'staff', name: 'Nhân viên', count: staff.length, icon: ShieldCheck, note: 'Tài khoản quản trị và nhân viên được cấp quyền.' }, { id: 'customers', name: 'Khách hàng', count: customers.length, icon: Users, note: 'Tài khoản mua sắm và thông tin liên hệ.' }].map(item => { const Icon = item.icon; return <button className="user-folder" type="button" key={item.id} onClick={() => openFolder(item.id)}><span><Folder size={29}/><Icon size={17}/></span><div><small>THƯ MỤC NGƯỜI DÙNG</small><b>{item.name}</b><p>{item.note}</p><em>{item.count} tài khoản</em></div><ChevronRight size={20}/></button> })}</div> : <>
      {folder === 'staff' && <div className="user-section-tabs" role="tablist" aria-label="Quản lý nhân viên"><button type="button" role="tab" aria-selected={section === 'accounts'} onClick={() => setSection('accounts')}><UserRound size={16}/> Tài khoản ({staff.length})</button><button type="button" role="tab" aria-selected={section === 'roles'} onClick={() => setSection('roles')}><ShieldCheck size={16}/> Vai trò &amp; quyền ({roles.length})</button></div>}
      {section === 'roles' && folder === 'staff' ? <div className="staff-roles-grid">{roles.map(role => <article className="staff-role-card" key={role.id}><div><span><ShieldCheck size={22}/></span><div><h3>{role.name}</h3><small>{roleMembers(role)} nhân viên · {role.permissions.length} quyền</small></div></div><ul>{role.permissions.map(id => <li key={id}><Check size={13}/>{staffPermissions.find(permission => permission.id === id)?.name || id}</li>)}</ul><div className="staff-role-actions"><button type="button" className="admin-secondary" onClick={() => setRoleEditor(role)}><Pencil size={14}/> Chỉnh sửa</button><button type="button" disabled={busy || roleMembers(role) > 0} title={roleMembers(role) ? 'Chuyển nhân viên sang vai trò khác trước khi xóa.' : 'Xóa vai trò'} className="user-delete-role" onClick={() => setDeleteRole(role)} aria-label={`Xóa vai trò ${role.name}`}><Trash2 size={16}/></button></div></article>)}{!roles.length && <div className="user-manager-empty">{rolesLoading ? 'Đang tải vai trò…' : 'Chưa có vai trò. Tạo vai trò trước khi thêm nhân viên.'}</div>}</div> : <section className="admin-panel admin-list-panel user-accounts-panel"><div className="user-list-search"><label><Search size={17}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, email, số điện thoại…" aria-label="Tìm người dùng"/></label><span>{visible.length} tài khoản</span></div><div className="admin-table-wrap"><table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Ngày tạo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visible.slice((safePage - 1) * 15, safePage * 15).map(account => <tr key={account.id}><td><div className="account-cell"><div>{account.name.charAt(0).toUpperCase()}</div><span><b>{account.name}</b><small>{account.id === currentUser.id ? 'Tài khoản của bạn' : account.role === 'admin' ? 'Quản trị viên' : account.role === 'staff' ? 'Nhân viên' : 'Khách hàng'}</small></span></div></td><td><div className="customer-cell"><b>{account.email}</b><small>{account.phone || 'Chưa cập nhật SĐT'}</small></div></td><td><select aria-label={`Vai trò của ${account.name}`} className="user-role-select" disabled={busy || rolesLoading || account.id === currentUser.id} value={account.role === 'staff' ? `staff:${account.staffRoleId}` : account.role} onChange={event => changeRole(account, event.target.value)}><option value="customer">Khách hàng</option><optgroup label="Vai trò nhân viên">{roles.map(role => <option key={role.id} value={`staff:${role.id}`}>{role.name}</option>)}</optgroup><option value="admin">Quản trị viên (toàn quyền)</option></select></td><td>{new Date(account.createdAt).toLocaleDateString('vi-VN')}</td><td><span className={`account-status ${account.status}`}>{account.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button type="button" className="account-toggle" disabled={busy || account.id === currentUser.id} onClick={() => mutate(() => api(`/api/admin/users/${account.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: account.status === 'active' ? 'blocked' : 'active' }) }), 'Đã cập nhật trạng thái tài khoản.')}>{account.status === 'active' ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table>{!visible.length && <div className="user-manager-empty">Chưa có tài khoản phù hợp.</div>}</div>{visible.length > 15 && <div className="user-pagination"><span>Trang {safePage} / {pageCount}</span><div><button type="button" className="admin-secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Trước</button><button type="button" className="admin-secondary" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Sau</button></div></div>}</section>}
    </>}
    {roleEditor !== undefined && <RoleEditor role={roleEditor} onClose={() => setRoleEditor(undefined)} onSaved={saved}/>}
    {staffEditor && <StaffEditor roles={roles} onClose={() => setStaffEditor(false)} onSaved={saved}/>}
    {deleteRole && <UserDialog title="Xóa vai trò?" caption="XÁC NHẬN THAO TÁC" busy={busy} onClose={() => setDeleteRole(null)}><div className="user-dialog-body"><p>Bạn muốn xóa vai trò <b>{deleteRole.name}</b>?</p></div><footer><div><button type="button" className="admin-secondary" disabled={busy} onClick={() => setDeleteRole(null)}>Hủy</button><button type="button" className="admin-primary" disabled={busy} onClick={() => mutate(async () => { await api(`/api/admin/roles/${deleteRole.id}`, { method: 'DELETE' }); setDeleteRole(null) }, 'Đã xóa vai trò.')}><Trash2 size={16}/> Xóa vai trò</button></div></footer></UserDialog>}
  </section>
}
