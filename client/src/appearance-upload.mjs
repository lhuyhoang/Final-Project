export async function uploadAppearanceImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Chọn ảnh PNG, JPG, WebP hoặc AVIF.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Ảnh tối đa 10 MB.')
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !preset) throw new Error('Chưa cấu hình tải ảnh Cloudinary. Bạn có thể dán URL ảnh để sử dụng.')
  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', preset)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.secure_url) throw new Error(result?.error?.message || 'Không tải được ảnh. Vui lòng thử lại.')
  return result.secure_url
}
