DELETE FROM store_settings
WHERE key IN (
  'product_gallery_transition',
  'product_gallery_duration_ms',
  'product_carousel_transition',
  'product_carousel_duration_ms',
  'product_carousel_easing'
);
