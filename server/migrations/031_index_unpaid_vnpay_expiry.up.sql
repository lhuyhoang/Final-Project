CREATE INDEX orders_unpaid_vnpay_expiry_idx ON orders (created_at)
WHERE payment_method = 'vnpay' AND payment_status = 'unpaid' AND status <> 'cancelled';
