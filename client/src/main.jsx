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
  Moon,
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
  Sun,
  Trash2,
  Truck,
  UserRound,
  Wrench,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { categories as defaultCategories, categoryMenus, fallbackProducts } from "./data";
import {
  api,
  clearSession,
  restoreAuthenticatedUser,
  saveSession,
} from "./api";
import AccountSettings from "./components/AccountSettings";
import AdminDashboard from "./components/AdminDashboard";
import AuthModal from "./components/AuthModal";
import CheckoutPage from "./components/CheckoutPage";
import ProductDetail from "./components/ProductDetail";
import "./styles.css";
import "./admin.css";

const THEME_KEY = "quadpro-theme";
const defaultTransitionSettings = {
  productGalleryIntervalSeconds: 5,
  productGalleryTransition: "slide",
  productGalleryVariant: "slide-right",
  productGalleryDurationMs: 480,
  productGalleryEasing: "cubic-bezier(0.25, 1, 0.5, 1)",
  productCarouselTransition: "slide",
  productCarouselDurationMs: 860,
  productCarouselEasing: "smooth",
};

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    // Use the operating-system preference when storage is unavailable.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

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
const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
const productIdFromPath = (pathname = window.location.pathname) => {
  const match = pathname.match(/^\/products\/(\d+)(?:-[^/]*)?\/?$/);
  return match ? Number(match[1]) : null;
};
const productPath = (product) => `/products/${product.id}-${toSlug(product.name)}`;
const catalogSelectionFromLocation = (
  pathname = window.location.pathname,
  search = window.location.search,
  categoryList = defaultCategories,
) => {
  const match = pathname.match(/^\/categories\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;

  const category = categoryList.find((item) => toSlug(item.name) === match[1]);
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

// Category tabs are merchandising tags rather than database categories. Keep
// the matching rules in one place so every tab opens a genuinely filtered list.
const matchesCategoryOption = (product, option = "") => {
  if (!option) return true;

  const optionText = normalizeSearchText(option);
  const explicitTags = [product.tags, product.tag]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .map(normalizeSearchText);
  if (explicitTags.some((tag) => tag === optionText || tag.includes(optionText))) {
    return true;
  }

  const text = normalizeSearchText(
    [product.name, product.brand, product.description].filter(Boolean).join(" "),
  );
  const price = Number(product.price) || 0;

  const rules = {
    "pc gaming gia re": () => price < 25_000_000,
    "pc stream game": () => /stream|streamer|creator/.test(text),
    "pc gaming premium": () =>
      price >= 25_000_000 || /premium|core ultra|i7|i9|ryzen 7|ryzen 9|rtx 4080|rtx 4090|rtx 5080|rtx 5090/.test(text),
    "pc intel gaming": () => /intel|core ultra|core i[3579]|\bi[3579]\b/.test(text),
    "pc gaming cao cap": () =>
      price >= 40_000_000 || /cao cap|flagship|i9|ryzen 9|rtx 4080|rtx 4090|rtx 5080|rtx 5090/.test(text),
    "pc amd gaming": () => /amd|ryzen/.test(text),
    "pc mini": () => /mini|small form|sff|mini itx/.test(text),
    "pc ai tri tue nhan tao": () => /\bai\b|tri tue nhan tao/.test(text),
  };
  const rule = rules[optionText];
  if (rule) return rule();

  // For tags not requiring a price tier, match all meaningful words in the
  // product metadata (e.g. "Laptop Gaming", "Màn hình 2K", "RAM DDR5").
  const keywords = optionText.split(/\s+/).filter((word) => word.length > 1);
  return keywords.length > 0 && keywords.every((keyword) => text.includes(keyword));
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
        {product.description?.trim() && (
          <p className="quick-view-description">{product.description}</p>
        )}
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
  carouselTransition = "slide",
  carouselDuration = 860,
  carouselEasing = "smooth",
  onAdd,
  onOpen,
  onSelectOption,
  onViewAll,
}) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const scrollAnimationRef = useRef(null);
  const titleId = useId();
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const menuOptions = (categoryMenus[category.name]?.options || []).slice(0, 5);

  function animateTrackTo(track, target) {
    if (scrollAnimationRef.current) {
      window.cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      track.scrollLeft = target;
      return;
    }

    const start = track.scrollLeft;
    const distance = target - start;
    const duration = Math.max(400, Number(carouselDuration) || 860);
    const startedAt = performance.now();
    const easeInOut = (progress) => {
      if (carouselEasing === "linear") return progress;
      if (carouselEasing === "soft") {
        return progress < 0.5
          ? 8 * progress ** 4
          : 1 - Math.pow(-2 * progress + 2, 4) / 2;
      }
      return progress < 0.5
        ? 4 * progress ** 3
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    };

    const frame = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      track.scrollLeft = start + distance * easeInOut(progress);
      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(frame);
      } else {
        scrollAnimationRef.current = null;
        setTransitioning(false);
      }
    };

    setTransitioning(true);
    scrollAnimationRef.current = window.requestAnimationFrame(frame);
  }

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

    animateTrackTo(track, nextPosition);
  }

  const advanceProducts = useEffectEvent(() => scrollProducts(1));

  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        window.cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

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

    const interval = window.setInterval(advanceProducts, 4000);
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
          className={`category-product-track${transitioning ? " is-transitioning" : ""}`}
          data-transition={carouselTransition}
          data-easing={carouselEasing}
          style={{ "--carousel-transition-duration": `${Math.max(400, Number(carouselDuration) || 860)}ms` }}
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
  const [theme, setTheme] = useState(loadTheme);
  const [products, setProducts] = useState(fallbackProducts);
  const [categories, setCategories] = useState(defaultCategories);
  const [showrooms, setShowrooms] = useState([]);
  const [transitionSettings, setTransitionSettings] = useState(defaultTransitionSettings);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCategory, setMenuCategory] = useState(null);
  const [toast, setToast] = useState("");
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountView, setAccountView] = useState(() =>
    window.location.pathname.startsWith("/account"),
  );
  const [checkoutView, setCheckoutView] = useState(() =>
    window.location.pathname.startsWith("/checkout"),
  );
  const [adminView, setAdminView] = useState(() =>
    window.location.pathname.startsWith("/admin"),
  );
  const [productId, setProductId] = useState(productIdFromPath);
  const [catalogSelection, setCatalogSelection] = useState(
    () => catalogSelectionFromLocation(window.location.pathname, window.location.search, defaultCategories),
  );
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [showroomOpen, setShowroomOpen] = useState(false);
  const categoryMenuTimerRef = useRef(null);
  const paymentReturnHandledRef = useRef(false);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The selected theme still applies for the current session.
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  async function refreshProducts() {
    try {
      setProducts(await api("/api/products"));
    } catch {
      /* Fallback products keep the storefront usable. */
    } finally {
      setProductsLoaded(true);
    }
  }

  async function refreshShowrooms() {
    try {
      setShowrooms(await api("/api/showrooms"));
    } catch {
      setShowrooms([]);
    }
  }

  async function refreshCategories() {
    try {
      const loadedCategories = await api("/api/categories");
      if (Array.isArray(loadedCategories) && loadedCategories.length) {
        setCategories(loadedCategories);
      }
    } catch {
      /* Static categories keep the storefront usable while the API is unavailable. */
    }
  }

  async function refreshSettings() {
    try {
      const settings = await api("/api/settings");
      setTransitionSettings({ ...defaultTransitionSettings, ...settings });
    } catch {
      /* The default interval keeps the gallery usable while settings load. */
    }
  }

  useEffect(() => {
    refreshProducts();
    refreshCategories();
    refreshShowrooms();
    refreshSettings();
  }, []);
  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const { user } = await restoreAuthenticatedUser();
        if (!active) return;
        const restored = { user };
        setSession(restored);
        saveSession(restored);
      } catch {
        if (!active) return;
        clearSession();
        setSession(null);
      } finally {
        if (active) setSessionReady(true);
      }
    }
    restoreSession();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");
    if (!paymentResult || paymentReturnHandledRef.current) return;

    if (paymentResult === "stripe-cancelled" && sessionReady) {
      paymentReturnHandledRef.current = true;
      const cancelledOrderId = params.get("order_id");
      window.history.replaceState({}, "", "/checkout");
      setCheckoutView(true);
      if (!session || !cancelledOrderId) {
        setToast("Bạn đã hủy thanh toán Stripe. Giỏ hàng vẫn được giữ lại.");
        setTimeout(() => setToast(""), 4000);
        return;
      }
      api(`/api/payments/stripe/orders/${encodeURIComponent(cancelledOrderId)}/cancel`, {
        method: "POST",
      })
        .then(() => {
          refreshProducts();
          setToast("Đã hủy thanh toán Stripe và hoàn lại tồn kho. Giỏ hàng vẫn được giữ lại.");
        })
        .catch((paymentError) => setToast(paymentError.message))
        .finally(() => setTimeout(() => setToast(""), 5000));
      return;
    }

    if ((paymentResult === "vnpay-success" || paymentResult === "vnpay-failed") && sessionReady) {
      paymentReturnHandledRef.current = true;
      const orderId = params.get("order_id");
      window.history.replaceState({}, "", "/checkout");
      setCheckoutView(true);
      if (!session || !orderId) {
        setToast("Không thể xác minh kết quả thanh toán VNPay.");
        setTimeout(() => setToast(""), 5000);
        return;
      }
      api(`/api/payments/vnpay/orders/${encodeURIComponent(orderId)}`)
        .then(({ paymentStatus, order }) => {
          if (paymentResult !== "vnpay-success" || paymentStatus !== "paid") {
            throw new Error("Thanh toán VNPay chưa thành công. Bạn có thể chọn lại phương thức thanh toán.");
          }
          setCart([]);
          setCheckoutView(false);
          window.history.replaceState({}, "", "/");
          refreshProducts();
          setToast(`Thanh toán VNPay thành công. Đơn #${order.id} đã được xác nhận.`);
        })
        .catch((paymentError) => setToast(paymentError.message))
        .finally(() => setTimeout(() => setToast(""), 5000));
      return;
    }

    if (paymentResult !== "stripe-success" || !sessionReady) return;
    paymentReturnHandledRef.current = true;
    const checkoutSessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname || "/");

    if (!session || !checkoutSessionId) {
      setToast("Không thể xác minh phiên thanh toán Stripe.");
      setTimeout(() => setToast(""), 4000);
      return;
    }

    api(`/api/payments/stripe/session/${encodeURIComponent(checkoutSessionId)}`)
      .then(({ paymentStatus, order }) => {
        if (paymentStatus !== "paid") throw new Error("Stripe chưa xác nhận thanh toán thành công");
        setCart([]);
        setCartOpen(false);
        setCheckoutView(false);
        window.history.replaceState({}, "", "/");
        refreshProducts();
        setToast(`Thanh toán thành công. Đơn #${order.id} đã được xác nhận.`);
      })
      .catch((paymentError) => setToast(paymentError.message))
      .finally(() => setTimeout(() => setToast(""), 5000));
  }, [sessionReady, session]);
  useEffect(
    () => localStorage.setItem("quadpro-cart", JSON.stringify(cart)),
    [cart],
  );
  useEffect(() => {
    if (!sessionReady) return;
    const isAdminRoute = window.location.pathname.startsWith("/admin");
    const isAccountRoute = window.location.pathname.startsWith("/account");
    const isCheckoutRoute = window.location.pathname.startsWith("/checkout");
    if (!isAdminRoute && !isAccountRoute && !isCheckoutRoute) return;
    if (!session) openAuth("login");
    else if (isAdminRoute && session.user.role !== "admin") leaveAdmin();
  }, [sessionReady, session]);
  useEffect(() => {
    const syncRoute = () => {
      const isAdminRoute = window.location.pathname.startsWith("/admin");
      const isAccountRoute = window.location.pathname.startsWith("/account");
      const isCheckoutRoute = window.location.pathname.startsWith("/checkout");
      setAdminView(isAdminRoute);
      setAccountView(isAccountRoute);
      setCheckoutView(isCheckoutRoute);
      setProductId(productIdFromPath());
      setCatalogSelection(catalogSelectionFromLocation(window.location.pathname, window.location.search, categories));
      if (sessionReady && (isAdminRoute || isAccountRoute || isCheckoutRoute) && !session) openAuth("login");
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [categories, sessionReady, session]);
  useEffect(
    () => () => window.clearTimeout(categoryMenuTimerRef.current),
    [],
  );

  const normalizedQuery = normalizeSearchText(query.trim());
  const filtered = products.filter((product) => {
    const matchesSearch = [product.name, product.brand, product.category].some(
      (value) => normalizeSearchText(value).includes(normalizedQuery),
    );
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
  const searchSuggestions = normalizedQuery ? filtered.slice(0, 5) : [];
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
        (product) =>
          product.category === selectedCatalogCategory.name &&
          matchesCategoryOption(product, catalogSelection.option),
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
    setCheckoutView(false);
    setProductId(null);
    setCatalogSelection(null);
    setAccountOpen(false);
  }

  function leaveAdmin() {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    refreshSettings();
    setAdminView(false);
    setAccountView(false);
    setCheckoutView(false);
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
    setCheckoutView(false);
    setProductId(null);
    setCatalogSelection(null);
    setAccountOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openOrderTracking() {
    if (window.location.pathname !== "/account/orders") {
      window.history.pushState({}, "", "/account/orders");
    }
    setAdminView(false);
    setAccountView(true);
    setCheckoutView(false);
    setProductId(null);
    setCatalogSelection(null);
    setAccountOpen(false);
    setShowroomOpen(false);
    if (!session) openAuth("login");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leaveAccountSettings() {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setAccountView(false);
    setCheckoutView(false);
    setProductId(null);
    setCatalogSelection(null);
  }

  function openProduct(product) {
    window.history.pushState({}, "", productPath(product));
    setProductId(product.id);
    setCatalogSelection(null);
    setAdminView(false);
    setAccountView(false);
    setCheckoutView(false);
    setAccountOpen(false);
    setSearchOpen(false);
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
    setCheckoutView(false);
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
    setCheckoutView(false);
    setMenuOpen(false);
    setCategoryMenuOpen(false);
    setMenuCategory(null);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" }),
      ),
    );
  }

  function submitProductSearch(event) {
    setActiveCategory("Tất cả");
    setSearchOpen(false);
    openStorefrontSection(event, "#products");
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
    setCheckoutView(false);
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

  function openCheckout() {
    if (!session) {
      setCartOpen(false);
      openAuth("login");
      return;
    }
    if (!cart.length) return;
    window.history.pushState({}, "", "/checkout");
    setCheckoutView(true);
    setAdminView(false);
    setAccountView(false);
    setProductId(null);
    setCatalogSelection(null);
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leaveCheckout() {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setCheckoutView(false);
    setCartOpen(true);
  }

  function handleUserUpdated(user) {
    const updatedSession = { user };
    setSession(updatedSession);
    saveSession(updatedSession);
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", auth: false });
    } finally {
      clearSession();
      setSession(null);
      setAccountView(false);
      setAdminView(false);
      setCheckoutView(false);
      if (
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname.startsWith("/account") ||
        window.location.pathname.startsWith("/checkout")
      )
        window.history.replaceState({}, "", "/");
      setAccountOpen(false);
      setToast("Đã đăng xuất an toàn");
      setTimeout(() => setToast(""), 2200);
    }
  }

  async function checkout(paymentMethod = "cod", customer = {}) {
    if (!session) {
      setCartOpen(false);
      openAuth("login");
      return;
    }
    setCheckoutLoading(paymentMethod);
    try {
      const request = {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customer: { name: customer.name, phone: customer.phone },
          shipping: { address: customer.address },
          paymentMethod,
        }),
      };

      if (paymentMethod === "stripe") {
        const { checkoutUrl } = await api("/api/payments/stripe/checkout", request);
        window.location.assign(checkoutUrl);
        return;
      }

      if (paymentMethod === "vnpay") {
        const { paymentUrl } = await api("/api/payments/vnpay/checkout", request);
        window.location.assign(paymentUrl);
        return;
      }

      const order = await api("/api/orders", request);
      setCart([]);
      setCartOpen(false);
      setCheckoutView(false);
      window.history.replaceState({}, "", "/");
      await refreshProducts();
      setToast(`Đặt hàng thành công: #${order.id}`);
      setTimeout(() => setToast(""), 3500);
    } catch (requestError) {
      setToast(requestError.message);
      setTimeout(() => setToast(""), 3500);
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (!sessionReady) {
    return (
      <div className="session-restore-screen" role="status" aria-live="polite">
        <span className="session-restore-spinner" aria-hidden="true" />
        <b>Đang khôi phục phiên đăng nhập...</b>
      </div>
    );
  }

  if (adminView && session?.user.role === "admin") {
    return (
      <AdminDashboard
        user={session.user}
        onBack={leaveAdmin}
        onLogout={logout}
        onProductsChanged={refreshProducts}
        onShowroomsChanged={refreshShowrooms}
        onTransitionSettingsChanged={(updated) => setTransitionSettings({ ...defaultTransitionSettings, ...updated })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (accountView && session) {
    return (
      <AccountSettings
        session={session}
        initialTab={window.location.pathname.startsWith("/account/orders") ? "orders" : window.location.pathname.startsWith("/account/password") ? "password" : "profile"}
        onBack={leaveAccountSettings}
        onLogout={logout}
        onUserUpdated={handleUserUpdated}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (checkoutView && session) {
    return (
      <>
        <CheckoutPage
          user={session.user}
          cart={cart}
          loading={checkoutLoading}
          onBack={leaveCheckout}
          onSubmit={checkout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {toast && <div className="toast"><CheckCircle2 size={20}/>{toast}</div>}
      </>
    );
  }

  return (
    <>
      <div className="top-strip">
        <span>Miễn phí giao hàng đơn từ 500K</span>
        <span>
          Hotline: <b>1900 6868</b>
        </span>
        <span>{showrooms.length ? `Hệ thống ${showrooms.length} showroom toàn quốc` : "Hệ thống showroom toàn quốc"}</span>
      </div>
      <header className="site-header">
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
            role="search"
            onSubmit={submitProductSearch}
            onFocus={() => setSearchOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setSearchOpen(false);
              }
            }}
          >
            <button
              className="search-submit"
              type="submit"
              aria-label="Tìm kiếm sản phẩm"
            >
              <Search size={20} aria-hidden="true" />
            </button>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveCategory("Tất cả");
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Bạn cần tìm sản phẩm gì?"
              aria-label="Tìm kiếm sản phẩm"
              aria-autocomplete="list"
              aria-expanded={searchOpen && Boolean(normalizedQuery)}
              aria-controls="header-search-results"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveCategory("Tất cả");
                  setSearchOpen(false);
                }}
                aria-label="Xóa tìm kiếm"
              >
                <X size={17} />
              </button>
            )}
            {searchOpen && normalizedQuery && (
              <div
                className="header-search-results"
                id="header-search-results"
                aria-label="Gợi ý sản phẩm"
              >
                {searchSuggestions.length ? (
                  <>
                    {searchSuggestions.map((product) => (
                      <button
                        className="header-search-result"
                        type="button"
                        key={product.id}
                        onClick={() => openProduct(product)}
                      >
                        <img src={product.image} alt="" />
                        <span>
                          <small>
                            {product.brand} • {product.category}
                          </small>
                          <strong>{product.name}</strong>
                        </span>
                        <b>{formatPrice(product.price)}</b>
                      </button>
                    ))}
                    <button className="header-search-all" type="submit">
                      Xem tất cả {filtered.length} kết quả
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <div className="header-search-empty">
                    <SearchX size={21} aria-hidden="true" />
                    <span>Không tìm thấy sản phẩm phù hợp</span>
                  </div>
                )}
              </div>
            )}
          </form>
          <div className="header-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>
                Giao diện<small>{theme === "dark" ? "Sáng" : "Tối"}</small>
              </span>
            </button>
            <div
              className="showroom-wrap"
              onMouseEnter={() => setShowroomOpen(true)}
              onMouseLeave={() => setShowroomOpen(false)}
              onFocus={() => setShowroomOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setShowroomOpen(false);
              }}
            >
              <button
                className="showroom-trigger"
                type="button"
                onClick={() => setShowroomOpen((value) => !value)}
                aria-expanded={showroomOpen}
                aria-controls="showroom-menu"
              >
                <MapPin />
                <span>
                  Showroom<small>{showrooms.length ? `${showrooms.length} địa điểm` : "Gần bạn"}</small>
                </span>
              </button>
              {showroomOpen && (
                <div className="showroom-menu" id="showroom-menu">
                  <header>
                    <span>HỆ THỐNG QUADPRO</span>
                    <b>Showroom gần bạn</b>
                  </header>
                  {showrooms.length ? (
                    <div className="showroom-list">
                      {showrooms.map((showroom) => {
                        const mapUrl = showroom.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(showroom.address)}`;
                        return (
                          <a href={mapUrl} target="_blank" rel="noreferrer" key={showroom.id}>
                            <MapPin size={18} aria-hidden="true" />
                            <span>
                              <b>{showroom.name}</b>
                              <small>{showroom.address}</small>
                              {(showroom.openingHours || showroom.phone) && (
                                <em>{[showroom.openingHours, showroom.phone].filter(Boolean).join(" • ")}</em>
                              )}
                            </span>
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="showroom-empty">Danh sách showroom đang được cập nhật.</div>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={openOrderTracking}>
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
            galleryInterval={transitionSettings.productGalleryIntervalSeconds}
            galleryTransition={transitionSettings.productGalleryTransition}
            galleryDuration={transitionSettings.productGalleryDurationMs}
            galleryVariant={transitionSettings.productGalleryVariant}
            galleryEasing={transitionSettings.productGalleryEasing}
            onBack={openStorefront}
            onOpenCategory={(category) => openCatalog(category)}
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
            <form
              className="products-search"
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveCategory("Tất cả");
                }}
                placeholder="Tìm kiếm sản phẩm..."
                aria-label="Tìm kiếm trong danh sách sản phẩm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Xóa nội dung tìm kiếm"
                >
                  <X size={17} />
                </button>
              )}
            </form>
          </div>
          {filtered.length ? (
            <div className="product-category-showcase">
              {productGroups.map((group) => (
                <CategoryProductCarousel
                  key={group.category.name}
                  category={group.category}
                  products={group.products}
                  carouselTransition={transitionSettings.productCarouselTransition}
                  carouselDuration={transitionSettings.productCarouselDurationMs}
                  carouselEasing={transitionSettings.productCarouselEasing}
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
            <a
              href="/documents/huong-dan-mua-hang-quadshop.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hướng dẫn mua hàng
            </a>
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
          <div className="footer-payment-methods" aria-label="Các phương thức thanh toán được hỗ trợ">
            <span className="footer-payment-label">Thanh toán an toàn:</span>
            <span className="payment-brand payment-brand-visa" role="img" aria-label="Visa" title="Visa">VISA</span>
            <span className="payment-brand payment-brand-mastercard" role="img" aria-label="Mastercard" title="Mastercard"><i/><i/></span>
            <span className="payment-brand payment-brand-stripe" role="img" aria-label="Stripe" title="Stripe">stripe</span>
            <span className="payment-brand payment-brand-vnpay" role="img" aria-label="VNPay" title="VNPay"><b>VN</b><em>PAY</em></span>
          </div>
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
              <small>{session ? `Đặt hàng với ${session.user.email}` : "Đăng nhập để tiếp tục đặt hàng"}</small>
              <button onClick={openCheckout}>
                {session ? "TIẾN HÀNH ĐẶT HÀNG" : "ĐĂNG NHẬP ĐỂ ĐẶT HÀNG"} <ArrowRight size={18}/>
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
