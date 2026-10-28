ALTER TABLE product_categories
  ADD COLUMN parent_id INTEGER REFERENCES product_categories(id) ON DELETE RESTRICT,
  ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN show_in_showcase BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT product_categories_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id),
  ADD CONSTRAINT product_categories_sort_order_valid CHECK (sort_order >= 0 AND sort_order <= 10000);

CREATE INDEX product_categories_parent_sort_idx
  ON product_categories (parent_id, sort_order, id);

INSERT INTO product_categories (name, icon, color, sort_order, is_visible, show_in_showcase)
VALUES
  ('PC', 'Monitor', '#ffe8e5', 10, TRUE, TRUE),
  ('Linh kiện điện tử', 'CircuitBoard', '#e8f7f7', 30, TRUE, TRUE),
  ('Gaming Gear', 'Headphones', '#f0edff', 50, TRUE, TRUE)
ON CONFLICT DO NOTHING;

UPDATE product_categories
SET sort_order = CASE name
  WHEN 'Laptop' THEN 20
  WHEN 'Màn hình' THEN 40
  ELSE sort_order
END
WHERE name IN ('Laptop', 'Màn hình');

UPDATE product_categories AS child
SET parent_id = parent.id,
    show_in_showcase = FALSE
FROM product_categories AS parent
WHERE parent.name = 'PC'
  AND child.name = 'PC Gaming';

UPDATE product_categories AS child
SET parent_id = parent.id,
    show_in_showcase = FALSE
FROM product_categories AS parent
WHERE parent.name = 'Linh kiện điện tử'
  AND child.name IN ('VGA - Card đồ họa', 'CPU - Bộ vi xử lý', 'Mainboard', 'RAM', 'SSD - HDD');

UPDATE product_categories AS child
SET parent_id = parent.id,
    show_in_showcase = FALSE
FROM product_categories AS parent
WHERE parent.name = 'Gaming Gear'
  AND child.name IN ('Bàn phím', 'Chuột gaming', 'Tai nghe', 'Ghế gaming');

INSERT INTO product_categories (name, icon, color, parent_id, is_visible, show_in_showcase, sort_order)
SELECT seed.name, seed.icon, seed.color, parent.id, FALSE, FALSE, seed.sort_order
FROM (VALUES
  ('PC văn phòng', 'Monitor', '#edf4ff', 'PC', 20),
  ('PC Workstation', 'Monitor', '#f2eaff', 'PC', 30),
  ('Laptop Gaming', 'Laptop', '#ffe8e5', 'Laptop', 10),
  ('Laptop văn phòng', 'Laptop', '#e8f2ff', 'Laptop', 20),
  ('Laptop đồ họa', 'Laptop', '#f2eaff', 'Laptop', 30),
  ('Màn hình Gaming', 'MonitorUp', '#ffe8e5', 'Màn hình', 10),
  ('Màn hình văn phòng', 'MonitorUp', '#e7f8ef', 'Màn hình', 20),
  ('Màn hình đồ họa', 'MonitorUp', '#f2eaff', 'Màn hình', 30)
) AS seed(name, icon, color, parent_name, sort_order)
JOIN product_categories AS parent ON parent.name = seed.parent_name
ON CONFLICT DO NOTHING;
