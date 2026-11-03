DROP INDEX IF EXISTS orders_active_voucher_usage_idx;
ALTER TABLE vouchers DROP COLUMN expires_at, DROP COLUMN max_uses;
