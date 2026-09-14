export const categories = [
  { name: 'PC Gaming', icon: 'Monitor', color: '#ffe8e5' },
  { name: 'Laptop', icon: 'Laptop', color: '#e8f2ff' },
  { name: 'Màn hình', icon: 'MonitorUp', color: '#e7f8ef' },
  { name: 'VGA - Card đồ họa', icon: 'Cpu', color: '#f2eaff' },
  { name: 'CPU - Bộ vi xử lý', icon: 'Microchip', color: '#fff2d9' },
  { name: 'Mainboard', icon: 'CircuitBoard', color: '#e8f7f7' },
  { name: 'RAM', icon: 'MemoryStick', color: '#ffeaf2' },
  { name: 'SSD - HDD', icon: 'HardDrive', color: '#edf0ff' },
  { name: 'Bàn phím', icon: 'Keyboard', color: '#f6eddf' },
  { name: 'Chuột gaming', icon: 'Mouse', color: '#e8f4ff' },
  { name: 'Tai nghe', icon: 'Headphones', color: '#f0edff' },
  { name: 'Ghế gaming', icon: 'Armchair', color: '#fcebe8' }
]

export const categoryMenus = {
  'PC Gaming': {
    options: [
      'PC Gaming giá rẻ',
      'PC Stream Game',
      'PC Gaming Premium',
      'PC Intel Gaming',
      'PC Gaming cao cấp',
      'PC AMD Gaming',
      'PC Mini',
      'PC AI - Trí tuệ nhân tạo'
    ],
    brands: ['QUADPRO', 'ASUS', 'MSI', 'GIGABYTE', 'AMD', 'INTEL']
  },
  Laptop: {
    options: [
      'Laptop Gaming',
      'Laptop văn phòng',
      'Laptop mỏng nhẹ',
      'Laptop đồ họa',
      'Laptop AI',
      'Laptop cao cấp'
    ],
    brands: ['ASUS', 'ACER', 'MSI', 'LENOVO', 'DELL', 'HP']
  },
  'Màn hình': {
    options: [
      'Màn hình Gaming',
      'Màn hình văn phòng',
      'Màn hình đồ họa',
      'Màn hình 2K',
      'Màn hình 4K',
      'Màn hình Ultrawide',
      'Màn hình 100Hz',
      'Màn hình 240Hz'
    ],
    brands: ['MSI', 'ASUS', 'LG', 'SAMSUNG', 'DELL', 'AOC']
  },
  'VGA - Card đồ họa': {
    options: [
      'GeForce RTX 50 Series',
      'GeForce RTX 40 Series',
      'Radeon RX Series',
      'VGA 8GB',
      'VGA 12GB trở lên',
      'VGA Workstation'
    ],
    brands: ['ASUS', 'MSI', 'GIGABYTE', 'ZOTAC', 'SAPPHIRE', 'NVIDIA']
  },
  'CPU - Bộ vi xử lý': {
    options: [
      'Intel Core Ultra',
      'Intel Core i Series',
      'AMD Ryzen 9000',
      'AMD Ryzen X3D',
      'CPU Gaming',
      'CPU Workstation'
    ],
    brands: ['INTEL', 'AMD']
  },
  Mainboard: {
    options: [
      'Mainboard Intel B760',
      'Mainboard Intel Z890',
      'Mainboard AMD B650',
      'Mainboard AMD X870',
      'Mainboard DDR4',
      'Mainboard DDR5',
      'Mainboard Mini ITX'
    ],
    brands: ['ASUS', 'MSI', 'GIGABYTE', 'ASROCK']
  },
  RAM: {
    options: [
      'RAM DDR4',
      'RAM DDR5',
      'RAM 16GB',
      'RAM 32GB',
      'RAM RGB',
      'RAM Laptop'
    ],
    brands: ['CORSAIR', 'KINGSTON', 'G.SKILL', 'ADATA', 'TEAMGROUP', 'LEXAR']
  },
  'SSD - HDD': {
    options: [
      'SSD NVMe Gen 4',
      'SSD NVMe Gen 5',
      'SSD SATA',
      'SSD di động',
      'HDD Desktop',
      'HDD lưu trữ'
    ],
    brands: ['SAMSUNG', 'WESTERN DIGITAL', 'SEAGATE', 'KINGSTON', 'CRUCIAL', 'LEXAR']
  },
  'Bàn phím': {
    options: [
      'Bàn phím cơ',
      'Bàn phím không dây',
      'Bàn phím Low Profile',
      'Bàn phím Custom',
      'Bàn phím Fullsize',
      'Bàn phím Compact'
    ],
    brands: ['AKKO', 'KEYCHRON', 'LOGITECH', 'RAZER', 'CORSAIR', 'ASUS']
  }
}

export const fallbackProducts = [
  { id: 1, name: 'PC QUADPRO Phantom i5 14400F / RTX 4060 8GB', category: 'PC Gaming', brand: 'QUADPRO', price: 20990000, oldPrice: 23990000, rating: 4.9, reviews: 126, discount: 13, badge: 'Bán chạy', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=85' },
  { id: 2, name: 'Card màn hình ASUS Dual GeForce RTX 4060 OC 8GB', category: 'VGA - Card đồ họa', brand: 'ASUS', price: 8290000, oldPrice: 9490000, rating: 4.8, reviews: 84, discount: 13, badge: 'Giá sốc', image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=600&q=85' },
  { id: 3, name: 'Màn hình MSI MAG 274QRF QD E2 27 inch 2K 180Hz', category: 'Màn hình', brand: 'MSI', price: 7990000, oldPrice: 8990000, rating: 4.7, reviews: 42, discount: 11, badge: 'Mới', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=85' },
  { id: 4, name: 'CPU AMD Ryzen 7 7800X3D 8C/16T', category: 'CPU - Bộ vi xử lý', brand: 'AMD', price: 9490000, oldPrice: 10890000, rating: 5, reviews: 73, discount: 13, badge: 'Top gaming', image: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=600&q=85' },
  { id: 5, name: 'Laptop ASUS TUF Gaming A15 R7 / RTX 4050', category: 'Laptop', brand: 'ASUS', price: 23990000, oldPrice: 26990000, rating: 4.8, reviews: 98, discount: 11, badge: 'Quà 1.5 triệu', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=85' },
  { id: 6, name: 'Bàn phím cơ Akko 5075B Plus Dracula Castle', category: 'Bàn phím', brand: 'AKKO', price: 1890000, oldPrice: 2290000, rating: 4.9, reviews: 164, discount: 17, badge: 'Deal hot', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=85' },
  { id: 7, name: 'SSD Samsung 990 PRO 2TB PCIe Gen 4.0', category: 'SSD - HDD', brand: 'SAMSUNG', price: 4290000, oldPrice: 5190000, rating: 4.9, reviews: 55, discount: 17, badge: 'Freeship', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=85' },
  { id: 8, name: 'Chuột không dây Logitech G Pro X Superlight 2', category: 'Chuột gaming', brand: 'LOGITECH', price: 3290000, oldPrice: 3790000, rating: 4.8, reviews: 112, discount: 13, badge: 'Bán chạy', image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=600&q=85' }
]
