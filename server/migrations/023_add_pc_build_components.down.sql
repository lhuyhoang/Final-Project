ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_pc_components_array,
  DROP COLUMN IF EXISTS pc_components;
