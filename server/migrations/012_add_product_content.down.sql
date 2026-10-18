ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_highlights_array,
  DROP CONSTRAINT IF EXISTS products_specifications_array,
  DROP COLUMN IF EXISTS highlights,
  DROP COLUMN IF EXISTS specifications;
