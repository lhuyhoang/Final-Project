# QuadPro E-commerce

Storefront linh kiện máy tính dùng React, Node.js REST API, PostgreSQL, session cookie phía server, rate limiting, giỏ hàng, tìm kiếm và lọc sản phẩm.

## Chạy local

```bash
npm install
npm run db:init
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Admin Dashboard: `http://localhost:5173/admin` khi chạy dev

Ứng dụng không chứa tài khoản đăng nhập mặc định. Người dùng đăng ký trực tiếp trên website; mật khẩu được băm bằng scrypt và session được lưu trong PostgreSQL. Với database mới, cấp quyền cho quản trị viên đầu tiên một lần bằng SQL: `UPDATE users SET role = 'admin' WHERE email = 'email-cua-ban';`. Sau đó quản trị viên có thể đổi vai trò các tài khoản khác ngay trong Dashboard.

Khi nâng cấp từ Neon Better Auth, migration giữ nguyên hồ sơ, vai trò, đơn hàng và credential email/password cũ. Người dùng đăng nhập bằng mật khẩu hiện tại; lần đăng nhập thành công đầu tiên sẽ tự chuyển password hash sang định dạng nội bộ mới. Tài khoản chỉ dùng OAuth và không có credential password cần được hỗ trợ đặt mật khẩu riêng trước khi đăng nhập hệ thống mới.

## PostgreSQL 17

1. Bảo đảm PostgreSQL 17 đang lắng nghe tại `localhost:5433`.
2. Trong pgAdmin, đăng ký server với Host `localhost`, Port `5433`, Maintenance database `postgres`, Username `postgres` và mật khẩu PostgreSQL đã đặt khi cài đặt.
3. Điền mật khẩu đó vào `DB_PASSWORD` trong `server/.env`. Có thể dùng `DATABASE_URL` thay cho nhóm biến `DB_*`.
4. Chạy `npm run db:init` từ thư mục gốc.

`db:init` kết nối vào `DB_ADMIN_DATABASE`, tạo database `quadpro_ecom` nếu chưa có, chạy migration, rồi nhập danh mục ban đầu từ `server/data/store.json` chỉ khi cả bốn bảng dữ liệu đều trống. Chạy lại lệnh này không nhập trùng dữ liệu.

## API chính

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`: xác thực bằng session HttpOnly lưu trong PostgreSQL
- `GET/PUT /api/auth/me`, `PUT /api/auth/password`: đọc/cập nhật hồ sơ và đổi mật khẩu
- `GET /api/products`, `POST /api/orders`, `GET /api/orders`
- `/api/admin/*`: thống kê, CRUD sản phẩm, đơn hàng và người dùng; bắt buộc session của tài khoản có quyền `admin`

## Upload ảnh Cloudinary

1. Trong Cloudinary, tạo một upload preset và đặt Signing Mode là `Unsigned`.
2. Sao chép `client/.env.example` thành `client/.env`.
3. Điền `VITE_CLOUDINARY_CLOUD_NAME` và `VITE_CLOUDINARY_UPLOAD_PRESET`, sau đó khởi động lại Vite.
4. Trong form thêm hoặc sửa sản phẩm, chọn **Chọn hình ảnh**. URL Cloudinary sẽ tự động được điền sau khi upload thành công.

Chỉ đưa Cloud name và unsigned preset vào frontend. Không thêm Cloudinary API Secret vào biến `VITE_*`. Nên giới hạn định dạng, dung lượng và thư mục đích trong cấu hình upload preset.

## Deploy lên Vercel

1. Import repository vào Vercel và giữ **Root Directory** là thư mục gốc.
2. Kết nối một PostgreSQL database có thể truy cập từ Vercel.
3. Thêm các biến môi trường sau cho môi trường Production:

```text
DATABASE_URL=postgresql://...
DB_SSL=true
DB_POOL_MAX=3
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
APP_BASE_URL=https://ten-du-an.vercel.app
```

`STRIPE_SECRET_KEY` và `STRIPE_WEBHOOK_SECRET` phải đặt loại **Secret** và tuyệt đối không có tiền tố `VITE_`. Trong Stripe Test mode, tạo webhook trỏ đến `https://ten-du-an.vercel.app/api/stripe/webhook` và đăng ký các event: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Dùng thẻ test `4242 4242 4242 4242`, ngày hết hạn trong tương lai và CVC bất kỳ.

`VNPAY_TMN_CODE` và `VNPAY_HASH_SECRET` lấy từ tài khoản VNPay Sandbox; đặt `VNPAY_HASH_SECRET` loại **Secret**. Trong cấu hình merchant VNPay, đặt Return URL là `https://ten-du-an.vercel.app/api/payments/vnpay/return` và IPN URL là `https://ten-du-an.vercel.app/api/payments/vnpay/ipn`.

4. Deploy. Migration và danh mục sản phẩm ban đầu sẽ được tạo khi API nhận request đầu tiên.
5. Đăng ký tài khoản quản trị đầu tiên rồi cấp role `admin` một lần trong Neon SQL Editor. Các quản trị viên tiếp theo có thể được cấp quyền từ Dashboard.

Sau khi deploy phiên bản này, có thể xóa hai biến cũ `NEON_AUTH_BASE_URL` và `VITE_NEON_AUTH_URL` khỏi Vercel. Không cần cấu hình secret riêng cho session vì server tạo token ngẫu nhiên, chỉ lưu SHA-256 của token trong database và gửi bản gốc bằng cookie HttpOnly/Secure.

Không commit file `.env` hoặc mật khẩu thật lên Git.

## Chạy production ngoài Vercel

```bash
npm run build
npm start
```
