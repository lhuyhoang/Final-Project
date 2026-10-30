# Kết nối email gửi OTP cho QuadPro

Website có luồng **Đăng nhập → Quên mật khẩu → Nhập email → Xác nhận OTP → Đặt mật khẩu mới**. Email nhận OTP phải là email đã đăng ký và tài khoản còn hoạt động.

Chọn **một** trong hai cách dưới đây. Cả hai đều dùng các biến môi trường ở server; không cần sửa frontend.

## Cách 1: Dùng Gmail khi chưa có tên miền riêng

1. Dùng một tài khoản Gmail dành riêng cho cửa hàng.
2. Trong Google Account → Security, bật Xác minh 2 bước.
3. Mở [Mật khẩu ứng dụng](https://myaccount.google.com/apppasswords), tạo một mật khẩu ứng dụng cho “QuadPro OTP”. Dùng mật khẩu ứng dụng này, không dùng mật khẩu đăng nhập Gmail.
4. Điền các giá trị sau trong Vercel → dự án QuadPro → Settings → Environment Variables. Chọn Production; nếu kiểm tra ở Preview thì cấu hình riêng cho Preview.

```dotenv
MAIL_PROVIDER=smtp
EMAIL_FROM="QuadPro <email-cua-shop@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=email-cua-shop@gmail.com
SMTP_PASS=mat-khau-ung-dung
EMAIL_OTP_SECRET=chuoi-ngau-nhien-toi-thieu-32-ky-tu
```

Trong giao diện nhập biến của Vercel, giá trị `EMAIL_FROM` là `QuadPro <email-cua-shop@gmail.com>`; không nhập thêm dấu ngoặc kép. Trong file `.env`, giữ dấu ngoặc kép như ví dụ. Nếu mật khẩu ứng dụng được Google chia thành nhiều nhóm để dễ đọc, nhập lại liền nhau.

Sinh `EMAIL_OTP_SECRET` trên máy của bạn bằng lệnh sau; sao chép kết quả vào biến cùng tên:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Không gửi giá trị thật của `SMTP_PASS` hoặc `EMAIL_OTP_SECRET` vào chat hay commit lên Git. `SMTP_SECURE=false` trên cổng 587 dùng STARTTLS; mã nguồn bắt buộc nâng cấp TLS trước khi gửi thông tin đăng nhập.

Nếu không thấy mục Mật khẩu ứng dụng, kiểm tra loại tài khoản và chính sách Google theo [hướng dẫn chính thức](https://support.google.com/accounts/answer/185833?hl=vi). Gmail có giới hạn gửi và có thể chặn đăng nhập máy chủ; khi vận hành gửi nhiều email, có thể chuyển sang dịch vụ email giao dịch bằng cách thay cấu hình.

## Cách 2: Dùng Resend với tên miền gửi mail riêng

1. Tạo tài khoản tại [Resend](https://resend.com).
2. Vào Domains, thêm tên miền hoặc tên miền con bạn sở hữu, ví dụ `mail.ten-shop.vn`. Bạn cần quyền sửa DNS của tên miền này; không dùng `quadproecom.vercel.app` làm tên miền gửi vì bạn không quản lý DNS của `vercel.app`.
3. Thêm đúng các bản ghi DNS Resend cung cấp tại nhà cung cấp tên miền. Chờ trạng thái **Verified**. Không thay thế bản ghi email hiện có bằng giá trị đoán trước.
4. Vào API Keys → tạo khóa có quyền **Sending access**, giới hạn vào tên miền vừa xác thực nếu có thể.
5. Trong Vercel → dự án → Settings → Environment Variables, thêm:

```dotenv
MAIL_PROVIDER=resend
EMAIL_FROM="QuadPro <no-reply@mail.ten-shop.vn>"
RESEND_API_KEY=re_khoa-cua-ban
EMAIL_OTP_SECRET=chuoi-ngau-nhien-toi-thieu-32-ky-tu
```

Sinh secret bằng lệnh ở cách 1. Địa chỉ trong `EMAIL_FROM` phải thuộc tên miền đã xác thực. Địa chỉ mẫu `onboarding@resend.dev` chỉ dùng thử và bị hạn chế người nhận; cần tên miền đã xác thực để gửi cho khách hàng.

Tham khảo [xác thực tên miền](https://resend.com/docs/dashboard/domains/introduction), [quản lý API key](https://resend.com/docs/dashboard/api-keys/introduction), [giới hạn người nhận của tên miền thử](https://vercel.com/academy/visual-workflow-builder-on-vercel/resend-plugin).

## Áp dụng và kiểm tra

1. Sau khi thêm hoặc sửa biến môi trường, **Redeploy** trên Vercel để bản deploy mới nhận cấu hình. Xem [hướng dẫn Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).
2. Kiểm tra với tài khoản của bạn đã đăng ký trên QuadPro: Đăng nhập → Quên mật khẩu → nhập email đó → kiểm tra Inbox/Spam.
3. Nhập đủ 6 số OTP, đặt mật khẩu mới rồi đăng nhập lại.
4. Với Resend, kiểm tra trạng thái gửi ở Emails trong dashboard. API chấp nhận gửi không đồng nghĩa email đã tới Inbox; cần kiểm tra cả email bị trả về hoặc Spam.

Để chạy local: điền cùng các biến vào `server/.env`, rồi khởi động lại server. Không đưa chúng vào `client/.env` và không đặt tiền tố `VITE_`. Nếu đổi `EMAIL_OTP_SECRET`, các mã/phiên đặt lại mật khẩu đang chờ sẽ mất hiệu lực.

Nếu gặp lỗi:

- **Chưa được cấu hình:** kiểm tra đủ biến của nhà cung cấp đã chọn và `EMAIL_OTP_SECRET`, sau đó redeploy.
- **Chưa gửi được email:** với Gmail, kiểm tra mật khẩu ứng dụng, địa chỉ gửi trùng `SMTP_USER` và cảnh báo đăng nhập Google; với Resend, kiểm tra API key và trạng thái xác thực tên miền gửi.
- **Không thấy thư:** kiểm tra Spam, email đã đăng ký trên website và log nhà cung cấp. Email chưa đăng ký không nhận OTP.
- **Mã sai/hết hạn:** dùng email mới nhất; sau 5 lần sai phải gửi mã mới. Chờ ít nhất 60 giây giữa các yêu cầu; nếu vượt 5 lần trong một giờ thì chờ hết giới hạn.

## Hành vi của hệ thống

- Mã 6 số được sinh bằng bộ sinh ngẫu nhiên bảo mật, có thể bắt đầu bằng số 0.
- OTP có hiệu lực 10 phút, tối đa 5 lần nhập sai, gửi lại cách nhau ít nhất 60 giây và tối đa 5 yêu cầu mỗi email trong một giờ. Các giới hạn theo email và số lần nhập sai được lưu trong PostgreSQL, không mất khi serverless khởi động lại.
- Gửi lại sẽ hủy mã và phiên đặt mật khẩu trước đó. Chỉ dùng mã ở email mới nhất.
- Sau khi OTP hợp lệ, người dùng có 5 phút đặt mật khẩu mới; token này chỉ giữ trong bộ nhớ trang.
- Database chỉ lưu HMAC của OTP/token; không lưu mã hay token nguyên bản. Không ghi OTP/credential gửi mail vào log.
- Phản hồi yêu cầu OTP dùng thông báo chung cho email chưa tồn tại hoặc tài khoản bị khóa; các tài khoản này không được gửi mã và không thể đặt lại mật khẩu.
- Khi đặt lại thành công, mật khẩu được băm bằng scrypt và toàn bộ session cũ bị thu hồi trong cùng transaction. OTP/token không thể dùng lại.
- Chưa cấu hình email/secret: website báo chưa sẵn sàng, không giả báo đã gửi mã.

Kiểm tra tự động bằng database PostgreSQL nhúng và email giả lập, không gửi thư thật:

```bash
npm run test:reset -w server
```
