# QuadPro E-commerce

Storefront linh kiện máy tính dùng React, Node.js REST API, PostgreSQL, Neon Auth, rate limiting, giỏ hàng, tìm kiếm và lọc sản phẩm.

## Chạy local

```bash
npm install
npm run db:init
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Admin Dashboard: `http://localhost:5173/admin` khi chạy dev

Ứng dụng không chứa tài khoản đăng nhập mặc định. Hãy tạo người dùng trong Neon Auth rồi chọn **Make admin** trong Neon Console để cấp quyền quản trị. Lần đăng nhập đầu tiên sẽ tự tạo và liên kết hồ sơ QuadPro tương ứng.

## PostgreSQL 17

1. Bảo đảm PostgreSQL 17 đang lắng nghe tại `localhost:5433`.
2. Trong pgAdmin, đăng ký server với Host `localhost`, Port `5433`, Maintenance database `postgres`, Username `postgres` và mật khẩu PostgreSQL đã đặt khi cài đặt.
3. Điền mật khẩu đó vào `DB_PASSWORD` trong `server/.env`. Có thể dùng `DATABASE_URL` thay cho nhóm biến `DB_*`.
4. Chạy `npm run db:init` từ thư mục gốc.

`db:init` kết nối vào `DB_ADMIN_DATABASE`, tạo database `quadpro_ecom` nếu chưa có, chạy migration, rồi nhập danh mục ban đầu từ `server/data/store.json` chỉ khi cả bốn bảng dữ liệu đều trống. Chạy lại lệnh này không nhập trùng dữ liệu.

## API chính

- Đăng ký, đăng nhập, đổi mật khẩu và đăng xuất được xử lý trực tiếp bởi Neon Auth
- `GET/PUT /api/auth/me`: đồng bộ và cập nhật hồ sơ QuadPro
- `GET /api/products`, `POST /api/orders`, `GET /api/orders`
- `/api/admin/*`: thống kê, CRUD sản phẩm, đơn hàng và người dùng; bắt buộc Neon Auth JWT có quyền `admin`

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
NEON_AUTH_BASE_URL=https://...neon.tech/neondb/auth
VITE_NEON_AUTH_URL=https://...neon.tech/neondb/auth
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...
```

`NEON_AUTH_BASE_URL` và `VITE_NEON_AUTH_URL` cùng dùng **Auth URL**, không dùng JWKS URL. `VITE_NEON_AUTH_URL` là cấu hình frontend công khai; đặt loại **Config** trên Vercel.

4. Trong Neon Auth, thêm chính xác origin `https://ten-du-an.vercel.app` vào **Trusted domains**.
5. Deploy. Migration và danh mục sản phẩm ban đầu sẽ được tạo khi API nhận request đầu tiên.
6. Tạo tài khoản quản trị trong Neon Auth, chọn **Make admin**, rồi đăng nhập website bằng tài khoản đó.

Không commit file `.env` hoặc mật khẩu thật lên Git.

## Chạy production ngoài Vercel

```bash
npm run build
npm start
```
