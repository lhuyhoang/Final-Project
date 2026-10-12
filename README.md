# QuadPro E-commerce

Storefront linh kiện máy tính dùng React, Node.js REST API, PostgreSQL, JWT, rate limiting, giỏ hàng, tìm kiếm và lọc sản phẩm.

## Chạy local

```bash
npm install
npm run db:init
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Admin Dashboard: `http://localhost:5173/admin` khi chạy dev

Ứng dụng không chứa tài khoản đăng nhập mặc định. Để tạo quản trị viên đầu tiên, khai báo `ADMIN_NAME`, `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong `server/.env`, rồi chạy `npm run db:init`. Mật khẩu phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường và chữ số.

## PostgreSQL 17

1. Bảo đảm PostgreSQL 17 đang lắng nghe tại `localhost:5433`.
2. Trong pgAdmin, đăng ký server với Host `localhost`, Port `5433`, Maintenance database `postgres`, Username `postgres` và mật khẩu PostgreSQL đã đặt khi cài đặt.
3. Điền mật khẩu đó vào `DB_PASSWORD` trong `server/.env`. Có thể dùng `DATABASE_URL` thay cho nhóm biến `DB_*`.
4. Chạy `npm run db:init` từ thư mục gốc.

`db:init` kết nối vào `DB_ADMIN_DATABASE`, tạo database `quadpro_ecom` nếu chưa có, chạy migration, rồi nhập danh mục ban đầu từ `server/data/store.json` chỉ khi cả bốn bảng dữ liệu đều trống. Chạy lại lệnh này không nhập trùng dữ liệu.

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

## Deploy lên Vercel

1. Import repository vào Vercel và giữ **Root Directory** là thư mục gốc.
2. Kết nối một PostgreSQL database có thể truy cập từ Vercel.
3. Thêm các biến môi trường sau cho môi trường Production:

```text
DATABASE_URL=postgresql://...
DB_SSL=true
DB_POOL_MAX=3
JWT_SECRET=chuỗi-ngẫu-nhiên-tối-thiểu-32-ký-tự
ADMIN_NAME=Tên quản trị viên
ADMIN_EMAIL=email-của-bạn
ADMIN_PASSWORD=mật-khẩu-mạnh-tối-thiểu-12-ký-tự
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...
```

4. Deploy. Migration, danh mục sản phẩm ban đầu và tài khoản quản trị sẽ được tạo khi API nhận request đầu tiên.
5. Sau khi đăng nhập quản trị thành công, có thể xóa `ADMIN_PASSWORD`, `ADMIN_EMAIL` và `ADMIN_NAME` khỏi Vercel; tài khoản đã tạo vẫn được giữ trong PostgreSQL.

Không commit file `.env` hoặc mật khẩu thật lên Git.

## Chạy production ngoài Vercel

```bash
npm run build
npm start
```
