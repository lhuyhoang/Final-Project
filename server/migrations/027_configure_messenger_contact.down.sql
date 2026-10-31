UPDATE store_settings
SET value = jsonb_set(value::jsonb, '{messengerUrl}', '""'::jsonb)::text,
    updated_at = NOW()
WHERE key = 'shop_contact_info'
  AND value::jsonb ->> 'messengerUrl' = 'https://m.me/aaa';
