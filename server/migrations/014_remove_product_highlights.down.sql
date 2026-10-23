ALTER TABLE products
  ADD COLUMN IF NOT EXISTS highlights JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE products
  ADD CONSTRAINT products_highlights_array CHECK (JSONB_TYPEOF(highlights) = 'array');
