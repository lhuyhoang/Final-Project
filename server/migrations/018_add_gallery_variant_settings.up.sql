INSERT INTO store_settings (key, value)
VALUES
  ('product_gallery_variant', 'slide-right'),
  ('product_gallery_easing', 'cubic-bezier(0.25, 1, 0.5, 1)')
ON CONFLICT (key) DO NOTHING;
