UPDATE orders
SET payment_method = 'cod'
WHERE payment_method = 'sandbox';

ALTER TABLE orders
  DROP CONSTRAINT orders_payment_method_valid,
  ALTER COLUMN payment_method SET DEFAULT 'cod',
  ADD CONSTRAINT orders_payment_method_valid CHECK (payment_method = 'cod');
