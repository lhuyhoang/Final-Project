DELETE FROM store_settings WHERE key = 'shop_contact_info';
ALTER TABLE store_settings ALTER COLUMN value TYPE VARCHAR(500);
