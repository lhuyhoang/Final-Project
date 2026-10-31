DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM staff_roles WHERE permissions ? 'promotions' AND JSONB_ARRAY_LENGTH(permissions) = 1) THEN
    RAISE EXCEPTION 'Assign an existing permission to promotion-only staff roles before rolling back this migration';
  END IF;
END $$;
DELETE FROM store_settings WHERE key = 'flash_sale';
ALTER TABLE orders DROP COLUMN discount_amount, DROP COLUMN voucher_code;
DROP TABLE vouchers;
ALTER TABLE staff_roles DROP CONSTRAINT staff_roles_permissions_valid;
UPDATE staff_roles SET permissions = permissions - 'promotions' WHERE permissions ? 'promotions';
ALTER TABLE staff_roles ADD CONSTRAINT staff_roles_permissions_valid CHECK (
  JSONB_TYPEOF(permissions) = 'array'
  AND JSONB_ARRAY_LENGTH(permissions) BETWEEN 1 AND 8
  AND permissions <@ '["overview", "inventory", "products", "categories", "showrooms", "orders", "online-payments", "settings"]'::jsonb
);
