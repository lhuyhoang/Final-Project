DROP TABLE IF EXISTS stripe_webhook_events;

DROP INDEX IF EXISTS orders_payment_status_idx;

UPDATE orders
SET payment_method = 'cod'
WHERE payment_method = 'stripe';

ALTER TABLE orders
  DROP CONSTRAINT orders_payment_method_valid,
  ADD CONSTRAINT orders_payment_method_valid CHECK (payment_method = 'cod');

ALTER TABLE orders
  DROP CONSTRAINT orders_stripe_checkout_session_key,
  DROP CONSTRAINT orders_paid_at_valid,
  DROP CONSTRAINT orders_payment_status_valid,
  DROP COLUMN paid_at,
  DROP COLUMN stripe_payment_intent_id,
  DROP COLUMN stripe_checkout_session_id,
  DROP COLUMN payment_status;
