INSERT INTO store_settings (key, value)
VALUES
  ('product_gallery_transition', 'slide'),
  ('product_gallery_duration_ms', '480'),
  ('product_carousel_transition', 'slide'),
  ('product_carousel_duration_ms', '860'),
  ('product_carousel_easing', 'smooth')
ON CONFLICT (key) DO NOTHING;
