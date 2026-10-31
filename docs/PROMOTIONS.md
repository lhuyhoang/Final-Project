# Khuyến mãi

Trong Admin → **Khuyến mãi**:

- **Flash Sale:** tích sản phẩm, đặt thời gian bắt đầu/kết thúc và nhấn **Lưu Flash Sale**. Thời gian nhập theo múi giờ của thiết bị, lưu vào database theo UTC. Trang chủ chỉ hiển thị các sản phẩm đã chọn trong khoảng thời gian này; bộ đếm tự chạy và khu vực tự ẩn khi hết giờ. Bỏ chọn tất cả rồi lưu để ẩn ngay. Giá Flash Sale là giá bán hiện tại của sản phẩm trong kho.
- **Voucher:** nhập số tiền giảm theo VNĐ và nhấn **Tạo mã ngẫu nhiên**. Mã có 10 ký tự chữ và số, có nút sao chép. Sửa số tiền rồi nhấn **Lưu**, hoặc bấm trạng thái để bật/tắt mã.
- Khách nhập mã ở phần đơn hàng trong trang thanh toán. Mỗi đơn dùng một mã; giá trị đơn phải lớn hơn số tiền giảm. Mã đang bật có thể dùng cho nhiều đơn. Voucher không thay đổi giá niêm yết hay giá bán sản phẩm.
- Máy chủ tính lại giá, kiểm tra trạng thái và số tiền giảm khi tạo đơn. Nếu số tiền giảm đã đổi từ lúc khách áp dụng mã, khách cần áp dụng lại mã để xác nhận tổng tiền mới. Đơn đã tạo lưu mã và số tiền giảm riêng, không đổi theo lần chỉnh sửa voucher sau đó.
- COD, Stripe và VNPay sử dụng tổng tiền sau giảm. Stripe nhận coupon tương ứng với đơn hàng; không cần tạo mã thủ công trong Stripe Dashboard.
- Admin có thể cấp quyền **Khuyến mãi** cho vai trò nhân viên trong tab Người dùng. Quyền này không cấp quyền sửa sản phẩm hoặc quản lý người dùng.

API public `/api/settings` chỉ trả cấu hình Flash Sale; không công khai danh sách voucher.

Kiểm tra logic, API, migration và thanh toán giả lập trên PostgreSQL tạm:

```sh
npm run test:promotions -w server
```

Kiểm tra UI bằng Edge (cần package `playwright`, trình duyệt Microsoft Edge và Vite chạy ở `127.0.0.1:5173`; dùng API và database tạm, không thanh toán thật):

```powershell
npm run dev -w client -- --host 127.0.0.1
# Terminal khác:
$env:PROMOTIONS_UI='1'; npm run test:promotions -w server
```
