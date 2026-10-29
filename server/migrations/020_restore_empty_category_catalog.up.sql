DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_categories) THEN
    INSERT INTO product_categories (
      name, icon, color, parent_id, is_visible, show_in_showcase, sort_order
    )
    VALUES
      ('PC', 'Monitor', '#ffe8e5', NULL, TRUE, TRUE, 10),
      ('Laptop', 'Laptop', '#e8f2ff', NULL, TRUE, TRUE, 20),
      ('Linh kiện điện tử', 'CircuitBoard', '#e8f7f7', NULL, TRUE, TRUE, 30),
      ('Màn hình', 'MonitorUp', '#e7f8ef', NULL, TRUE, TRUE, 40),
      ('Gaming Gear', 'Headphones', '#f0edff', NULL, TRUE, TRUE, 50)
    ON CONFLICT DO NOTHING;

    INSERT INTO product_categories (
      name, icon, color, parent_id, is_visible, show_in_showcase, sort_order
    )
    SELECT seed.name, seed.icon, seed.color, parent.id, seed.is_visible, FALSE, seed.sort_order
    FROM (VALUES
      ('PC Gaming', 'Monitor', '#ffe8e5', 'PC', TRUE, 10),
      ('PC văn phòng', 'Monitor', '#edf4ff', 'PC', FALSE, 20),
      ('PC Workstation', 'Monitor', '#f2eaff', 'PC', FALSE, 30),
      ('Laptop Gaming', 'Laptop', '#ffe8e5', 'Laptop', FALSE, 10),
      ('Laptop văn phòng', 'Laptop', '#e8f2ff', 'Laptop', FALSE, 20),
      ('Laptop đồ họa', 'Laptop', '#f2eaff', 'Laptop', FALSE, 30),
      ('VGA - Card đồ họa', 'Cpu', '#f2eaff', 'Linh kiện điện tử', TRUE, 10),
      ('CPU - Bộ vi xử lý', 'Microchip', '#fff2d9', 'Linh kiện điện tử', TRUE, 20),
      ('Mainboard', 'CircuitBoard', '#e8f7f7', 'Linh kiện điện tử', TRUE, 30),
      ('RAM', 'MemoryStick', '#ffeaf2', 'Linh kiện điện tử', TRUE, 40),
      ('SSD - HDD', 'HardDrive', '#edf0ff', 'Linh kiện điện tử', TRUE, 50),
      ('Bàn phím', 'Keyboard', '#f6eddf', 'Gaming Gear', TRUE, 10),
      ('Chuột gaming', 'Mouse', '#e8f4ff', 'Gaming Gear', TRUE, 20),
      ('Tai nghe', 'Headphones', '#f0edff', 'Gaming Gear', TRUE, 30),
      ('Ghế gaming', 'Armchair', '#fcebe8', 'Gaming Gear', TRUE, 40)
    ) AS seed(name, icon, color, parent_name, is_visible, sort_order)
    JOIN product_categories AS parent ON parent.name = seed.parent_name
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
