ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_gallery_array,
  DROP COLUMN IF EXISTS gallery;
