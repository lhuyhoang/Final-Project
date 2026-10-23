CREATE TABLE store_settings (
  key VARCHAR(80) PRIMARY KEY,
  value VARCHAR(500) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_settings_key_not_blank CHECK (BTRIM(key) <> ''),
  CONSTRAINT store_settings_value_not_blank CHECK (BTRIM(value) <> '')
);

INSERT INTO store_settings (key, value)
VALUES ('product_gallery_interval_seconds', '5')
ON CONFLICT (key) DO NOTHING;
