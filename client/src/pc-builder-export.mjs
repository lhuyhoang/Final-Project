const price = value => new Intl.NumberFormat('vi-VN').format(value) + ' đ'
const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])

export async function createBuildWorkbook(build) {
  const { zipSync, strToU8 } = await import('fflate')
  const data = [
    ['QUADPRO - CẤU HÌNH PC'],
    ['STT', 'Nhóm linh kiện', 'Sản phẩm', 'Số lượng', 'Giá niêm yết', 'Giá bán', 'Thành tiền'],
    ...build.rows.map((row, index) => [index + 1, row.slot.name, row.product.name, Number(row.quantity), Math.max(row.product.price, row.product.oldPrice || 0), row.product.price, row.product.price * row.quantity]),
    ['', '', 'TỔNG GIÁ NIÊM YẾT', '', '', '', build.oldPrice],
    ['', '', 'TIẾT KIỆM', '', '', '', build.savings],
    ['', '', 'TỔNG CHI PHÍ', '', '', '', build.price],
  ]
  const sheetRows = data.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${index + 1}"${typeof value === 'number' ? '' : ' t="inlineStr"'}>${typeof value === 'number' ? `<v>${value}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`).join('')}</row>`).join('')
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cấu hình PC" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="85" customWidth="1"/><col min="4" max="4" width="10" customWidth="1"/><col min="5" max="7" width="20" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])))
}

export function downloadBuildFile(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createBuildImage(build) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không hỗ trợ tạo ảnh cấu hình.')
  const wrap = (text, width) => {
    const lines = []
    let line = ''
    for (const word of String(text).split(/\s+/)) {
      if (line && context.measureText(`${line} ${word}`).width > width) { lines.push(line); line = word }
      else line = line ? `${line} ${word}` : word
    }
    if (line) lines.push(line)
    return lines
  }
  context.font = '16px sans-serif'
  const rows = build.rows.map(row => ({ ...row, lines: wrap(row.product.name, 510) }))
  canvas.width = 1200
  canvas.height = 240 + rows.reduce((height, row) => height + Math.max(90, row.lines.length * 24 + 54), 0) + 130
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#e6332a'
  context.font = 'bold 32px sans-serif'
  context.fillText('QUADPRO', 40, 60)
  context.fillStyle = '#181818'
  context.font = 'bold 26px sans-serif'
  context.fillText('CẤU HÌNH PC CỦA BẠN', 40, 112)
  context.font = '16px sans-serif'
  context.fillStyle = '#657080'
  context.fillText(`Ngày lập: ${new Date().toLocaleDateString('vi-VN')}`, 40, 147)
  context.fillText('Linh kiện', 40, 202)
  context.fillText('Sản phẩm', 230, 202)
  context.fillText('SL', 785, 202)
  context.fillText('Đơn giá', 845, 202)
  context.fillText('Thành tiền', 1020, 202)
  let y = 222
  rows.forEach((row, index) => {
    const height = Math.max(90, row.lines.length * 24 + 54)
    context.fillStyle = index % 2 ? '#ffffff' : '#f4f5f7'
    context.fillRect(30, y, 1140, height)
    context.fillStyle = '#20242c'
    context.font = 'bold 16px sans-serif'
    context.fillText(`${index + 1}. ${row.slot.name}`, 40, y + 33)
    context.font = '16px sans-serif'
    row.lines.forEach((line, index) => context.fillText(line, 230, y + 33 + index * 24))
    context.fillText(String(row.quantity), 785, y + 33)
    context.fillText(price(row.product.price), 845, y + 33)
    context.fillStyle = '#e6332a'
    context.fillText(price(row.product.price * row.quantity), 1020, y + 33)
    y += height
  })
  context.font = '16px sans-serif'
  context.fillStyle = '#657080'
  context.fillText(`Giá niêm yết: ${price(build.oldPrice)} · Tiết kiệm: ${price(build.savings)}`, 40, y + 40)
  context.font = 'bold 25px sans-serif'
  context.fillStyle = '#e6332a'
  context.fillText(`TỔNG CHI PHÍ: ${price(build.price)}`, 40, y + 88)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể tạo ảnh cấu hình.')), 'image/png'))
}
