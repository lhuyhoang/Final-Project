# Cài đặt cửa hàng

Tab **Cài đặt** thay thế tab **Hiệu ứng chuyển cảnh**, gồm bốn ô chức năng:

- **Hiệu ứng chuyển cảnh:** bộ chỉnh ảnh chi tiết và dải sản phẩm hiện có. Hai nhóm chuyển động vẫn có cấu hình riêng.
- **Hiệu ứng hover:** chọn phóng ảnh, nâng thẻ, vệt sáng hoặc không chuyển động; chỉnh thời lượng và xem trước. Sau khi lưu, áp dụng cho thẻ sản phẩm trên trang chủ và danh sách sản phẩm. Tôn trọng chế độ giảm chuyển động của thiết bị.
- **Thay đổi banner:** thêm, xóa, đổi thứ tự ảnh và mô tả; chỉnh thời gian tự chuyển từ 2 đến 60 giây. Giữ một khung banner trên trang chủ. Có thể lưu danh sách trống để ẩn banner; tối đa 12 ảnh.
- **Thay đổi logo:** dùng URL ảnh hoặc tải ảnh từ máy. Logo áp dụng cho đầu trang, footer, tài khoản, đăng nhập, checkout, Admin và favicon. Để trống URL hoặc chọn logo mặc định để khôi phục ảnh PNG đã cung cấp.

Mỗi mục có nút lưu riêng. Các thay đổi ảnh/hover lưu trong `store_settings.store_appearance`; GET `/api/settings` trả cấu hình công khai. GET/PATCH `/api/admin/appearance` yêu cầu quyền `settings` (hiển thị là **Cài đặt**); các vai trò nhân viên cũ giữ nguyên quyền.

Ảnh hỗ trợ URL HTTPS hoặc đường dẫn `/images/` của website. Upload sử dụng cấu hình Cloudinary hiện có: `VITE_CLOUDINARY_CLOUD_NAME` và `VITE_CLOUDINARY_UPLOAD_PRESET` (unsigned). Chấp nhận PNG/JPG/WebP/AVIF, tối đa 10 MB. Tải ảnh xong cần nhấn lưu để áp dụng. Nếu chưa cấu hình upload, vẫn có thể nhập URL ảnh.

Kiểm tra API/validation với PostgreSQL tạm:

```sh
npm run test:appearance -w server
```

Kiểm tra UI với Playwright và Microsoft Edge; Vite cần chạy ở `127.0.0.1:5173`. Dùng cấu hình upload giả lập trên terminal chạy Vite để không upload ảnh thật:

```powershell
$env:VITE_CLOUDINARY_CLOUD_NAME='appearance-ui-test'
$env:VITE_CLOUDINARY_UPLOAD_PRESET='appearance-test-unsigned'
npm run dev -w client -- --host 127.0.0.1
# Terminal khác:
$env:APPEARANCE_UI='1'; npm run test:appearance -w server
```

UI test dùng database tạm và chặn request upload; không sửa website hay Cloudinary production.
