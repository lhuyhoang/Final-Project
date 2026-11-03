DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM order_items
    GROUP BY order_id, product_id_snapshot HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot roll back while orders contain multiple product variants; keep all order lines intact.';
  END IF;
END $$;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_once UNIQUE (order_id, product_id_snapshot);
