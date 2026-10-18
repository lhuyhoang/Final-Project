ALTER TABLE products
  ADD COLUMN highlights JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN specifications JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE products
  ADD CONSTRAINT products_highlights_array CHECK (JSONB_TYPEOF(highlights) = 'array'),
  ADD CONSTRAINT products_specifications_array CHECK (JSONB_TYPEOF(specifications) = 'array');
