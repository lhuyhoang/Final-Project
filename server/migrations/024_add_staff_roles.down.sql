UPDATE users SET role = 'customer', staff_role_id = NULL WHERE role = 'staff';
ALTER TABLE users DROP CONSTRAINT users_staff_role_valid;
ALTER TABLE users DROP CONSTRAINT users_role_valid;
ALTER TABLE users ADD CONSTRAINT users_role_valid CHECK (role IN ('admin', 'customer'));
ALTER TABLE users DROP COLUMN staff_role_id;
DROP TABLE staff_roles;
