DROP INDEX IF EXISTS product_categories_parent_sort_idx;

ALTER TABLE product_categories
  DROP CONSTRAINT IF EXISTS product_categories_sort_order_valid,
  DROP CONSTRAINT IF EXISTS product_categories_parent_not_self,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS show_in_showcase,
  DROP COLUMN IF EXISTS is_visible,
  DROP COLUMN IF EXISTS parent_id;

DELETE FROM product_categories AS category
WHERE category.name IN (
  'PC', 'Linh kiện điện tử', 'Gaming Gear',
  'PC văn phòng', 'PC Workstation',
  'Laptop Gaming', 'Laptop văn phòng', 'Laptop đồ họa',
  'Màn hình Gaming', 'Màn hình văn phòng', 'Màn hình đồ họa'
)
AND NOT EXISTS (
  SELECT 1 FROM products WHERE BTRIM(products.category) = BTRIM(category.name)
);
