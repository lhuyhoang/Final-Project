# Đối chiếu 94 test case QuadPro — 23/11/2026

Chưa thể kết luận phù hợp toàn bộ workbook. Có 3 sai lệch được tái hiện, 7 case cần cập nhật theo thiết kế mới, cùng các mục cần kiểm thử bổ sung hoặc dịch vụ thật.

Nguồn: QuadPro_Test_CasesFinal.xlsx; SHA-256: `e6b1c19824192f9ec4d75660b8b5d76cb7e6a6f8403936264e011c7566009a0b`. Baseline: `e3102bd`, cộng các thay đổi cục bộ có sẵn ở title/footer. Không sửa workbook nguồn hoặc chức năng sản phẩm trong lượt đối chiếu. Không dùng cột Pass cũ làm kết quả mới.

## Tổng hợp

- Phù hợp cục bộ: **72**
- Chưa phù hợp: **3**
- Phù hợp theo mã nguồn: **2**
- Cần cập nhật test case: **7**
- Cần kiểm thử dịch vụ thật: **6**
- Kiểm thử một phần: **4**

“Phù hợp cục bộ” nghĩa là hành vi chính đã được kiểm tra bằng API/UI hoặc bộ regression có liên quan, kết hợp đọc mã nguồn; không phải biên bản nghiệm thu từng bước trên production. Kết quả API/UI chi tiết nằm trong review.json. Các nhóm kiểm thử có thể kiểm tra một phần của nhiều case; vì vậy số probe không phải số case Pass.

## Sai lệch ưu tiên

- **VNP-08 — cao:** đơn VNPay quá hạn vẫn giữ tồn, chưa có cleanup TTL.
- **CART-02 — trung bình:** cùng cấu hình gốc thêm từ hai nơi tạo hai dòng.
- **APRD-03 — thấp:** sản phẩm mới không đứng đầu bảng sau reload dữ liệu.

## Thay đổi test case

- **CHK-03:** Wizard có noValidate và hiển thị lỗi inline, không dùng bong bóng validation gốc của browser. Trường rỗng/1 ký tự vẫn bị chặn. Đổi Expected Results thành lỗi inline, không chuyển bước và không gửi POST tạo đơn.
- **ACC-05:** Email vẫn không đổi được; API từ chối email khác và email sai định dạng. Lý do Neon Auth trong test đã lỗi thời. Đổi mô tả thành email đăng nhập của hệ thống session truyền thống; giữ các bước kiểm tra bất biến email.
- **APRD-02:** Tab Sản phẩm hiện là cây thư mục danh mục, sau đó bảng của thư mục được mở; không còn bảng phẳng toàn bộ kho. Thêm bước mở danh mục cha/con; kiểm tra tìm thư mục ở cấp đầu, tìm sản phẩm và phân trang 15 dòng trong thư mục.
- **AORD-07:** Thanh toán online nằm trong tab Thanh toán kết hợp với tổng quan Stripe, bảng đơn đã thanh toán nằm phía dưới. Đổi đường dẫn UI sang Thanh toán; giữ kiểm tra giao dịch, thời điểm thanh toán, doanh thu và badge. Badge đọc/chưa đọc chưa được tái hiện đầy đủ trong lượt này.
- **AORD-08:** Khóa tài khoản thu hồi toàn bộ session. Mở khóa không làm cookie cũ sống lại: API vẫn 401 cho tới khi đăng nhập lại. Sau mở khóa, thêm bước login mới rồi xác nhận 200. Không yêu cầu hồi sinh session đã thu hồi.
- **AORD-10:** Stripe Sandbox không còn là tab riêng; báo cáo Stripe đã nằm trong tab Thanh toán. UI lỗi nhà cung cấp và các tab khác vẫn hoạt động. Đổi bước sang Thanh toán; cần kiểm tra riêng với key test thật hợp lệ và cấu hình không có key. Lượt này dùng provider giả lập lỗi.
- **SEC-04:** Ứng dụng dùng cookie session, không đọc Authorization: Bearer. Đã kiểm tra cookie session giả/hết hiệu lực trả 401. Dùng cookie thiếu/sai/hết hạn trong test; không dùng tiền tố Bearer để xác nhận một phiên hợp lệ.

## Bằng chứng và giới hạn

- Build production thành công; 50 unit tests và các bộ test password/access/reset/contact/promotions/appearance đều qua.
- Bộ final-cases-review kiểm tra API trên PGlite và UI trên Edge với cookie HttpOnly thật của fixture, gồm F5, bàn phím, mobile 375 px, chống double click, Stripe signature và VNPay callback.
- Stripe/VNPay/Cloudinary là môi trường giả lập; chữ ký webhook Stripe được tạo/kiểm tra offline bằng SDK. Không tạo đơn/thu tiền/gửi email/sửa dữ liệu production.
- VNP-08 được kiểm tra bằng cách làm cũ created_at 20 phút trong DB cô lập, cộng rà soát không có job hết hạn. Chưa chờ trên trang VNPay thật.
- Các thông báo tiếng Việt tương đương ý nghĩa được chấp nhận; không yêu cầu trùng chữ với chuỗi tiếng Anh trong workbook.
- Kiểm tra dữ liệu ảnh/link đang có trên production, merchant thật, preset Cloudinary và webhook delivery ngoài mạng vẫn cần chạy riêng.
- Hai vấn đề ngoài phạm vi 94 case từ báo cáo cũ (tồn linh kiện nâng cấp và URL ảnh nguồn) chưa được coi là đã xử lý.

## Ma trận đủ 94 case

| ID | Test case | Kết luận | Bằng chứng / điểm cần xử lý | Dòng nguồn |
|---|---|---|---|---|
| AUTH-01 | Authentication — Open login popup when not logged in | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 16 |
| AUTH-02 | Authentication — Register with valid new account details | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 36 |
| AUTH-03 | Authentication — Reject registration with an existing email | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 57 |
| AUTH-04 | Authentication — Customer login with valid credentials | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 77 |
| AUTH-05 | Authentication — Reject login with an incorrect password | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 98 |
| AUTH-06 | Authentication — Admin login and dashboard redirect | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 118 |
| AUTH-07 | Authentication — Log out from account or admin page | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 139 |
| AUTH-08 | Authentication — Preserve login session after page reload | Phù hợp cục bộ | AuthModal, main.jsx, index.js: session cookie HttpOnly; đã kiểm tra API đăng ký/login và UI login, F5, chặn /admin cho customer, logout. | 159 |
| PRD-01 | Product Browsing — Load homepage product catalogue | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 182 |
| PRD-02 | Product Browsing — Fallback products when backend is unavailable | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 203 |
| PRD-03 | Product Browsing — Search products by name, brand, or category | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 225 |
| PRD-04 | Product Browsing — Display no-results state | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 246 |
| PRD-05 | Product Browsing — Desktop product quick view | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 266 |
| PRD-06 | Product Browsing — Keyboard-accessible quick view | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 286 |
| PRD-07 | Product Browsing — Quick-view viewport positioning | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 305 |
| PRD-08 | Product Browsing — Open product detail page | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 325 |
| PRD-09 | Product Browsing — Handle out-of-stock products | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 345 |
| PRD-10 | Product Browsing — Enforce purchase quantity limits | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 366 |
| PRD-11 | Product Browsing — Handle invalid product URL | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 388 |
| PRD-12 | Product Browsing — Show and navigate related products | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 408 |
| PRD-13 | Product Browsing — Filter and sort laptop category | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 428 |
| PRD-14 | Product Browsing — Browser Back and Forward navigation | Phù hợp cục bộ | main.jsx, ProductDetail.jsx: đã kiểm tra UI tìm kiếm, popup hover/bàn phím, chi tiết, giới hạn số lượng, related, URL không tồn tại và Back/Forward bằng fixture cục bộ. | 448 |
| CART-01 | Shopping Cart — Add an in-stock product to the cart | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 471 |
| CART-02 | Shopping Cart — Merge duplicate products into one row | Chưa phù hợp | Thêm cùng sản phẩm từ trang chi tiết rồi từ thẻ trang chủ tạo 2 dòng dù không chọn nâng cấp. Chuẩn hóa cartKey của cấu hình gốc ở mọi nơi thêm vào giỏ; giữ tách dòng cho cấu hình nâng cấp khác nhau. | 492 |
| CART-03 | Shopping Cart — Add multiple units from the detail page | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 513 |
| CART-04 | Shopping Cart — Buy Now opens the cart drawer | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 534 |
| CART-05 | Shopping Cart — Disable add to cart for out-of-stock products | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 554 |
| CART-06 | Shopping Cart — Increase and decrease item quantity | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 574 |
| CART-07 | Shopping Cart — Remove item by decreasing quantity below one | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 594 |
| CART-08 | Shopping Cart — Remove item with the trash can icon | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 614 |
| CART-09 | Shopping Cart — Persist cart after page reload | Phù hợp cục bộ | main.jsx: đã kiểm tra UI thêm, gộp cùng điểm thêm, tăng/giảm, xóa, Buy Now, số lượng từ chi tiết và Local Storage sau F5. | 634 |
| CART-10 | Shopping Cart — Display the empty cart state | Phù hợp theo mã nguồn | Đã kiểm tra xóa hết sản phẩm; mã nguồn có thông báo giỏ trống và nút tiếp tục mua. Subtotal nội bộ bằng 0 nhưng không hiển thị hàng Tạm tính khi giỏ trống. Nếu bắt buộc nhìn thấy số 0₫, cần bổ sung UI hoặc chỉnh Expected Results; chạy riêng nút Tiếp tục mua sắm. | 655 |
| CHK-01 | Checkout & COD — Require login before checkout | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 678 |
| CHK-02 | Checkout & COD — Open checkout with auto-filled customer info | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 698 |
| CHK-03 | Checkout & COD — Validate required full name | Cần cập nhật test case | Wizard có noValidate và hiển thị lỗi inline, không dùng bong bóng validation gốc của browser. Trường rỗng/1 ký tự vẫn bị chặn. Đổi Expected Results thành lỗi inline, không chuyển bước và không gửi POST tạo đơn. | 719 |
| CHK-04 | Checkout & COD — Validate phone number format | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 740 |
| CHK-05 | Checkout & COD — Validate minimum address length | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 762 |
| CHK-06 | Checkout & COD — Place a COD order successfully | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 783 |
| CHK-07 | Checkout & COD — Reject order quantity greater than stock | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 805 |
| CHK-08 | Checkout & COD — Reject excessive quantity via API | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 826 |
| CHK-09 | Checkout & COD — Prevent duplicate orders on double click | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 848 |
| CHK-10 | Checkout & COD — Reject order with empty cart via API | Phù hợp cục bộ | CheckoutWizard.jsx + API /api/orders: đã kiểm tra thông tin nhận hàng, validation, chống bấm hai lần và giao dịch tồn kho trên PGlite. | 869 |
| STR-01 | Stripe Payment — Redirect to Stripe Checkout | Cần kiểm thử dịch vụ thật | Đã xác minh API tạo session, URL redirect giả lập, đơn unpaid và giữ tồn; chưa mở Stripe hosted Checkout thật. Dùng Stripe Test mode, so giỏ với trang hosted và kiểm tra cấu hình domain/webhook. | 893 |
| STR-02 | Stripe Payment — Pay successfully with a test card | Cần kiểm thử dịch vụ thật | Backend xác nhận paid/confirmed đã được kiểm thử cục bộ, nhưng chưa dùng thẻ 4242 trên Stripe hosted Checkout trong lượt này. Chạy thanh toán test end-to-end, return, xóa giỏ và bảng giao dịch. | 915 |
| STR-03 | Stripe Payment — Handle a declined card | Cần kiểm thử dịch vụ thật | Thông báo card declined nằm ở Stripe hosted Checkout; chưa thực hiện bằng thẻ declined thật trong test mode. Kiểm tra thẻ declined, giữ unpaid và retry thẻ 4242 trên cùng session. | 937 |
| STR-04 | Stripe Payment — Cancel payment on the Stripe page | Phù hợp cục bộ | API Stripe dùng session giả lập; webhook kiểm tra bằng Stripe SDK và chữ ký HMAC thật tạo offline, có kiểm tra trùng event và hoàn tồn. | 958 |
| STR-05 | Stripe Payment — Cancel payment after losing login session | Phù hợp cục bộ | API Stripe dùng session giả lập; webhook kiểm tra bằng Stripe SDK và chữ ký HMAC thật tạo offline, có kiểm tra trùng event và hoàn tồn. | 980 |
| STR-06 | Stripe Payment — Webhook marks order paid when tab is closed | Phù hợp cục bộ | API Stripe dùng session giả lập; webhook kiểm tra bằng Stripe SDK và chữ ký HMAC thật tạo offline, có kiểm tra trùng event và hoàn tồn. | 1000 |
| STR-07 | Stripe Payment — Handle expired Stripe session | Phù hợp cục bộ | API Stripe dùng session giả lập; webhook kiểm tra bằng Stripe SDK và chữ ký HMAC thật tạo offline, có kiểm tra trùng event và hoàn tồn. | 1020 |
| STR-08 | Stripe Payment — Validate webhook signature and duplicate events | Phù hợp cục bộ | API Stripe dùng session giả lập; webhook kiểm tra bằng Stripe SDK và chữ ký HMAC thật tạo offline, có kiểm tra trùng event và hoàn tồn. | 1041 |
| VNP-01 | VNPay Payment — Redirect to VNPay sandbox | Cần kiểm thử dịch vụ thật | API tạo URL sandbox ký hợp lệ, đơn unpaid và giữ tồn đã được xác minh cục bộ; chưa mở merchant sandbox thật. Kiểm tra URL/merchant/domain sandbox và dữ liệu hiển thị ở VNPay. | 1066 |
| VNP-02 | VNPay Payment — Pay successfully with sandbox test card | Cần kiểm thử dịch vụ thật | IPN/return ký hợp lệ xử lý paid đã có mã nguồn và kiểm thử callback cục bộ; chưa thanh toán thẻ sandbox thật. Chạy thẻ sandbox với merchant thật, return/IPN và xóa giỏ. | 1088 |
| VNP-03 | VNPay Payment — Cancel or fail payment on VNPay | Phù hợp cục bộ | API VNPay dùng callback ký SHA-512 cục bộ; đã kiểm tra checksum sai, amount sai, IPN lặp và return thất bại hoàn tồn. | 1109 |
| VNP-04 | VNPay Payment — Detect tampered return URL | Phù hợp cục bộ | API VNPay dùng callback ký SHA-512 cục bộ; đã kiểm tra checksum sai, amount sai, IPN lặp và return thất bại hoàn tồn. | 1130 |
| VNP-05 | VNPay Payment — Detect tampered payment amount | Phù hợp cục bộ | API VNPay dùng callback ký SHA-512 cục bộ; đã kiểm tra checksum sai, amount sai, IPN lặp và return thất bại hoàn tồn. | 1150 |
| VNP-06 | VNPay Payment — Handle duplicate IPN calls | Phù hợp cục bộ | API VNPay dùng callback ký SHA-512 cục bộ; đã kiểm tra checksum sai, amount sai, IPN lặp và return thất bại hoàn tồn. | 1170 |
| VNP-07 | VNPay Payment — Reject IPN with incorrect checksum | Phù hợp cục bộ | API VNPay dùng callback ký SHA-512 cục bộ; đã kiểm tra checksum sai, amount sai, IPN lặp và return thất bại hoàn tồn. | 1190 |
| VNP-08 | VNPay Payment — Handle unpaid VNPay session timeout | Chưa phù hợp | Đã tạo đơn VNPay, cho created_at lùi 20 phút và đọc lại: đơn vẫn pending/unpaid, tồn vẫn bị giữ. Không có job cleanup TTL. Lưu hạn thanh toán và thêm xử lý hết hạn/hoàn tồn idempotent. Chưa kiểm tra hành vi trang VNPay thật sau 15 phút. | 1210 |
| ACC-01 | User Account — Open account settings | Phù hợp cục bộ | AccountSettings.jsx + PUT/GET /api/auth/me: đã kiểm tra lưu profile, từ chối phone/landline/email sai và checkout điền profile mới. | 1234 |
| ACC-02 | User Account — Update profile with valid information | Phù hợp cục bộ | AccountSettings.jsx + PUT/GET /api/auth/me: đã kiểm tra lưu profile, từ chối phone/landline/email sai và checkout điền profile mới. | 1254 |
| ACC-03 | User Account — Validate mobile phone number format | Phù hợp cục bộ | AccountSettings.jsx + PUT/GET /api/auth/me: đã kiểm tra lưu profile, từ chối phone/landline/email sai và checkout điền profile mới. | 1274 |
| ACC-04 | User Account — Validate landline phone number format | Phù hợp cục bộ | AccountSettings.jsx + PUT/GET /api/auth/me: đã kiểm tra lưu profile, từ chối phone/landline/email sai và checkout điền profile mới. | 1294 |
| ACC-05 | User Account — Prevent email change via API | Cần cập nhật test case | Email vẫn không đổi được; API từ chối email khác và email sai định dạng. Lý do Neon Auth trong test đã lỗi thời. Đổi mô tả thành email đăng nhập của hệ thống session truyền thống; giữ các bước kiểm tra bất biến email. | 1314 |
| ACC-06 | User Account — Auto-fill checkout with updated address | Phù hợp cục bộ | AccountSettings.jsx + PUT/GET /api/auth/me: đã kiểm tra lưu profile, từ chối phone/landline/email sai và checkout điền profile mới. | 1335 |
| APRD-01 | Admin: Products — Block non-admin access to /admin | Phù hợp cục bộ | AdminDashboard.jsx + CRUD API: API kiểm tra trường bắt buộc, ASUS viết hoa, discount, giá niêm yết, sửa và snapshot sau xóa; UI kiểm tra thêm sản phẩm và upload giả lập. | 1358 |
| APRD-02 | Admin: Products — Search products in admin table | Cần cập nhật test case | Tab Sản phẩm hiện là cây thư mục danh mục, sau đó bảng của thư mục được mở; không còn bảng phẳng toàn bộ kho. Thêm bước mở danh mục cha/con; kiểm tra tìm thư mục ở cấp đầu, tìm sản phẩm và phân trang 15 dòng trong thư mục. | 1379 |
| APRD-03 | Admin: Products — Add a product with valid information | Chưa phù hợp | Sản phẩm mới được lưu đúng nhưng không đứng đầu bảng sau loadDashboard(): UI tạm prepend rồi API trả ORDER BY id ASC. Sắp xếp nhất quán để sản phẩm mới đứng đầu thư mục, hoặc sửa kỳ vọng nếu chấp nhận thứ tự tăng dần. | 1401 |
| APRD-04 | Admin: Products — Reject product with missing required data | Phù hợp cục bộ | AdminDashboard.jsx + CRUD API: API kiểm tra trường bắt buộc, ASUS viết hoa, discount, giá niêm yết, sửa và snapshot sau xóa; UI kiểm tra thêm sản phẩm và upload giả lập. | 1422 |
| APRD-05 | Admin: Products — Calculate discount from list and selling price | Phù hợp cục bộ | AdminDashboard.jsx + CRUD API: API kiểm tra trường bắt buộc, ASUS viết hoa, discount, giá niêm yết, sửa và snapshot sau xóa; UI kiểm tra thêm sản phẩm và upload giả lập. | 1443 |
| APRD-06 | Admin: Products — Handle list price lower than selling price | Phù hợp cục bộ | AdminDashboard.jsx + CRUD API: API kiểm tra trường bắt buộc, ASUS viết hoa, discount, giá niêm yết, sửa và snapshot sau xóa; UI kiểm tra thêm sản phẩm và upload giả lập. | 1464 |
| APRD-07 | Admin: Products — Edit product price and stock | Kiểm thử một phần | API sửa giá/tồn và lưu DB đã qua; UI xem chi tiết/giới hạn stock đã qua, nhưng chưa thao tác trọn form Edit rồi kiểm tra storefront trong cùng kịch bản. Chạy thêm toàn bộ luồng sửa qua dashboard, F5 rồi mở chi tiết tương ứng. | 1484 |
| APRD-08 | Admin: Products — Upload a valid product image | Cần kiểm thử dịch vụ thật | UI đã kiểm tra chọn JPG, upload request, điền URL/preview và lưu bằng Cloudinary mock. Chưa xác minh preset/quyền Cloudinary thật. Upload 1 ảnh thử qua cấu hình Cloudinary hiện dùng; xác minh URL tồn tại sau reload. | 1505 |
| APRD-09 | Admin: Products — Reject invalid image upload | Phù hợp cục bộ | AdminDashboard.jsx + CRUD API: API kiểm tra trường bắt buộc, ASUS viết hoa, discount, giá niêm yết, sửa và snapshot sau xóa; UI kiểm tra thêm sản phẩm và upload giả lập. | 1526 |
| APRD-10 | Admin: Products — Cancel and confirm product deletion | Kiểm thử một phần | API DELETE, quyền customer 403 và snapshot đơn cũ sau xóa đã qua. Chưa tự động chạy cả hai nhánh Cancel/Confirm của popup trong lượt này. Chạy thêm nhánh Hủy rồi Xóa của popup, kiểm tra storefront và lịch sử đơn. | 1547 |
| AORD-01 | Admin: Orders, Users & Stats — Search orders by ID or customer name | Phù hợp theo mã nguồn | visibleOrders lọc theo id, tên/email khách; UI bảng Orders đã mở, nhưng chưa chạy riêng mọi từ khóa và clear search của case. Chạy bổ sung 3 bước tìm/không có kết quả/xóa truy vấn bằng UI. | 1572 |
| AORD-02 | Admin: Orders, Users & Stats — Progress a COD order to Completed | Phù hợp cục bộ | AdminDashboard.jsx, db.js: đã kiểm tra tăng doanh thu COD delivered, hủy/khôi phục tồn kho, cấm hủy online paid và khóa dropdown unpaid. | 1593 |
| AORD-03 | Admin: Orders, Users & Stats — Cancel a COD order and restore stock | Phù hợp cục bộ | AdminDashboard.jsx, db.js: đã kiểm tra tăng doanh thu COD delivered, hủy/khôi phục tồn kho, cấm hủy online paid và khóa dropdown unpaid. | 1613 |
| AORD-04 | Admin: Orders, Users & Stats — Reopen a cancelled order | Phù hợp cục bộ | AdminDashboard.jsx, db.js: đã kiểm tra tăng doanh thu COD delivered, hủy/khôi phục tồn kho, cấm hủy online paid và khóa dropdown unpaid. | 1633 |
| AORD-05 | Admin: Orders, Users & Stats — Lock status of unpaid online orders | Phù hợp cục bộ | AdminDashboard.jsx, db.js: đã kiểm tra tăng doanh thu COD delivered, hủy/khôi phục tồn kho, cấm hủy online paid và khóa dropdown unpaid. | 1654 |
| AORD-06 | Admin: Orders, Users & Stats — Prevent cancelling paid online orders | Phù hợp cục bộ | AdminDashboard.jsx, db.js: đã kiểm tra tăng doanh thu COD delivered, hủy/khôi phục tồn kho, cấm hủy online paid và khóa dropdown unpaid. | 1675 |
| AORD-07 | Admin: Orders, Users & Stats — Show Online Payments notification | Cần cập nhật test case | Thanh toán online nằm trong tab Thanh toán kết hợp với tổng quan Stripe, bảng đơn đã thanh toán nằm phía dưới. Đổi đường dẫn UI sang Thanh toán; giữ kiểm tra giao dịch, thời điểm thanh toán, doanh thu và badge. Badge đọc/chưa đọc chưa được tái hiện đầy đủ trong lượt này. | 1696 |
| AORD-08 | Admin: Orders, Users & Stats — Lock and unlock customer accounts | Cần cập nhật test case | Khóa tài khoản thu hồi toàn bộ session. Mở khóa không làm cookie cũ sống lại: API vẫn 401 cho tới khi đăng nhập lại. Sau mở khóa, thêm bước login mới rồi xác nhận 200. Không yêu cầu hồi sinh session đã thu hồi. | 1716 |
| AORD-09 | Admin: Orders, Users & Stats — Verify Overview statistics | Kiểm thử một phần | Đã kiểm tra delta totalRevenue bằng đúng tổng đơn COD delivered. Query tổng số khách/đơn, low-stock và chart 7 ngày đã đọc mã nguồn. Cần bộ dữ liệu ngày cố định để đối chiếu độc lập toàn bộ chỉ số và chart, gồm múi giờ. | 1738 |
| AORD-10 | Admin: Orders, Users & Stats — Stripe Sandbox tab with and without keys | Cần cập nhật test case | Stripe Sandbox không còn là tab riêng; báo cáo Stripe đã nằm trong tab Thanh toán. UI lỗi nhà cung cấp và các tab khác vẫn hoạt động. Đổi bước sang Thanh toán; cần kiểm tra riêng với key test thật hợp lệ và cấu hình không có key. Lượt này dùng provider giả lập lỗi. | 1757 |
| SEC-01 | Security & Non-Functional — Protect pages for unauthenticated users | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1782 |
| SEC-02 | Security & Non-Functional — Block admin API for customer token | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1802 |
| SEC-03 | Security & Non-Functional — Require token to create an order | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1824 |
| SEC-04 | Security & Non-Functional — Reject invalid or expired token | Cần cập nhật test case | Ứng dụng dùng cookie session, không đọc Authorization: Bearer. Đã kiểm tra cookie session giả/hết hiệu lực trả 401. Dùng cookie thiếu/sai/hết hạn trong test; không dùng tiền tố Bearer để xác nhận một phiên hợp lệ. | 1845 |
| SEC-05 | Security & Non-Functional — Protect other customers' Stripe orders | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1866 |
| SEC-06 | Security & Non-Functional — Protect other customers' Stripe sessions | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1887 |
| SEC-07 | Security & Non-Functional — Apply API rate limiting | Kiểm thử một phần | Đã gửi 181 request/IP cô lập: request vượt hạn trả 429; RateLimit-Limit, Remaining, Reset tồn tại. Chưa chờ đủ 60 giây để thử lại. Chờ hết cửa sổ rồi gọi lại xác nhận 200; kiểm tra trust proxy theo môi trường triển khai. | 1908 |
| SEC-08 | Security & Non-Functional — Resist SQL injection input | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1929 |
| SEC-09 | Security & Non-Functional — Responsive layout at 375 px | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1950 |
| SEC-10 | Security & Non-Functional — Persist light/dark theme | Phù hợp cục bộ | Cookie HttpOnly, SQL tham số hóa, kiểm tra quyền API và kiểm thử Edge 375 px; không chạy tấn công hoặc ghi dữ liệu trên production. | 1971 |

## Chạy lại

Mở Vite như phần Kiểm thử trong README rồi chạy `REVIEW_UI=1 node server/test/final-cases-review.integration.mjs` (PowerShell: `$env:REVIEW_UI='1'` trước lệnh node). Sau đó chạy `node scripts/review-test-cases.mjs <đường-dẫn-file-xlsx>` để dựng lại các bản báo cáo. Script review xác minh các hành vi hiện tại và ghi nhận gap; exit 0 không có nghĩa là 94/94 đạt.
