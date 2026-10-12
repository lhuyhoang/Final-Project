ALTER TABLE orders
  DROP CONSTRAINT orders_payment_method_valid,
  ADD CONSTRAINT orders_payment_method_valid CHECK (payment_method IN ('cod', 'stripe'));

ALTER TABLE orders
  ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN stripe_checkout_session_id TEXT,
  ADD COLUMN stripe_payment_intent_id TEXT,
  ADD COLUMN paid_at TIMESTAMPTZ,
  ADD CONSTRAINT orders_payment_status_valid
    CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  ADD CONSTRAINT orders_paid_at_valid
    CHECK (payment_status <> 'paid' OR paid_at IS NOT NULL),
  ADD CONSTRAINT orders_stripe_checkout_session_key UNIQUE (stripe_checkout_session_id);

UPDATE orders
SET payment_status = 'paid',
    paid_at = COALESCE(updated_at, created_at)
WHERE payment_method = 'cod'
  AND status = 'delivered';

CREATE INDEX orders_payment_status_idx
  ON orders (payment_method, payment_status, paid_at DESC);

CREATE TABLE stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stripe_webhook_events_id_not_blank CHECK (BTRIM(id) <> ''),
  CONSTRAINT stripe_webhook_events_type_not_blank CHECK (BTRIM(event_type) <> '')
);
