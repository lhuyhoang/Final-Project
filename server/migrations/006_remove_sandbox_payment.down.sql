ALTER TABLE orders
  DROP CONSTRAINT orders_payment_method_valid,
  ALTER COLUMN payment_method SET DEFAULT 'sandbox',
  ADD CONSTRAINT orders_payment_method_valid CHECK (payment_method IN ('cod', 'sandbox'));
