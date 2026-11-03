ALTER TABLE vouchers ADD COLUMN max_uses INTEGER CHECK (max_uses BETWEEN 1 AND 1000000);
ALTER TABLE vouchers ADD COLUMN expires_at TIMESTAMPTZ;
CREATE INDEX orders_active_voucher_usage_idx ON orders (voucher_code, user_id)
WHERE voucher_code IS NOT NULL AND (status <> 'cancelled' OR payment_status = 'paid');
