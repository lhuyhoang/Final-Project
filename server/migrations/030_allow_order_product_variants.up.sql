-- A PC may appear on multiple lines with different upgrade selections.
-- The existing (order_id, line_number) primary key still identifies each line.
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_once;
