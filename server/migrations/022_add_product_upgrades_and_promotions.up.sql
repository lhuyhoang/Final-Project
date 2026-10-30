ALTER TABLE products
  ADD COLUMN upgrade_options JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN promotions JSONB NOT NULL DEFAULT '["Miễn phí giao hàng cho đơn từ 500.000₫", "Hỗ trợ kiểm tra và tối ưu trước khi giao"]'::JSONB;

ALTER TABLE products
  ADD CONSTRAINT products_upgrade_options_array CHECK (JSONB_TYPEOF(upgrade_options) = 'array'),
  ADD CONSTRAINT products_promotions_array CHECK (JSONB_TYPEOF(promotions) = 'array');
