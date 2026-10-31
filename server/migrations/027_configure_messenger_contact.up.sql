UPDATE store_settings
SET value = jsonb_set(value::jsonb, '{messengerUrl}', '"https://m.me/aaa"'::jsonb)::text,
    updated_at = NOW()
WHERE key = 'shop_contact_info'
  AND COALESCE(value::jsonb ->> 'messengerUrl', '') = '';
