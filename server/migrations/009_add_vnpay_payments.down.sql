UPDATE orders
SET payment_method = 'cod'
WHERE payment_method = 'vnpay';

ALTER TABLE orders
  DROP CONSTRAINT orders_payment_method_valid,
  ADD CONSTRAINT orders_payment_method_valid
    CHECK (payment_method IN ('cod', 'stripe'));

ALTER TABLE orders
  DROP CONSTRAINT orders_vnpay_transaction_no_key,
  DROP COLUMN vnpay_bank_code,
  DROP COLUMN vnpay_transaction_no;

