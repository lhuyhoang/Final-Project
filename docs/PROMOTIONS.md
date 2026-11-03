# Khuyến mãi

Trong Admin → **Khuyến mãi**:

- **Flash Sale:** tích sản phẩm, đặt thời gian bắt đầu/kết thúc và nhấn **Lưu Flash Sale**. Thời gian nhập theo múi giờ của thiết bị, lưu vào database theo UTC. Trang chủ chỉ hiển thị các sản phẩm đã chọn trong khoảng thời gian này; bộ đếm tự chạy và khu vực tự ẩn khi hết giờ. Bỏ chọn tất cả rồi lưu để ẩn ngay. Giá Flash Sale là giá bán hiện tại của sản phẩm trong kho.
- **Voucher:** nhập số tiền giảm theo VNĐ, số lượt tối đa và thời hạn rồi nhấn **Tạo mã ngẫu nhiên**. Để trống số lượt/thời hạn để không giới hạn. Mã có 10 ký tự chữ và số, có nút sao chép. Sửa số tiền, số lượt hoặc thời hạn rồi nhấn **Lưu**; bấm trạng thái để bật/tắt mã. Không thể giảm giới hạn xuống dưới số lượt đã dùng/đang giữ.
- Khách nhập mã ở phần đơn hàng trong trang thanh toán. Mỗi đơn dùng một mã; mỗi tài khoản chỉ dùng cùng một mã **một lần**. Giá trị đơn phải lớn hơn số tiền giảm. Voucher không thay đổi giá niêm yết hay giá bán sản phẩm.
- Lượt được tính/giữ khi tạo đơn, kiểm tra cả tổng số lượt lẫn lịch sử tài khoản trong transaction có khóa voucher. Các yêu cầu đồng thời không được chiếm vượt giới hạn. Đơn hủy chưa thanh toán hoặc mở cổng thanh toán lỗi sẽ trả lượt, khách có thể thử lại. Đơn đã thanh toán giữ lịch sử dùng mã. Đơn online được giữ lượt trước hạn có thể hoàn tất thanh toán sau hạn. Admin khôi phục đơn hủy chưa thanh toán phải qua lại kiểm tra voucher.
- Mã cũ giữ nguyên mức giảm, mặc định không giới hạn lượt tổng/thời hạn; quy tắc mỗi tài khoản một lần vẫn kiểm tra các đơn cũ. Ngày giờ nhập trong Admin theo múi giờ thiết bị, lưu theo UTC.
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
