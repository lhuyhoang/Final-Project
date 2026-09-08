ALTER TABLE products
  ADD COLUMN policy_text VARCHAR(120) NOT NULL DEFAULT 'Trả góp 0% • Bảo hành 36 tháng',
  ADD CONSTRAINT products_policy_text_not_blank CHECK (BTRIM(policy_text) <> '');
