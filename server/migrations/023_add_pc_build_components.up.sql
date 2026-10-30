ALTER TABLE products
  ADD COLUMN pc_components JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD CONSTRAINT products_pc_components_array CHECK (
    JSONB_TYPEOF(pc_components) = 'array'
    AND JSONB_ARRAY_LENGTH(pc_components) <= 9
  );
