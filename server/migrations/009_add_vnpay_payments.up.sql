ALTER TABLE orders
  DROP CONSTRAINT orders_payment_method_valid,
  ADD CONSTRAINT orders_payment_method_valid
    CHECK (payment_method IN ('cod', 'stripe', 'vnpay'));

ALTER TABLE orders
  ADD COLUMN vnpay_transaction_no TEXT,
  ADD COLUMN vnpay_bank_code VARCHAR(30),
  ADD CONSTRAINT orders_vnpay_transaction_no_key UNIQUE (vnpay_transaction_no);

