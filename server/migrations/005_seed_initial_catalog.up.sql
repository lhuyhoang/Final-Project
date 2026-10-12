INSERT INTO products (
  id, name, category, brand, price, old_price, stock,
  rating, reviews, discount, badge, image
) VALUES
  (1, 'PC QUADPRO Phantom i5 14400F / RTX 4060 8GB', 'PC Gaming', 'QUADPRO', 20990000, 23990000, 18, 4.9, 126, 13, 'Bán chạy', 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=85'),
  (2, 'Card màn hình ASUS Dual GeForce RTX 4060 OC 8GB', 'VGA - Card đồ họa', 'ASUS', 8290000, 9490000, 11, 4.8, 84, 13, 'Giá sốc', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=600&q=85'),
  (3, 'Màn hình MSI MAG 274QRF QD E2 27 inch 2K 180Hz', 'Màn hình', 'MSI', 7990000, 8990000, 24, 4.7, 42, 11, 'Mới', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=85'),
  (4, 'CPU AMD Ryzen 7 7800X3D 8C/16T', 'CPU - Bộ vi xử lý', 'AMD', 9490000, 10890000, 8, 5.0, 73, 13, 'Top gaming', 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=600&q=85'),
  (5, 'Laptop ASUS TUF Gaming A15 R7 / RTX 4050', 'Laptop', 'ASUS', 23990000, 26990000, 7, 4.8, 98, 11, 'Quà 1.5 triệu', 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=85'),
  (6, 'Bàn phím cơ Akko 5075B Plus Dracula Castle', 'Bàn phím', 'AKKO', 1890000, 2290000, 31, 4.9, 164, 17, 'Deal hot', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=85'),
  (7, 'SSD Samsung 990 PRO 2TB PCIe Gen 4.0', 'SSD - HDD', 'SAMSUNG', 4290000, 5190000, 42, 4.9, 55, 17, 'Freeship', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=85'),
  (8, 'Chuột không dây Logitech G Pro X Superlight 2', 'Chuột gaming', 'LOGITECH', 3290000, 3790000, 26, 4.8, 112, 13, 'Bán chạy', 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=600&q=85')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('products', 'id'),
  GREATEST((SELECT MAX(id) FROM products), 1),
  true
);
