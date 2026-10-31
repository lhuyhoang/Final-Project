ALTER TABLE store_settings ALTER COLUMN value TYPE TEXT;
INSERT INTO store_settings (key, value) VALUES (
  'shop_contact_info',
  '{"phone":"0812077051","email":"quadprosupport@gmail.com","messengerUrl":"","zaloUrl":"https://zalo.me/0812077051","supportHours":"08:00 - 21:30 (Tất cả các ngày)"}'
) ON CONFLICT (key) DO NOTHING;
