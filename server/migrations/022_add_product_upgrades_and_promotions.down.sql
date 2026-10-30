ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_upgrade_options_array,
  DROP CONSTRAINT IF EXISTS products_promotions_array,
  DROP COLUMN IF EXISTS upgrade_options,
  DROP COLUMN IF EXISTS promotions;
