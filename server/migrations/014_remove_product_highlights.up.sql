ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_highlights_array,
  DROP COLUMN IF EXISTS highlights;
