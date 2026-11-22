# Sửa 3 lỗi sau đợt đối chiếu — 23/11/2026

Giữ nguyên 7 test case cần cập nhật theo yêu cầu của người dùng. Báo cáo và Excel ban đầu là kết quả trước bản sửa; tài liệu này ghi nhận phần xử lý tiếp theo.

| Case | Thay đổi | Kiểm chứng |
|---|---|---|
| CART-02 | Dùng cùng khóa giỏ hàng cho thẻ sản phẩm, trang chi tiết, combo và PC Builder. Cấu hình mặc định có cùng khóa với sản phẩm gốc; cấu hình nâng cấp khác nhau giữ khóa riêng. Khi khôi phục localStorage, gộp các dòng trùng đã lưu và cộng số lượng. | Unit test khóa mặc định/nâng cấp/khôi phục giỏ cũ; Edge thêm 3 sản phẩm từ chi tiết rồi thêm 1 từ trang chủ: một dòng, số lượng 4, giữ nguyên sau F5. |
| VNP-08 | Hủy đơn VNPay chưa thanh toán đã quá 15 phút, hoàn tổng số lượng của tất cả snapshot về kho trong một câu SQL nguyên tử. Điều kiện cập nhật và khóa dòng bảo đảm thu hồi một lần. Dùng chung TTL với URL VNPay; thêm partial index qua migration 031. | API/SQL cô lập: đơn quá hạn, đơn mới, đơn đã trả tiền, COD; snapshot nhiều dòng cùng sản phẩm; hai lần quét, callback thất bại và xác nhận muộn sau hủy không hoàn trùng. Callback hợp lệ đến trước khi quét vẫn được ghi nhận. |
| APRD-03 | API danh sách Admin sắp xếp theo ngày tạo giảm dần rồi ID giảm dần; giữ thứ tự storefront hiện có. | API tạo mới, so sánh thứ tự Admin/storefront; Edge thêm bằng form, tải lại dashboard và F5: sản phẩm mới đứng đầu thư mục đã chọn. |

Thu hồi tồn VNPay được **chờ hoàn tất trước các API sản phẩm, đơn hàng, voucher, thanh toán và Admin**. Cơ chế này chạy trên Vercel theo yêu cầu HTTP, không dùng timer trong bộ nhớ: khi website không có truy cập, việc thu hồi được thực hiện ở yêu cầu nghiệp vụ tiếp theo, trước khi sử dụng hoặc hiển thị tồn. Callback VNPay có chữ ký được xử lý riêng trước bước quét; đơn đã bị hủy không tự mở lại khi nhận xác nhận muộn.

Kiểm thử: 53 unit test và build production thành công; hồi quy API + Edge, promotions/voucher, phân quyền nhân viên, cài đặt giao diện và thông tin liên hệ. Database dùng PGlite cô lập; Stripe/VNPay/Cloudinary giả lập, không thu tiền hoặc sửa dữ liệu production.

Chạy lại:

```powershell
node --test shared/*.test.mjs client/src/*.test.mjs server/test/resetOtp.test.mjs
npm run build
# Mở Vite ở terminal riêng trước khi chạy Edge; cấu hình Cloudinary thử cho ca UI upload giả lập.
$env:VITE_CLOUDINARY_CLOUD_NAME='appearance-ui-test'
$env:VITE_CLOUDINARY_UPLOAD_PRESET='appearance-test-unsigned'
npm run dev -w client -- --host 127.0.0.1
# Terminal thứ hai:
$env:REVIEW_UI='1'
node server/test/final-cases-review.integration.mjs
```
