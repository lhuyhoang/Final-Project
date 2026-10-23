ALTER TABLE products
  ADD COLUMN gallery JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE products
  ADD CONSTRAINT products_gallery_array CHECK (JSONB_TYPEOF(gallery) = 'array');
