import readWorkbook from 'read-excel-file/node'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
import path from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/review-test-cases.mjs <source.xlsx> [execution.json]')
const output = 'docs/test-case-review-2026-11-23'
await mkdir(output, { recursive: true })
const input = await readFile(source)
const sheets = await readWorkbook(input)
const cases = []
for (const sheet of sheets) {
  let current, inSteps = false
  for (const [index, row] of sheet.data.entries()) {
    if (row[0] === 'Test Case ID') { current = { id: row[2], title: row[5], sourceRow: index + 1, steps: [] }; cases.push(current); inSteps = false }
    if (!current) continue
    if (row[0] === 'Step #') { inSteps = true; continue }
    if (inSteps && typeof row[0] === 'number') current.steps.push({ action: row[1], expected: row[3] })
  }
}
if (cases.length !== 94 || new Set(cases.map(item => item.id)).size !== 94) throw new Error('Workbook does not match the reviewed set of 94 unique cases.')
const execution = JSON.parse(await readFile(process.argv[3] || '.tmp-review-executed.json', 'utf8'))
const local = 'Phù hợp cục bộ'
const update = 'Cần cập nhật test case'
const partial = 'Kiểm thử một phần'
const external = 'Cần kiểm thử dịch vụ thật'
const fail = 'Chưa phù hợp'
const code = 'Phù hợp theo mã nguồn'
const groupNotes = {
  AUTH: 'AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout.',
  PRD: 'main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ.',
  CART: 'main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5.',
  CHK: 'CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite.',
  STR: 'API Stripe dùng session giả lập; webhook kiểm tra bằng Stripe SDK và chữ ký HMAC thật tạo offline, có kiểm tra trùng event và hoàn tồn.',
  VNP: 'API VNPay dùng callback ký SHA-512 cục bộ; đã kiểm tra checksum sai, amount sai, IPN lặp và return thất bại hoàn tồn.',
  ACC: 'AccountSettings.jsx + PUT/GET /api/auth/me: đã kiểm tra lưu profile, từ chối phone/landline/email sai và checkout điền profile mới.',
  APRD: 'AdminDashboard.jsx + CRUD API: API kiểm tra trường bắt buộc, ASUS viết hoa, discount, giá niêm yết, sửa và snapshot sau xóa; UI kiểm tra thêm sản phẩm và upload giả lập.',
  AORD: 'AdminDashboard.jsx, db.js: đã kiểm tra tăng doanh thu COD delivered, hủy/khôi phục tồn kho, cấm hủy online paid và khóa dropdown unpaid.',
  SEC: 'Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production.',
}
const overrides = {
  'CART-02': [fail, 'Thêm cùng sản phẩm từ trang chi tiết rồi từ thẻ trang chủ tạo 2 dòng dù không chọn nâng cấp.', 'Chuẩn hóa cartKey của cấu hình gốc ở mọi nơi thêm vào giỏ; giữ tách dòng cho cấu hình nâng cấp khác nhau.'],
  'APRD-03': [fail, 'Sản phẩm mới được lưu đúng nhưng không đứng đầu bảng sau loadDashboard(): UI tạm prepend rồi API trả ORDER BY id ASC.', 'Sắp xếp nhất quán để sản phẩm mới đứng đầu thư mục, hoặc sửa kỳ vọng nếu chấp nhận thứ tự tăng dần.'],
  'VNP-08': [fail, 'Đã tạo đơn VNPay, cho created_at lùi 20 phút và đọc lại: đơn vẫn pending/unpaid, tồn vẫn bị giữ. Không có job cleanup TTL.', 'Lưu hạn thanh toán và thêm xử lý hết hạn/hoàn tồn idempotent. Chưa kiểm tra hành vi trang VNPay thật sau 15 phút.'],
  'CHK-03': [update, 'Wizard có noValidate và hiển thị lỗi inline, không dùng bong bóng validation gốc của browser. Trường rỗng/1 ký tự vẫn bị chặn.', 'Đổi Expected Results thành lỗi inline, không chuyển bước và không gửi POST tạo đơn.'],
  'ACC-05': [update, 'Email vẫn không đổi được; API từ chối email khác và email sai định dạng. Lý do Neon Auth trong test đã lỗi thời.', 'Đổi mô tả thành email đăng nhập của hệ thống session truyền thống; giữ các bước kiểm tra bất biến email.'],
  'APRD-02': [update, 'Tab Sản phẩm hiện là cây thư mục danh mục, sau đó bảng của thư mục được mở; không còn bảng phẳng toàn bộ kho.', 'Thêm bước mở danh mục cha/con; kiểm tra tìm thư mục ở cấp đầu, tìm sản phẩm và phân trang 15 dòng trong thư mục.'],
  'AORD-07': [update, 'Thanh toán online nằm trong tab Thanh toán kết hợp với tổng quan Stripe, bảng đơn đã thanh toán nằm phía dưới.', 'Đổi đường dẫn UI sang Thanh toán; giữ kiểm tra giao dịch, thời điểm thanh toán, doanh thu và badge. Badge đọc/chưa đọc chưa được tái hiện đầy đủ trong lượt này.'],
  'AORD-08': [update, 'Khóa tài khoản thu hồi toàn bộ session. Mở khóa không làm cookie cũ sống lại: API vẫn 401 cho tới khi đăng nhập lại.', 'Sau mở khóa, thêm bước login mới rồi xác nhận 200. Không yêu cầu hồi sinh session đã thu hồi.'],
  'AORD-10': [update, 'Stripe Sandbox không còn là tab riêng; báo cáo Stripe đã nằm trong tab Thanh toán. UI lỗi nhà cung cấp và các tab khác vẫn hoạt động.', 'Đổi bước sang Thanh toán; cần kiểm tra riêng với key test thật hợp lệ và cấu hình không có key. Lượt này dùng provider giả lập lỗi.'],
  'SEC-04': [update, 'Ứng dụng dùng cookie session, không đọc Authorization: Bearer. Đã kiểm tra cookie session giả/hết hiệu lực trả 401.', 'Dùng cookie thiếu/sai/hết hạn trong test; không dùng tiền tố Bearer để xác nhận một phiên hợp lệ.'],
  'STR-01': [external, 'Đã xác minh API tạo session, URL redirect giả lập, đơn unpaid và giữ tồn; chưa mở Stripe hosted Checkout thật.', 'Dùng Stripe Test mode, so giỏ với trang hosted và kiểm tra cấu hình domain/webhook.'],
  'STR-02': [external, 'Backend xác nhận paid/confirmed đã được kiểm thử cục bộ, nhưng chưa dùng thẻ 4242 trên Stripe hosted Checkout trong lượt này.', 'Chạy thanh toán test end-to-end, return, xóa giỏ và bảng giao dịch.'],
  'STR-03': [external, 'Thông báo card declined nằm ở Stripe hosted Checkout; chưa thực hiện bằng thẻ declined thật trong test mode.', 'Kiểm tra thẻ declined, giữ unpaid và retry thẻ 4242 trên cùng session.'],
  'VNP-01': [external, 'API tạo URL sandbox ký hợp lệ, đơn unpaid và giữ tồn đã được xác minh cục bộ; chưa mở merchant sandbox thật.', 'Kiểm tra URL/merchant/domain sandbox và dữ liệu hiển thị ở VNPay.'],
  'VNP-02': [external, 'IPN/return ký hợp lệ xử lý paid đã có mã nguồn và kiểm thử callback cục bộ; chưa thanh toán thẻ sandbox thật.', 'Chạy thẻ sandbox với merchant thật, return/IPN và xóa giỏ.'],
  'APRD-08': [external, 'UI đã kiểm tra chọn JPG, upload request, điền URL/preview và lưu bằng Cloudinary mock. Chưa xác minh preset/quyền Cloudinary thật.', 'Upload 1 ảnh thử qua cấu hình Cloudinary hiện dùng; xác minh URL tồn tại sau reload.'],
  'APRD-07': [partial, 'API sửa giá/tồn và lưu DB đã qua; UI xem chi tiết/giới hạn stock đã qua, nhưng chưa thao tác trọn form Edit rồi kiểm tra storefront trong cùng kịch bản.', 'Chạy thêm toàn bộ luồng sửa qua dashboard, F5 rồi mở chi tiết tương ứng.'],
  'APRD-10': [partial, 'API DELETE, quyền customer 403 và snapshot đơn cũ sau xóa đã qua. Chưa tự động chạy cả hai nhánh Cancel/Confirm của popup trong lượt này.', 'Chạy thêm nhánh Hủy rồi Xóa của popup, kiểm tra storefront và lịch sử đơn.'],
  'AORD-01': [code, 'visibleOrders lọc theo id, tên/email khách; UI bảng Orders đã mở, nhưng chưa chạy riêng mọi từ khóa và clear search của case.', 'Chạy bổ sung 3 bước tìm/không có kết quả/xóa truy vấn bằng UI.'],
  'AORD-09': [partial, 'Đã kiểm tra delta totalRevenue bằng đúng tổng đơn COD delivered. Query tổng số khách/đơn, low-stock và chart 7 ngày đã đọc mã nguồn.', 'Cần bộ dữ liệu ngày cố định để đối chiếu độc lập toàn bộ chỉ số và chart, gồm múi giờ.'],
  'SEC-07': [partial, 'Đã gửi 181 request/IP cô lập: request vượt hạn trả 429; RateLimit-Limit, Remaining, Reset tồn tại. Chưa chờ đủ 60 giây để thử lại.', 'Chờ hết cửa sổ rồi gọi lại xác nhận 200; kiểm tra trust proxy theo môi trường triển khai.'],
  'CART-10': [code, 'Đã kiểm tra xóa hết sản phẩm; mã nguồn có thông báo giỏ trống và nút tiếp tục mua. Subtotal nội bộ bằng 0 nhưng không hiển thị hàng Tạm tính khi giỏ trống.', 'Nếu bắt buộc nhìn thấy số 0₫, cần bổ sung UI hoặc chỉnh Expected Results; chạy riêng nút Tiếp tục mua sắm.'],
}
const reviewed = cases.map(item => {
  const [status, evidence, next = ''] = overrides[item.id] || [local, groupNotes[item.id.split('-')[0]]]
  return { ...item, status, evidence, next, execution: execution.filter(entry => entry.ids.includes(item.id)) }
})
const counts = Object.fromEntries([...new Set(reviewed.map(item => item.status))].map(status => [status, reviewed.filter(item => item.status === status).length]))
const sourceHash = createHash('sha256').update(input).digest('hex')
const metadata = { reviewedOn: '2026-11-23', sourceName: path.basename(source), sourceHash, baselineCommit: 'e3102bd', total: 94, counts, warning: 'Phù hợp cục bộ không đồng nghĩa đã chạy mọi bước với dịch vụ production; không kế thừa cột Pass trong file nguồn.' }
await writeFile(path.join(output, 'review.json'), JSON.stringify({ ...metadata, cases: reviewed, execution }, null, 2))
const escapeMd = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
const markdown = `# Đối chiếu 94 test case QuadPro — 23/11/2026\n\nChưa thể kết luận phù hợp toàn bộ workbook. Có 3 sai lệch được tái hiện, 7 case cần cập nhật theo thiết kế mới, cùng các mục cần kiểm thử bổ sung hoặc dịch vụ thật.\n\nNguồn: ${metadata.sourceName}; SHA-256: \`${sourceHash}\`. Baseline: \`e3102bd\`, cộng các thay đổi cục bộ có sẵn ở title/footer. Không sửa workbook nguồn hoặc chức năng sản phẩm trong lượt đối chiếu. Không dùng cột Pass cũ làm kết quả mới.\n\n## Tổng hợp\n\n${Object.entries(counts).map(([status, count]) => `- ${status}: **${count}**`).join('\n')}\n\n“Phù hợp cục bộ” nghĩa là hành vi chính đã được kiểm tra bằng API/UI hoặc bộ regression có liên quan, kết hợp đọc mã nguồn; không phải biên bản nghiệm thu từng bước trên production. Kết quả API/UI chi tiết nằm trong review.json. Các nhóm kiểm thử có thể kiểm tra một phần của nhiều case; vì vậy số probe không phải số case Pass.\n\n## Sai lệch ưu tiên\n\n- **VNP-08 — cao:** đơn VNPay quá hạn vẫn giữ tồn, chưa có cleanup TTL.\n- **CART-02 — trung bình:** cùng cấu hình gốc thêm từ hai nơi tạo hai dòng.\n- **APRD-03 — thấp:** sản phẩm mới không đứng đầu bảng sau reload dữ liệu.\n\n## Thay đổi test case\n\n${reviewed.filter(item => item.status === update).map(item => `- **${item.id}:** ${item.evidence} ${item.next}`).join('\n')}\n\n## Bằng chứng và giới hạn\n\n- Build production thành công; 50 unit tests và các bộ test password/access/reset/contact/promotions/appearance đều qua.\n- Bộ final-cases-review kiểm tra API trên PGlite và UI trên Edge với cookie HttpOnly thật của fixture, gồm F5, bàn phím, mobile 375 px, chống double click, Stripe signature và VNPay callback.\n- Stripe/VNPay/Cloudinary là môi trường giả lập; chữ ký webhook Stripe được tạo/kiểm tra offline bằng SDK. Không tạo đơn/thu tiền/gửi email/sửa dữ liệu production.\n- VNP-08 được kiểm tra bằng cách làm cũ created_at 20 phút trong DB cô lập, cộng rà soát không có job hết hạn. Chưa chờ trên trang VNPay thật.\n- Các thông báo tiếng Việt tương đương ý nghĩa được chấp nhận; không yêu cầu trùng chữ với chuỗi tiếng Anh trong workbook.\n- Kiểm tra dữ liệu ảnh/link đang có trên production, merchant thật, preset Cloudinary và webhook delivery ngoài mạng vẫn cần chạy riêng.\n- Hai vấn đề ngoài phạm vi 94 case từ báo cáo cũ (tồn linh kiện nâng cấp và URL ảnh nguồn) chưa được coi là đã xử lý.\n\n## Ma trận đủ 94 case\n\n| ID | Test case | Kết luận | Bằng chứng / điểm cần xử lý | Dòng nguồn |\n|---|---|---|---|---|\n${reviewed.map(item => `| ${item.id} | ${escapeMd(item.title)} | ${item.status} | ${escapeMd(item.evidence + (item.next ? ' ' + item.next : ''))} | ${item.sourceRow} |`).join('\n')}\n\n## Chạy lại\n\nMở Vite như phần Kiểm thử trong README rồi chạy \`REVIEW_UI=1 node server/test/final-cases-review.integration.mjs\` (PowerShell: \`$env:REVIEW_UI='1'\` trước lệnh node). Sau đó chạy \`node scripts/review-test-cases.mjs <đường-dẫn-file-xlsx>\` để dựng lại các bản báo cáo. Script review xác minh các hành vi hiện tại và ghi nhận gap; exit 0 không có nghĩa là 94/94 đạt.\n`
await writeFile(path.join(output, 'README.md'), markdown)
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
const summary = [['ĐỐI CHIẾU TEST CASE QUADPRO', '23/11/2026'], ['Tổng số case', 94], ...Object.entries(counts), ['Lưu ý', metadata.warning], ['Nguồn', metadata.sourceName], ['SHA-256', sourceHash], ['VNP-08', overrides['VNP-08'][1]], ['CART-02', overrides['CART-02'][1]], ['APRD-03', overrides['APRD-03'][1]]]
const rows = [['ID', 'Nhóm', 'Test case', 'Kết luận', 'Bằng chứng', 'Điểm cần xử lý', 'Dòng nguồn', 'Kỳ vọng trong file gốc'], ...reviewed.map(item => [item.id, item.id.split('-')[0], item.title, item.status, item.evidence, item.next, item.sourceRow, item.steps.map((step, i) => `${i + 1}. ${step.expected}`).join('\n')])]
function worksheet(data, widths) {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${data.map((row, r) => `<row r="${r + 1}" ht="${r ? 110 : 28}" customHeight="1">${row.map((value, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" s="${r ? 1 : 2}"${typeof value === 'number' ? '' : ' t="inlineStr"'}>${typeof value === 'number' ? `<v>${value}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${String.fromCharCode(64 + data[0].length)}${data.length}"/></worksheet>`
}
const files = {
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tổng quan" sheetId="1" r:id="rId1"/><sheet name="Đối chiếu 94 case" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB92720"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml': worksheet(summary, [36, 115]),
  'xl/worksheets/sheet2.xml': worksheet(rows, [14, 12, 65, 28, 85, 85, 13, 95]),
}
const workbook = zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])))
const destination = path.join(output, 'QuadPro_Test_Cases_Reviewed.xlsx')
await writeFile(destination, workbook)
const checked = await readWorkbook(Buffer.from(workbook))
if (checked[1].data.length !== 95 || checked[1].data[94][0] !== 'SEC-10') throw new Error('Generated workbook integrity check failed.')
console.log(JSON.stringify({ output, counts, cases: reviewed.length, xlsxRows: checked[1].data.length }, null, 2))
