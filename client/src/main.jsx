import React, {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  Armchair,
  ArrowRight,
  ArrowUpRight,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Facebook,
  HardDrive,
  Headphones,
  Heart,
  Instagram,
  Keyboard,
  Laptop,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  MemoryStick,
  Menu,
  MessageCircle,
  Microchip,
  Monitor,
  MonitorUp,
  Mouse,
  RefreshCcw,
  Search,
  SearchX,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Trash2,
  Truck,
  UserRound,
  Wrench,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { categories, categoryMenus, fallbackProducts } from "./data";
import { api, clearSession, getSession, saveSession } from "./api";
import AccountSettings from "./components/AccountSettings";
import AdminDashboard from "./components/AdminDashboard";
import AuthModal from "./components/AuthModal";
import ProductDetail from "./components/ProductDetail";
import "./styles.css";
import "./admin.css";

const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN").format(value) + "₫";
const defaultPolicyText = "Trả góp 0% • Bảo hành 36 tháng";
const toSlug = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const productIdFromPath = (pathname = window.location.pathname) => {
  const match = pathname.match(/^\/products\/(\d+)(?:-[^/]*)?\/?$/);
  return match ? Number(match[1]) : null;
};
const productPath = (product) => `/products/${product.id}-${toSlug(product.name)}`;
const catalogSelectionFromLocation = (
  pathname = window.location.pathname,
  search = window.location.search,
) => {
  const match = pathname.match(/^\/categories\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;

  const category = categories.find((item) => toSlug(item.name) === match[1]);
  if (!category) return null;

  const option = match[2]
    ? (categoryMenus[category.name]?.options || []).find(
        (item) => toSlug(item) === match[2],
      )
    : "";
  if (match[2] && !option) return null;

  return {
    category: category.name,
    option,
    brand: new URLSearchParams(search).get("brand") || "",
  };
};
const catalogPath = (category, option = "", brand = "") => {
  const pathname = `/categories/${toSlug(category)}${option ? `/${toSlug(option)}` : ""}`;
  const params = new URLSearchParams();
  if (brand) params.set("brand", brand);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};
const categoryIcons = {
  Armchair,
  CircuitBoard,
  Cpu,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  MemoryStick,
  Microchip,
  Monitor,
  MonitorUp,
  Mouse,
};
const loadCart = () => {
  try {
    return JSON.parse(localStorage.getItem("quadpro-cart") || "[]");
  } catch {
    return [];
  }
};

const quickViewHighlights = {
  "PC Gaming": [
    "Lắp ráp hoàn thiện, đi dây gọn và kiểm tra tải trước khi giao",
    "Hiệu năng tối ưu cho chơi game và làm việc đa nhiệm",
    "Hỗ trợ nâng cấp linh kiện trong suốt vòng đời sản phẩm",
  ],
  Laptop: [
    "Cấu hình cân bằng cho học tập, làm việc và giải trí",
    "Máy chính hãng, nguyên seal và đầy đủ phụ kiện",
    "Hỗ trợ cài đặt, tối ưu hệ thống khi nhận máy",
  ],
  "Màn hình": [
    "Hình ảnh sắc nét, chuyển động mượt cho game và sáng tạo",
    "Kiểm tra điểm ảnh và ngoại quan trước khi giao",
    "Hỗ trợ cân chỉnh chế độ hiển thị theo nhu cầu",
  ],
  "VGA - Card đồ họa": [
    "Tối ưu cho gaming, đồ họa và tác vụ tăng tốc GPU",
    "Kiểm tra tải và nhiệt độ trước khi bàn giao",
    "Tương thích với nhiều cấu hình PC phổ biến",
  ],
  "CPU - Bộ vi xử lý": [
    "Hiệu năng mạnh cho gaming và xử lý đa nhiệm",
    "Sản phẩm chính hãng, đầy đủ tem và hộp",
    "Hỗ trợ kiểm tra tương thích mainboard và RAM",
  ],
  "SSD - HDD": [
    "Tốc độ cao, rút ngắn thời gian khởi động và tải ứng dụng",
    "Phù hợp nâng cấp máy bàn và laptop tương thích",
    "Hỗ trợ kiểm tra sức khỏe và cài đặt ổ đĩa",
  ],
  "Bàn phím": [
    "Phản hồi phím nhanh, phù hợp làm việc và chơi game",
    "Thiết kế bền bỉ cho nhu cầu sử dụng hằng ngày",
    "Hỗ trợ kiểm tra kết nối trước khi giao",
  ],
  "Chuột gaming": [
    "Cảm biến chính xác và độ trễ thấp cho game thi đấu",
    "Thiết kế công thái học, tối ưu thao tác lâu dài",
    "Hỗ trợ thiết lập DPI và phần mềm điều khiển",
  ],
};

function getQuickViewHighlights(product) {
  const customHighlights = Array.isArray(product.highlights)
    ? product.highlights
        .filter((item) => typeof item === "string" && item.trim())
        .slice(0, 4)
    : [];

  if (customHighlights.length) return customHighlights;

  return [
    `Sản phẩm ${product.brand} chính hãng, đầy đủ tem và phụ kiện`,
    ...(quickViewHighlights[product.category] || [
      "Được kiểm tra ngoại quan và chức năng trước khi giao",
      "Hỗ trợ kỹ thuật tận tâm tại hệ thống QuadPro",
      "Đổi trả linh hoạt theo chính sách cửa hàng",
    ]),
  ];
}

function ProductQuickView({ anchorRef, id, open, product }) {
  const popupRef = useRef(null);
  const [position, setPosition] = useState({
    left: 12,
    top: 12,
    side: "right",
    ready: false,
  });

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const popup = popupRef.current;
      if (!anchor || !popup) return;

      const margin = 12;
      const gap = 12;
      const anchorRect = anchor.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const availableRight = window.innerWidth - anchorRect.right;
      const availableLeft = anchorRect.left;
      const side =
        availableRight >= popupRect.width + gap ||
        availableRight >= availableLeft
          ? "right"
          : "left";
      const preferredLeft =
        side === "right"
          ? anchorRect.right + gap
          : anchorRect.left - popupRect.width - gap;
      const maxLeft = Math.max(margin, window.innerWidth - popupRect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - popupRect.height - margin);

      setPosition({
        left: Math.round(Math.min(Math.max(preferredLeft, margin), maxLeft)),
        top: Math.round(Math.min(Math.max(anchorRect.top, margin), maxTop)),
        side,
        ready: true,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open, product.id]);

  if (!open) return null;

  const savings = Math.max(0, product.oldPrice - product.price);
  const stockLabel =
    product.stock == null
      ? "Còn hàng"
      : product.stock > 0
        ? `Còn ${product.stock} sản phẩm`
        : "Tạm hết hàng";

  return createPortal(
    <aside
      className="product-quick-view"
      data-side={position.side}
      id={id}
      ref={popupRef}
      role="tooltip"
      style={{
        left: position.left,
        top: position.top,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      <div className="quick-view-header">
        <span>
          {product.brand} <i aria-hidden="true">•</i> {product.badge}
        </span>
        <h4>{product.name}</h4>
      </div>
      <div className="quick-view-content">
        <div className="quick-view-price">
          <span>Giá bán:</span>
          <strong>{formatPrice(product.price)}</strong>
          {savings > 0 && <small>Tiết kiệm {formatPrice(savings)}</small>}
        </div>
        <dl className="quick-view-meta">
          <div>
            <dt>Bảo hành:</dt>
            <dd>36 tháng</dd>
          </div>
          <div>
            <dt>Tình trạng:</dt>
            <dd className={product.stock === 0 ? "sold-out" : "in-stock"}>
              {stockLabel}
            </dd>
          </div>
        </dl>
        <div className="quick-view-label">Mô tả tóm tắt</div>
        <ul className="quick-view-highlights">
          {getQuickViewHighlights(product).map((highlight) => (
            <li key={highlight}>
              <CheckCircle2 aria-hidden="true" size={16} />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
        <div className="quick-view-label promotion-label">Khuyến mãi</div>
        <div className="quick-view-promotion">
          <Zap aria-hidden="true" size={17} fill="currentColor" />
          <p>
            {savings > 0 && (
              <b>
                Giảm trực tiếp {formatPrice(savings)} ({product.discount}%)
              </b>
            )}
            <span>Miễn phí giao hàng cho đơn từ 500.000₫.</span>
          </p>
        </div>
        <div className="quick-view-rating">
          <span>
            <Star aria-hidden="true" size={15} fill="currentColor" />
            {product.rating}/5
          </span>
          <small>{product.reviews} khách hàng đã đánh giá</small>
        </div>
      </div>
    </aside>,
    document.body,
  );
}

function ProductCard({ product, onAdd, onOpen, carousel = false }) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const mediaRef = useRef(null);
  const quickViewId = useId();
  const available = product.stock !== 0;

  return (
    <article className={`product-card${carousel ? " carousel-product-card" : ""}`}>
      <div
        aria-describedby={quickViewOpen ? quickViewId : undefined}
        aria-label={`Xem chi tiết ${product.name}`}
        className={`product-media${quickViewOpen ? " quick-view-active" : ""}`}
        onClick={(event) => {
          if (!event.target.closest("button")) onOpen(product);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setQuickViewOpen(false);
          }
        }}
        onFocus={(event) => {
          if (
            event.currentTarget.matches(":focus-visible") ||
            event.target.matches(":focus-visible")
          ) {
            setQuickViewOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuickViewOpen(false);
            event.currentTarget.blur();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            onOpen(product);
          }
        }}
        onPointerEnter={(event) => {
          if (
            event.pointerType === "mouse" &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
          ) {
            setQuickViewOpen(true);
          }
        }}
        onPointerLeave={() => setQuickViewOpen(false)}
        ref={mediaRef}
        role="link"
        tabIndex="0"
      >
        <span className="discount">-{product.discount}%</span>
        <button type="button" className="heart" aria-label={`Yêu thích ${product.name}`}>
          <Heart size={19} />
        </button>
        <img src={product.image} alt={product.name} loading="lazy" />
        <span className="product-badge">{product.badge}</span>
      </div>
      <div className="product-body">
        <span className="brand">{product.brand}</span>
        <h3>
          <button
            type="button"
            className="product-name-link"
            onClick={() => onOpen(product)}
          >
            {product.name}
          </button>
        </h3>
        <div className="price-row">
          <strong>{formatPrice(product.price)}</strong>
          <del>{formatPrice(product.oldPrice)}</del>
        </div>
        <div className="installment">
          {product.policyText || defaultPolicyText}
        </div>
        <div className="card-bottom">
          <span className="rating">
            <Star size={14} fill="currentColor" /> {product.rating}{" "}
            <small>({product.reviews})</small>
          </span>
          <button
            className="add-button"
            onClick={() => onAdd(product)}
            disabled={!available}
            aria-label={`Thêm ${product.name} vào giỏ`}
          >
            <ShoppingCart size={18} />
            {carousel && <span>Thêm vào giỏ</span>}
          </button>
          {carousel && (
            <span className={`product-stock ${available ? "in-stock" : "sold-out"}`}>
              {available ? "Còn hàng" : "Hết hàng"}
            </span>
          )}
        </div>
      </div>
      <ProductQuickView
        anchorRef={mediaRef}
        id={quickViewId}
        open={quickViewOpen}
        product={product}
      />
    </article>
  );
}

function CategoryProductCarousel({
  category,
  products,
  onAdd,
  onOpen,
  onSelectOption,
  onViewAll,
}) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const titleId = useId();
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const menuOptions = (categoryMenus[category.name]?.options || []).slice(0, 5);

  function scrollProducts(direction) {
    const track = trackRef.current;
    const firstCard = track?.querySelector(".product-card");
    if (!track || !firstCard) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const atStart = track.scrollLeft <= 4;
    const atEnd = track.scrollLeft >= maxScroll - 4;
    const nextPosition =
      direction > 0
        ? atEnd
          ? 0
          : Math.min(track.scrollLeft + step, maxScroll)
        : atStart
          ? maxScroll
          : Math.max(track.scrollLeft - step, 0);

    track.scrollTo({
      left: nextPosition,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  const advanceProducts = useEffectEvent(() => scrollProducts(1));

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.3),
      { threshold: [0, 0.3, 0.6] },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const updateOverflow = () =>
      setCanScroll(track.scrollWidth > track.clientWidth + 4);
    const frame = window.requestAnimationFrame(updateOverflow);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", updateOverflow);
      };
    }

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(track);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [products.length]);

  useEffect(() => {
    if (
      !inView ||
      paused ||
      !canScroll ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const interval = window.setInterval(advanceProducts, 3000);
    return () => window.clearInterval(interval);
  }, [canScroll, inView, paused, products.length]);

  return (
    <section
      className="category-product-carousel"
      aria-labelledby={titleId}
      data-in-view={inView || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      ref={sectionRef}
    >
      <div className="category-carousel-header">
        <h3 id={titleId}>{category.name}</h3>
        {menuOptions.length > 0 && (
          <div className="category-carousel-tabs" aria-label={`Nhóm ${category.name}`}>
            {menuOptions.map((option) => (
              <button
                type="button"
                onClick={() => onSelectOption(option)}
                key={option}
              >
                {option}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="category-view-all" onClick={onViewAll}>
          Xem tất cả <ChevronRight size={15} />
        </button>
      </div>

      <div className="category-carousel-shell">
        {canScroll && (
          <button
            type="button"
            className="category-carousel-arrow previous"
            onClick={() => scrollProducts(-1)}
            aria-label={`Xem sản phẩm ${category.name} trước`}
          >
            <ChevronRight size={21} />
          </button>
        )}
        <div
          className="category-product-track"
          aria-label={`Sản phẩm ${category.name}`}
          ref={trackRef}
          role="group"
          tabIndex={canScroll ? 0 : undefined}
        >
          {products.map((product) => (
            <ProductCard
              carousel
              key={product.id}
              product={product}
              onAdd={onAdd}
              onOpen={onOpen}
            />
          ))}
        </div>
        {canScroll && (
          <button
            type="button"
            className="category-carousel-arrow next"
            onClick={() => scrollProducts(1)}
            aria-label={`Xem thêm sản phẩm ${category.name}`}
          >
            <ChevronRight size={21} />
          </button>
        )}
      </div>
    </section>
  );
}

const catalogPriceRanges = [
  { id: "under-10", label: "Dưới 10 triệu", min: 0, max: 10_000_000 },
  { id: "10-20", label: "10 triệu - 20 triệu", min: 10_000_000, max: 20_000_000 },
  { id: "20-30", label: "20 triệu - 30 triệu", min: 20_000_000, max: 30_000_000 },
  { id: "30-50", label: "30 triệu - 50 triệu", min: 30_000_000, max: 50_000_000 },
  { id: "over-50", label: "Trên 50 triệu", min: 50_000_000, max: Infinity },
];

function CategoryCatalog({
  category,
  option,
  initialBrand,
  products,
  onBack,
  onAdd,
  onOpen,
}) {
  const filterId = useId();
  const availableInitialBrand = products.find(
    (product) =>
      initialBrand && product.brand.toLowerCase() === initialBrand.toLowerCase(),
  )?.brand;
  const [sortBy, setSortBy] = useState("featured");
  const [selectedPrices, setSelectedPrices] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState(() =>
    availableInitialBrand ? [availableInitialBrand] : [],
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const brands = [...new Set(products.map((product) => product.brand))].sort(
    (left, right) => left.localeCompare(right, "vi"),
  );

  const visibleProducts = products
    .filter((product) => {
      const matchesPrice =
        selectedPrices.length === 0 ||
        selectedPrices.some((rangeId) => {
          const range = catalogPriceRanges.find((item) => item.id === rangeId);
          return range && product.price >= range.min && product.price < range.max;
        });
      const matchesBrand =
        selectedBrands.length === 0 || selectedBrands.includes(product.brand);
      return matchesPrice && matchesBrand;
    })
    .sort((left, right) => {
      if (sortBy === "price-asc") return left.price - right.price;
      if (sortBy === "price-desc") return right.price - left.price;
      if (sortBy === "discount") return right.discount - left.discount;
      if (sortBy === "rating") return right.rating - left.rating;
      return 0;
    });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${option || category.name} | QuadPro`;
    return () => {
      document.title = previousTitle;
    };
  }, [category.name, option]);

  function toggleFilter(setter, value) {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function resetFilters() {
    setSelectedPrices([]);
    setSelectedBrands([]);
  }

  return (
    <div className="catalog-page">
      <div className="container">
        <nav className="catalog-breadcrumb" aria-label="Điều hướng danh mục">
          <button type="button" onClick={onBack}>Trang chủ</button>
          <ChevronRight size={14} aria-hidden="true" />
          <span>{category.name}</span>
          {option && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <strong>{option}</strong>
            </>
          )}
        </nav>

        <div className="catalog-mobile-tools">
          <button type="button" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={17} /> Bộ lọc
            {selectedPrices.length + selectedBrands.length > 0 && (
              <b>{selectedPrices.length + selectedBrands.length}</b>
            )}
          </button>
        </div>

        <div className="catalog-layout">
          {filtersOpen && (
            <button
              type="button"
              className="catalog-filter-backdrop"
              onClick={() => setFiltersOpen(false)}
              aria-label="Đóng bộ lọc"
            />
          )}
          <aside className={`catalog-filters${filtersOpen ? " open" : ""}`}>
            <div className="catalog-filter-heading">
              <strong>LỌC SẢN PHẨM</strong>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Đóng bộ lọc"
              >
                <X size={18} />
              </button>
            </div>

            <fieldset>
              <legend>KHOẢNG GIÁ</legend>
              {catalogPriceRanges.map((range) => {
                const count = products.filter(
                  (product) => product.price >= range.min && product.price < range.max,
                ).length;
                return (
                  <label key={range.id}>
                    <input
                      type="checkbox"
                      checked={selectedPrices.includes(range.id)}
                      disabled={count === 0}
                      onChange={() => toggleFilter(setSelectedPrices, range.id)}
                    />
                    <span>{range.label} <b>({count})</b></span>
                  </label>
                );
              })}
            </fieldset>

            <fieldset>
              <legend>THƯƠNG HIỆU</legend>
              {brands.map((brand) => {
                const count = products.filter(
                  (product) => product.brand === brand,
                ).length;
                return (
                  <label key={brand}>
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand)}
                      onChange={() => toggleFilter(setSelectedBrands, brand)}
                    />
                    <span>{brand} <b>({count})</b></span>
                  </label>
                );
              })}
            </fieldset>

            <button
              type="button"
              className="catalog-reset"
              disabled={selectedPrices.length + selectedBrands.length === 0}
              onClick={resetFilters}
            >
              <RefreshCcw size={15} /> Xóa bộ lọc
            </button>
          </aside>

          <section className="catalog-results" aria-labelledby={`${filterId}-title`}>
            <div className="catalog-toolbar">
              <div>
                <small>{option || category.name}</small>
                <h1 id={`${filterId}-title`}>
                  Tìm thấy <strong>{visibleProducts.length}</strong> sản phẩm
                </h1>
              </div>
              <label>
                <span>Sắp xếp theo</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="featured">Nổi bật</option>
                  <option value="price-asc">Giá thấp đến cao</option>
                  <option value="price-desc">Giá cao đến thấp</option>
                  <option value="discount">Giảm giá nhiều nhất</option>
                  <option value="rating">Đánh giá cao nhất</option>
                </select>
              </label>
            </div>

            {visibleProducts.length > 0 ? (
              <div className="catalog-product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard
                    carousel
                    key={product.id}
                    product={product}
                    onAdd={onAdd}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            ) : (
              <div className="empty catalog-empty">
                <SearchX size={42} />
                <h2>Không có sản phẩm phù hợp</h2>
                <p>Hãy bỏ bớt điều kiện lọc để xem thêm sản phẩm.</p>
                <button type="button" onClick={resetFilters}>Xóa bộ lọc</button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [products, setProducts] = useState(fallbackProducts);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCategory, setMenuCategory] = useState(null);
  const [toast, setToast] = useState("");
  const [session, setSession] = useState(getSession);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountView, setAccountView] = useState(() =>
    window.location.pathname.startsWith("/account"),
  );
  const [adminView, setAdminView] = useState(() =>
    window.location.pathname.startsWith("/admin"),
  );
  const [productId, setProductId] = useState(productIdFromPath);
  const [catalogSelection, setCatalogSelection] = useState(
    catalogSelectionFromLocation,
  );
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuTimerRef = useRef(null);

  async function refreshProducts() {
    try {
      setProducts(await api("/api/products"));
    } catch {
      /* Fallback products keep the storefront usable. */
    } finally {
      setProductsLoaded(true);
    }
  }

  useEffect(() => {
    refreshProducts();
  }, []);
  useEffect(() => {
    if (!session?.token) return;
    api("/api/auth/me")
      .then(({ user }) => {
        const verified = { token: session.token, user };
        setSession(verified);
        saveSession(verified);
      })
      .catch(() => {
        clearSession();
        setSession(null);
        setAccountView(false);
        setAdminView(false);
        if (
          window.location.pathname.startsWith("/account") ||
          window.location.pathname.startsWith("/admin")
        ) {
          window.history.replaceState({}, "", "/");
        }
      });
  }, []);
  useEffect(
    () => localStorage.setItem("quadpro-cart", JSON.stringify(cart)),
    [cart],
  );
  useEffect(() => {
    const isAdminRoute = window.location.pathname.startsWith("/admin");
    const isAccountRoute = window.location.pathname.startsWith("/account");
    if (!isAdminRoute && !isAccountRoute) return;
    if (!session) openAuth("login");
    else if (isAdminRoute && session.user.role !== "admin") leaveAdmin();
  }, []);
  useEffect(() => {
    const syncRoute = () => {
      const isAdminRoute = window.location.pathname.startsWith("/admin");
      const isAccountRoute = window.location.pathname.startsWith("/account");
      setAdminView(isAdminRoute);
      setAccountView(isAccountRoute);
      setProductId(productIdFromPath());
      setCatalogSelection(catalogSelectionFromLocation());
      if ((isAdminRoute || isAccountRoute) && !getSession()) openAuth("login");
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  useEffect(
    () => () => window.clearTimeout(categoryMenuTimerRef.current),
    [],
  );

  const filtered = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.brand.toLowerCase().includes(query.toLowerCase());
    return (
      matchesSearch &&
      (activeCategory === "Tất cả" || product.category === activeCategory)
    );
  });
  const productGroups = categories
    .map((category) => ({
      category,
      products: filtered.filter((product) => product.category === category.name),
    }))
    .filter((group) => group.products.length > 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedProduct = productId
    ? products.find((product) => product.id === productId)
    : null;
  const selectedCatalogCategory = catalogSelection
    ? categories.find((category) => category.name === catalogSelection.category)
    : null;
  const catalogProducts = selectedCatalogCategory
    ? products.filter(
        (product) => product.category === selectedCatalogCategory.name,
      )
    : [];
  const menuDetails = menuCategory ? categoryMenus[menuCategory] : null;
  const menuBrands = menuDetails
    ? [
        ...new Set([
          ...menuDetails.brands,
          ...products
            .filter((product) => product.category === menuCategory)
            .map((product) => product.brand),
        ]),
      ].slice(0, 8)
    : [];

  function addToCart(product, quantity = 1) {
    const amount = Math.max(1, Math.floor(quantity));
    setCart((current) =>
      current.some((item) => item.id === product.id)
        ? current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + amount }
              : item,
          )
        : [...current, { ...product, quantity: amount }],
    );
    setToast(
      amount > 1
        ? `Đã thêm ${amount} × ${product.name} vào giỏ`
        : `Đã thêm ${product.name} vào giỏ`,
    );
    setTimeout(() => setToast(""), 2200);
  }
  function updateQuantity(id, delta) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
    setAccountOpen(false);
  }

  function handleAuthenticated(nextSession) {
    setSession(nextSession);
    setAuthOpen(false);
    setToast(`Xin chào, ${nextSession.user.name}`);
    setTimeout(() => setToast(""), 2200);
    if (nextSession.user.role === "admin") openAdmin();
    else if (window.location.pathname.startsWith("/admin")) leaveAdmin();
  }

  function openAdmin() {
    if (!window.location.pathname.startsWith("/admin"))
      window.history.pushState({}, "", "/admin");
    setAdminView(true);
    setAccountView(false);
    setProductId(null);
    setCatalogSelection(null);
    setAccountOpen(false);
  }

  function leaveAdmin() {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setAdminView(false);
    setAccountView(false);
    setProductId(null);
    setCatalogSelection(null);
  }

  function openAccountSettings() {
    if (!session) {
      openAuth("login");
      return;
    }
    if (!window.location.pathname.startsWith("/account")) {
      window.history.pushState({}, "", "/account");
    }
    setAdminView(false);
    setAccountView(true);
    setProductId(null);
    setCatalogSelection(null);
    setAccountOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leaveAccountSettings() {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setAccountView(false);
    setProductId(null);
    setCatalogSelection(null);
  }

  function openProduct(product) {
    window.history.pushState({}, "", productPath(product));
    setProductId(product.id);
    setCatalogSelection(null);
    setAdminView(false);
    setAccountView(false);
    setAccountOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openStorefront(event) {
    event?.preventDefault();
    if (window.location.pathname !== "/" || window.location.hash) {
      window.history.pushState({}, "", "/");
    }
    setProductId(null);
    setCatalogSelection(null);
    setAdminView(false);
    setAccountView(false);
    setAccountOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openStorefrontSection(event, selector, category) {
    event.preventDefault();
    if (category) setActiveCategory(category);
    window.history.pushState({}, "", `/${selector}`);
    setProductId(null);
    setCatalogSelection(null);
    setAdminView(false);
    setAccountView(false);
    setMenuOpen(false);
    setCategoryMenuOpen(false);
    setMenuCategory(null);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" }),
      ),
    );
  }

  function clearCategoryMenuTimer() {
    window.clearTimeout(categoryMenuTimerRef.current);
    categoryMenuTimerRef.current = null;
  }

  function queueCategoryMenu() {
    clearCategoryMenuTimer();
    categoryMenuTimerRef.current = window.setTimeout(() => {
      setCategoryMenuOpen(true);
      categoryMenuTimerRef.current = null;
    }, 220);
  }

  function showCategoryMenu() {
    clearCategoryMenuTimer();
    setCategoryMenuOpen(true);
  }

  function hideCategoryMenu() {
    clearCategoryMenuTimer();
    setCategoryMenuOpen(false);
    setMenuCategory(null);
  }

  function openCatalog(category, option = "", brand = "") {
    window.history.pushState({}, "", catalogPath(category, option, brand));
    setCatalogSelection({ category, option, brand });
    setQuery("");
    setProductId(null);
    setAdminView(false);
    setAccountView(false);
    setAccountOpen(false);
    setMenuOpen(false);
    setCategoryMenuOpen(false);
    setMenuCategory(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMenuSelection(event, category, option = "", brand = "") {
    event.preventDefault();
    openCatalog(category, option, brand);
  }

  function buyNow(product, quantity) {
    addToCart(product, quantity);
    setCartOpen(true);
  }

  function handleUserUpdated(user) {
    const updatedSession = { token: session.token, user };
    setSession(updatedSession);
    saveSession(updatedSession);
  }

  function logout() {
    clearSession();
    setSession(null);
    setAccountView(false);
    setAdminView(false);
    if (
      window.location.pathname.startsWith("/admin") ||
      window.location.pathname.startsWith("/account")
    )
      window.history.replaceState({}, "", "/");
    setAccountOpen(false);
    setToast("Đã đăng xuất an toàn");
    setTimeout(() => setToast(""), 2200);
  }

  async function checkout() {
    if (!session) {
      setCartOpen(false);
      openAuth("login");
      return;
    }
    setCheckoutLoading(true);
    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          shipping: { address: "Nhận tại showroom QuadPro" },
          paymentMethod: "sandbox",
        }),
      });
      setCart([]);
      setCartOpen(false);
      await refreshProducts();
      setToast(`Đặt hàng thành công: #${order.id}`);
      setTimeout(() => setToast(""), 3500);
    } catch (requestError) {
      setToast(requestError.message);
      setTimeout(() => setToast(""), 3500);
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (adminView && session?.user.role === "admin") {
    return (
      <AdminDashboard
        user={session.user}
        onBack={leaveAdmin}
        onLogout={logout}
        onProductsChanged={refreshProducts}
      />
    );
  }

  if (accountView && session) {
    return (
      <AccountSettings
        session={session}
        onBack={leaveAccountSettings}
        onLogout={logout}
        onUserUpdated={handleUserUpdated}
      />
    );
  }

  return (
    <>
      <div className="top-strip">
        <span>Miễn phí giao hàng đơn từ 500K</span>
        <span>
          Hotline: <b>1900 6868</b>
        </span>
        <span>Hệ thống 12 showroom toàn quốc</span>
      </div>
      <header>
        <div className="header-main container">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Mở danh mục"
          >
            <Menu />
          </button>
          <a className="logo" href="/" onClick={openStorefront}>
            <span className="logo-mark">Q</span>
            <span>
              QUAD<b>PRO</b>
              <small>TECH & GAMING</small>
            </span>
          </a>
          <form
            className="search"
            onSubmit={(event) =>
              productId || catalogSelection
                ? openStorefrontSection(event, "#products")
                : event.preventDefault()
            }
          >
            <Search size={20} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bạn cần tìm sản phẩm gì?"
              aria-label="Tìm kiếm sản phẩm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Xóa tìm kiếm"
              >
                <X size={17} />
              </button>
            )}
          </form>
          <div className="header-actions">
            <button>
              <MapPin />
              <span>
                Showroom<small>Gần bạn</small>
              </span>
            </button>
            <button>
              <Truck />
              <span>
                Tra cứu<small>Đơn hàng</small>
              </span>
            </button>
            <div className="account-wrap">
              <button
                className="account-trigger"
                onClick={() =>
                  session
                    ? setAccountOpen((value) => !value)
                    : openAuth("login")
                }
              >
                <UserRound />
                <span>
                  {session
                    ? session.user.name.split(" ").slice(-1)[0]
                    : "Tài khoản"}
                  <small>
                    {session
                      ? session.user.role === "admin"
                        ? "Quản trị viên"
                        : "Thành viên"
                      : "Đăng nhập"}
                  </small>
                </span>
                {session && <ChevronDown size={14} />}
              </button>
              {session && accountOpen && (
                <div className="account-menu">
                  <div>
                    <span>{session.user.name.charAt(0).toUpperCase()}</span>
                    <p>
                      <b>{session.user.name}</b>
                      <small>{session.user.email}</small>
                    </p>
                  </div>
                  {session.user.role === "admin" && (
                    <button onClick={openAdmin}>
                      <LayoutDashboard size={17} /> Admin Dashboard
                    </button>
                  )}
                  <button onClick={openAccountSettings}>
                    <Settings size={17} /> Cài đặt tài khoản
                  </button>
                  <button onClick={logout}>
                    <LogOut size={17} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
            <button className="cart-trigger" onClick={() => setCartOpen(true)}>
              <ShoppingBag />
              <span>
                Giỏ hàng<small>{count} sản phẩm</small>
              </span>
              {count > 0 && <b>{count}</b>}
            </button>
          </div>
        </div>
        <nav className={menuOpen ? "nav-open" : ""}>
          <div className="container">
            <div
              className={`category-dropdown${categoryMenuOpen ? " open" : ""}`}
              onPointerLeave={hideCategoryMenu}
              onFocusCapture={showCategoryMenu}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  hideCategoryMenu();
                }
              }}
            >
              <button
                type="button"
                className="category-button"
                aria-haspopup="true"
                aria-expanded={categoryMenuOpen}
                aria-controls="category-flyout"
                onPointerEnter={queueCategoryMenu}
                onPointerLeave={clearCategoryMenuTimer}
              >
                <LayoutGrid size={18} /> DANH MỤC SẢN PHẨM
              </button>
              <div
                className={`category-flyout${menuDetails ? " expanded" : ""}`}
                id="category-flyout"
              >
                <aside className="category-menu" aria-label="Danh mục sản phẩm">
                  {categories.slice(0, 9).map((category) => {
                    const Icon = categoryIcons[category.icon] || Box;
                    const active = category.name === menuCategory;
                    return (
                      <button
                        type="button"
                        className={active ? "active" : ""}
                        key={category.name}
                        onPointerEnter={() => setMenuCategory(category.name)}
                        onFocus={() => setMenuCategory(category.name)}
                        onClick={(event) =>
                          openMenuSelection(event, category.name)
                        }
                      >
                        <Icon size={18} />
                        <span>{category.name}</span>
                        <ChevronRight size={15} />
                      </button>
                    );
                  })}
                </aside>

                {menuDetails && (
                  <section
                    className="category-mega-panel"
                    aria-labelledby="category-mega-title"
                  >
                    <div className="category-mega-content" key={menuCategory}>
                      <div className="category-mega-header">
                        <div>
                          <small>KHÁM PHÁ DANH MỤC</small>
                          <h2 id="category-mega-title">{menuCategory}</h2>
                        </div>
                        <button
                          type="button"
                          onClick={(event) =>
                            openMenuSelection(event, menuCategory)
                          }
                        >
                          Xem tất cả <ArrowRight size={16} />
                        </button>
                      </div>

                      <div className="category-option-grid">
                        {menuDetails.options.map((option) => (
                          <button
                            type="button"
                            key={option}
                            onClick={(event) =>
                              openMenuSelection(event, menuCategory, option)
                            }
                          >
                            <span>{option}</span>
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>

                      <div className="category-brands">
                        <small>THƯƠNG HIỆU NỔI BẬT</small>
                        <div>
                          {menuBrands.map((brand) => (
                            <button
                              type="button"
                              key={brand}
                              onClick={(event) =>
                                openMenuSelection(event, menuCategory, "", brand)
                              }
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
            <a
              href="/#deals"
              onClick={(event) => openStorefrontSection(event, "#deals")}
            >
              <Zap size={17} /> Flash Sale
            </a>
            <a
              href="/#products"
              onClick={(event) =>
                openStorefrontSection(event, "#products", "PC Gaming")
              }
            >
              PC Gaming
            </a>
            <a
              href="/#products"
              onClick={(event) =>
                openStorefrontSection(event, "#products", "Laptop")
              }
            >
              Laptop
            </a>
            <a
              href="/#products"
              onClick={(event) =>
                openStorefrontSection(event, "#products", "Tất cả")
              }
            >
              Linh kiện
            </a>
            <a
              href="/#products"
              onClick={(event) =>
                openStorefrontSection(event, "#products", "Màn hình")
              }
            >
              Màn hình
            </a>
            <a
              href="/#products"
              onClick={(event) =>
                openStorefrontSection(event, "#products", "Tất cả")
              }
            >
              Gaming Gear
            </a>
            <a href="#support">Dịch vụ</a>
          </div>
        </nav>
      </header>

      <main>
        {productId ? (
          <ProductDetail
            product={productsLoaded ? selectedProduct : null}
            products={products}
            loading={!productsLoaded}
            highlights={selectedProduct ? getQuickViewHighlights(selectedProduct) : []}
            onBack={openStorefront}
            onOpenProduct={openProduct}
            onAdd={addToCart}
            onBuyNow={buyNow}
          />
        ) : selectedCatalogCategory ? (
          <CategoryCatalog
            key={`${catalogSelection.category}-${catalogSelection.option}-${catalogSelection.brand}`}
            category={selectedCatalogCategory}
            option={catalogSelection.option}
            initialBrand={catalogSelection.brand}
            products={catalogProducts}
            onBack={openStorefront}
            onAdd={addToCart}
            onOpen={openProduct}
          />
        ) : (
          <>
        <section className="hero container">
          <div className="hero-banner">
            <div className="hero-grid" aria-hidden="true"></div>
            <div className="hero-glow" aria-hidden="true"></div>
            <div className="hero-copy">
              <span className="eyebrow">QUADPRO BUILD STATION</span>
              <h1>
                SỨC MẠNH
                <br />
                <em>KHÔNG GIỚI HẠN</em>
              </h1>
              <p>
                PC Gaming RTX 40 Series. Tối ưu từng FPS.
                <br />
                Bảo hành tận nơi, nâng cấp trọn đời.
              </p>
              <a href="#products">
                KHÁM PHÁ NGAY <ArrowUpRight size={19} />
              </a>
            </div>
            <div className="pc-visual" aria-hidden="true">
              <div className="pc-case">
                <div className="fans">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                <div className="gpu">GEFORCE RTX</div>
              </div>
              <div className="price-float">
                <small>CHỈ TỪ</small>
                <b>16.990K</b>
              </div>
            </div>
            <div className="hero-dots">
              <i></i>
              <i className="active"></i>
              <i></i>
            </div>
          </div>
          <div className="side-promos">
            <article className="promo-one">
              <small>BACK TO SCHOOL</small>
              <b>
                LAPTOP
                <br />
                HỌC TẬP
              </b>
              <span>Giảm đến 3 triệu</span>
            </article>
            <article className="promo-two">
              <small>NÂNG CẤP GÓC MÁY</small>
              <b>
                GEAR XỊN
                <br />
                GIÁ ÊM
              </b>
              <span>Mua combo giảm 15%</span>
            </article>
          </div>
        </section>

        <section className="benefits container">
          <div>
            <ShieldCheck />
            <span>
              <b>Hàng chính hãng</b>
              <small>Cam kết 100% chính hãng</small>
            </span>
          </div>
          <div>
            <RefreshCcw />
            <span>
              <b>Đổi trả linh hoạt</b>
              <small>Miễn phí trong 7 ngày</small>
            </span>
          </div>
          <div>
            <Wrench />
            <span>
              <b>Bảo hành tận tâm</b>
              <small>Hỗ trợ kỹ thuật trọn đời</small>
            </span>
          </div>
          <div>
            <Truck />
            <span>
              <b>Giao hàng siêu tốc</b>
              <small>Nhận hàng trong 2 giờ</small>
            </span>
          </div>
        </section>

        <section className="category-section container">
          <div className="section-heading">
            <div>
              <span>KHÁM PHÁ</span>
              <h2>Danh mục nổi bật</h2>
            </div>
            <a href="#products">
              Xem tất cả <ArrowRight size={17} />
            </a>
          </div>
          <div className="category-grid">
            {categories.map((category) => {
              const Icon = categoryIcons[category.icon] || Box;
              return (
                <button
                  key={category.name}
                  onClick={() => openCatalog(category.name)}
                >
                  <span style={{ background: category.color }}>
                    <Icon size={31} />
                  </span>
                  <b>{category.name}</b>
                  <small>
                    {
                      products.filter(
                        (product) => product.category === category.name,
                      ).length
                    }{" "}
                    sản phẩm
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="deal-section" id="deals">
          <div className="container">
            <div className="deal-header">
              <div>
                <span className="flash">
                  <Zap fill="currentColor" /> FLASH SALE
                </span>
                <p>Kết thúc sau</p>
                <div className="countdown">
                  <b>08</b>:<b>24</b>:<b>36</b>
                </div>
              </div>
              <button>
                Xem tất cả <ArrowRight size={17} />
              </button>
            </div>
            <div className="products-grid">
              {products.slice(0, 5).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                  onOpen={openProduct}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="products-section container" id="products">
          <div className="section-heading">
            <div>
              <span>SẢN PHẨM</span>
              <h2>Dành riêng cho bạn</h2>
            </div>
            <div className="filter-tabs">
              <button
                className={activeCategory === "Tất cả" ? "active" : ""}
                onClick={() => setActiveCategory("Tất cả")}
              >
                Tất cả
              </button>
              {["PC Gaming", "Laptop", "Màn hình", "VGA - Card đồ họa"].map(
                (item) => (
                  <button
                    className={activeCategory === item ? "active" : ""}
                    onClick={() => setActiveCategory(item)}
                    key={item}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
          </div>
          {filtered.length ? (
            <div className="product-category-showcase">
              {productGroups.map((group) => (
                <CategoryProductCarousel
                  key={group.category.name}
                  category={group.category}
                  products={group.products}
                  onAdd={addToCart}
                  onOpen={openProduct}
                  onSelectOption={(option) =>
                    openCatalog(group.category.name, option)
                  }
                  onViewAll={() => openCatalog(group.category.name)}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <SearchX size={44} />
              <h3>Không tìm thấy sản phẩm</h3>
              <p>Thử từ khóa hoặc danh mục khác nhé.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveCategory("Tất cả");
                }}
              >
                Xem tất cả sản phẩm
              </button>
            </div>
          )}
        </section>

        <section className="build-cta container">
          <div>
            <span>PC BUILDER THÔNG MINH</span>
            <h2>Tự build cấu hình trong 5 phút</h2>
            <p>
              Kiểm tra tương thích tự động, dự toán hiệu năng và tối ưu cấu hình
              theo ngân sách của bạn.
            </p>
            <button>
              Bắt đầu build PC <ArrowRight size={18} />
            </button>
          </div>
          <div className="build-stats">
            <div>
              <b>12K+</b>
              <span>Cấu hình đã build</span>
            </div>
            <div>
              <b>98%</b>
              <span>Khách hàng hài lòng</span>
            </div>
            <div>
              <b>24/7</b>
              <span>Kỹ thuật hỗ trợ</span>
            </div>
          </div>
        </section>
          </>
        )}
      </main>

      <footer id="support">
        <div className="container footer-grid">
          <div>
            <a className="logo light" href="/" onClick={openStorefront}>
              <span className="logo-mark">Q</span>
              <span>
                QUAD<b>PRO</b>
                <small>TECH & GAMING</small>
              </span>
            </a>
            <p>
              Hệ thống bán lẻ linh kiện máy tính, gaming gear và thiết bị công
              nghệ chính hãng.
            </p>
            <div className="social">
              <Facebook />
              <Youtube />
              <Instagram />
            </div>
          </div>
          <div>
            <h3>Hỗ trợ khách hàng</h3>
            <a>Hướng dẫn mua hàng</a>
            <a>Chính sách bảo hành</a>
            <a>Chính sách đổi trả</a>
            <a>Vận chuyển & thanh toán</a>
          </div>
          <div>
            <h3>Về QuadPro</h3>
            <a>Giới thiệu công ty</a>
            <a>Hệ thống showroom</a>
            <a>Tuyển dụng</a>
            <a>Tin công nghệ</a>
          </div>
          <div>
            <h3>Tổng đài hỗ trợ</h3>
            <strong>1900 6868</strong>
            <small>08:00 - 21:30 (Tất cả các ngày)</small>
            <h3>Đăng ký nhận ưu đãi</h3>
            <div className="newsletter">
              <input placeholder="Email của bạn" />
              <button>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="copyright container">
          © 2026 QUADPRO. Thiết kế và phát triển cho đồ án E-commerce Level 3.
          <span>Visa • Mastercard • Stripe</span>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
      <div
        className={`drawer-backdrop ${cartOpen ? "show" : ""}`}
        onClick={() => setCartOpen(false)}
      ></div>
      <aside
        className={`cart-drawer ${cartOpen ? "open" : ""}`}
        aria-label="Giỏ hàng"
      >
        <div className="drawer-header">
          <h2>
            Giỏ hàng <span>({count})</span>
          </h2>
          <button onClick={() => setCartOpen(false)}>
            <X />
          </button>
        </div>
        {cart.length ? (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <img src={item.image} alt="" />
                  <div>
                    <b>{item.name}</b>
                    <strong>{formatPrice(item.price)}</strong>
                    <div className="quantity">
                      <button onClick={() => updateQuantity(item.id, -1)}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="remove"
                    onClick={() =>
                      setCart((c) => c.filter((x) => x.id !== item.id))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <div>
                <span>Tạm tính</span>
                <b>{formatPrice(total)}</b>
              </div>
              <small>
                {session
                  ? `Thanh toán với ${session.user.email}`
                  : "Đăng nhập để tiếp tục thanh toán"}
              </small>
              <button onClick={checkout} disabled={checkoutLoading}>
                {checkoutLoading
                  ? "ĐANG TẠO ĐƠN..."
                  : session
                    ? "THANH TOÁN SANDBOX"
                    : "ĐĂNG NHẬP ĐỂ THANH TOÁN"}{" "}
                <ArrowRight size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="cart-empty">
            <ShoppingBag size={52} />
            <h3>Giỏ hàng đang trống</h3>
            <p>Khám phá các deal công nghệ đang chờ bạn.</p>
            <button onClick={() => setCartOpen(false)}>Tiếp tục mua sắm</button>
          </div>
        )}
      </aside>
      {toast && (
        <div className="toast">
          <CheckCircle2 size={20} />
          {toast}
        </div>
      )}
      <button className="chat-fab" aria-label="Chat hỗ trợ">
        <MessageCircle fill="currentColor" />
      </button>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
