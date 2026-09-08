# QuadPro E-commerce

Storefront linh kiện máy tính theo hướng Level 3: React + Node.js REST API, JWT, rate limiting, giỏ hàng, tìm kiếm, lọc và checkout giả lập.

## Chạy local

```bash
npm install
npm run db:init
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Admin Dashboard: `http://localhost:5173/admin` khi chạy dev
- Tài khoản demo: `demo@quadpro.vn` / `Quadpro123`
- Tài khoản quản trị: `admin@quadpro.vn` / `Admin@123`

## PostgreSQL 17

1. Bảo đảm PostgreSQL 17 đang lắng nghe tại `localhost:5433`.
2. Trong pgAdmin, đăng ký server với Host `localhost`, Port `5433`, Maintenance database `postgres`, Username `postgres` và mật khẩu PostgreSQL đã đặt khi cài đặt.
3. Điền mật khẩu đó vào `DB_PASSWORD` trong `server/.env`. Có thể dùng `DATABASE_URL` thay cho nhóm biến `DB_*`.
4. Chạy `npm run db:init` từ thư mục gốc.

`db:init` kết nối vào `DB_ADMIN_DATABASE`, tạo database `quadpro_ecom` nếu chưa có, chạy migration, rồi nhập `server/data/store.json` chỉ khi cả bốn bảng dữ liệu đều trống. Chạy lại lệnh này không nhập trùng dữ liệu.

## API chính

- `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/me`, `PUT /api/auth/password`
- `GET /api/products`, `POST /api/orders`, `GET /api/orders`
- `/api/admin/*`: thống kê, CRUD sản phẩm, đơn hàng và người dùng; bắt buộc JWT role `admin`

## Upload ảnh Cloudinary

1. Trong Cloudinary, tạo một upload preset và đặt Signing Mode là `Unsigned`.
2. Sao chép `client/.env.example` thành `client/.env`.
3. Điền `VITE_CLOUDINARY_CLOUD_NAME` và `VITE_CLOUDINARY_UPLOAD_PRESET`, sau đó khởi động lại Vite.
4. Trong form thêm hoặc sửa sản phẩm, chọn **Chọn hình ảnh**. URL Cloudinary sẽ tự động được điền sau khi upload thành công.

Chỉ đưa Cloud name và unsigned preset vào frontend. Không thêm Cloudinary API Secret vào biến `VITE_*`. Nên giới hạn định dạng, dung lượng và thư mục đích trong cấu hình upload preset.

## Production

```bash
npm run build
npm start
```

Server Express phục vụ luôn bản build React. Sao chép `server/.env.example` thành `server/.env`, cấu hình PostgreSQL và thay JWT secret trước khi deploy.

> Đổi ngay `ADMIN_PASSWORD` và `JWT_SECRET` trước khi đưa lên môi trường public. `DATA_FILE` chỉ là nguồn nhập dữ liệu JSON cũ cho `db:init`.
