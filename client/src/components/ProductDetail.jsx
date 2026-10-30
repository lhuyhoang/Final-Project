import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Gift,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Wrench,
} from "lucide-react";

const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN").format(value || 0) + "₫";

const normalizeRecommendationText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function getNameSimilarity(firstName, secondName) {
  const firstTokens = new Set(
    normalizeRecommendationText(firstName).split(" ").filter((token) => token.length > 1),
  );
  const secondTokens = new Set(
    normalizeRecommendationText(secondName).split(" ").filter((token) => token.length > 1),
  );
  if (!firstTokens.size || !secondTokens.size) return 0;
  const sharedTokens = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  return sharedTokens / Math.min(firstTokens.size, secondTokens.size);
}

function getRelatedProducts(product, products, limit = 4) {
  const productPrice = Math.max(Number(product.price) || 0, 1);
  const productCategory = normalizeRecommendationText(product.category);
  const productBrand = normalizeRecommendationText(product.brand);

  return products
    .filter(
      (item) =>
        item.id !== product.id &&
        normalizeRecommendationText(item.category) === productCategory,
    )
    .map((item) => {
      const sameBrand = normalizeRecommendationText(item.brand) === productBrand;
      const nameSimilarity = getNameSimilarity(product.name, item.name);
      const priceDifference = Math.abs((Number(item.price) || 0) - productPrice) / productPrice;
      const priceScore = Math.max(0, 40 - priceDifference * 65);
      const highPriceDifferencePenalty = priceDifference > 0.6
        ? (priceDifference - 0.6) * 70
        : 0;

      return {
        product: item,
        priceDifference,
        score:
          (sameBrand ? 45 : 0) +
          nameSimilarity * 35 +
          priceScore -
          highPriceDifferencePenalty,
      };
    })
    .sort((first, second) =>
      second.score - first.score ||
      first.priceDifference - second.priceDifference ||
      (Number(second.product.rating) || 0) - (Number(first.product.rating) || 0),
    )
    .slice(0, limit)
    .map((item) => item.product);
}

function galleryKeyframes(variant) {
  switch (variant) {
    case "fade-black": return { base: [{ opacity: 1 }, { opacity: 0 }], top: [{ opacity: 0 }, { opacity: 1 }] };
    case "fade-zoom": return { top: [{ opacity: 0, transform: "scale(1.15)" }, { opacity: 1, transform: "scale(1)" }] };
    case "kenburns-in": return { top: [{ opacity: 0, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.12)" }] };
    case "kenburns-out": return { top: [{ opacity: 0, transform: "scale(1.2)" }, { opacity: 1, transform: "scale(1)" }] };
    case "scale-pulse": return { top: [{ opacity: 0, transform: "scale(.85)" }, { opacity: 1, transform: "scale(1)" }] };
    case "slide-right": return { top: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }] };
    case "slide-up": return { top: [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }] };
    case "slide-push": return { base: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }], top: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }] };
    case "flip-y": return { base: [{ opacity: 1, transform: "perspective(1000px) rotateY(0)" }, { opacity: 0, transform: "perspective(1000px) rotateY(90deg)" }], top: [{ opacity: 0, transform: "perspective(1000px) rotateY(-90deg)" }, { opacity: 1, transform: "perspective(1000px) rotateY(0)" }] };
    case "flip-x": return { top: [{ opacity: 0, transform: "perspective(1000px) rotateX(90deg)" }, { opacity: 1, transform: "perspective(1000px) rotateX(0)" }] };
    case "cube-rot": return { base: [{ transform: "perspective(1000px) rotateY(0) translateZ(0)" }, { transform: "perspective(1000px) rotateY(-90deg) translateZ(200px)" }], top: [{ opacity: 0, transform: "perspective(1000px) rotateY(90deg) translateZ(200px)" }, { opacity: 1, transform: "perspective(1000px) rotateY(0) translateZ(0)" }] };
    case "clip-circle": return { top: [{ clipPath: "circle(0% at 50% 50%)", opacity: 1 }, { clipPath: "circle(100% at 50% 50%)", opacity: 1 }] };
    case "clip-diagonal": return { top: [{ clipPath: "polygon(0 0,0 0,0 100%,0 100%)", opacity: 1 }, { clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)", opacity: 1 }] };
    case "clip-diamond": return { top: [{ clipPath: "polygon(50% 50%,50% 50%,50% 50%,50% 50%)", opacity: 1 }, { clipPath: "polygon(50% -50%,150% 50%,50% 150%,-50% 50%)", opacity: 1 }] };
    case "gaussian-dissolve": return { top: [{ filter: "blur(20px)", opacity: 0, transform: "scale(1.08)" }, { filter: "blur(0)", opacity: 1, transform: "scale(1)" }] };
    case "frost-glass": return { top: [{ filter: "blur(15px) grayscale(100%)", opacity: 0 }, { filter: "blur(0) grayscale(0%)", opacity: 1 }] };
    default: return { top: [{ opacity: 0 }, { opacity: 1 }] };
  }
}

function ProductDetailState({ loading, onBack }) {
  return (
    <section className="product-detail-state container" aria-live="polite">
      <Package size={52} />
      <h1>{loading ? "Đang tải sản phẩm..." : "Không tìm thấy sản phẩm"}</h1>
      <p>
        {loading
          ? "QuadPro đang lấy thông tin mới nhất từ hệ thống."
          : "Sản phẩm có thể đã được cập nhật hoặc ngừng kinh doanh."}
      </p>
      {!loading && (
        <button type="button" onClick={onBack}>
          <ArrowLeft size={18} /> Quay lại cửa hàng
        </button>
      )}
    </section>
  );
}

function RelatedProduct({ product, onOpen, onAdd }) {
  const available = product.stock !== 0;
  return (
    <article className="related-product-card">
      <button
        type="button"
        className="related-product-image"
        onClick={() => onOpen(product)}
        aria-label={`Xem chi tiết ${product.name}`}
      >
        <img src={product.image} alt="" loading="lazy" />
        {product.discount > 0 && <span>-{product.discount}%</span>}
      </button>
      <div>
        <small>{product.brand}</small>
        <h3>
          <button type="button" onClick={() => onOpen(product)}>
            {product.name}
          </button>
        </h3>
        <strong>{formatPrice(product.price)}</strong>
        {product.oldPrice > product.price && (
          <del>{formatPrice(product.oldPrice)}</del>
        )}
        <footer>
          <span className={available ? "in-stock" : "sold-out"}>
            {available ? "Còn hàng" : "Hết hàng"}
          </span>
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={!available}
            aria-label={`Thêm ${product.name} vào giỏ`}
          >
            <ShoppingCart size={17} />
          </button>
        </footer>
      </div>
    </article>
  );
}

export default function ProductDetail({
  product,
  products,
  loading,
  galleryInterval = 5,
  galleryTransition = "slide",
  galleryDuration = 480,
  galleryVariant = "slide-right",
  galleryEasing = "cubic-bezier(0.25, 1, 0.5, 1)",
  onBack,
  onOpenCategory,
  onOpenProduct,
  onAdd,
  onBuyNow,
}) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState("");
  const [selectedUpgrades, setSelectedUpgrades] = useState({});
  const baseImageRef = useRef(null);
  const incomingImageRef = useRef(null);
  const previousImageRef = useRef("");
  const galleryAnimationsRef = useRef([]);

  useEffect(() => {
    if (!product) return undefined;
    setQuantity(1);
    setActiveImage(product.image);
    setSelectedUpgrades(Object.fromEntries(
      (Array.isArray(product.upgradeOptions) ? product.upgradeOptions : [])
        .map((group, index) => [index, Array.isArray(group.options) ? group.options[0] || "" : ""]),
    ));
    window.scrollTo({ top: 0, behavior: "auto" });
    const previousTitle = document.title;
    document.title = `${product.name} | QuadPro`;
    return () => {
      document.title = previousTitle;
    };
  }, [product?.id]);

  const gallery = product
    ? [
        product.image,
        ...(Array.isArray(product.gallery) ? product.gallery : []),
      ].filter((image, index, images) => image && images.indexOf(image) === index)
    : [];
  const galleryKey = gallery.join("|");

  useEffect(() => {
    if (!product || gallery.length < 2) return undefined;
    const interval = Math.max(2, Number(galleryInterval) || 5) * 1000;
    const timer = window.setInterval(() => {
      setActiveImage((current) => {
        const currentIndex = Math.max(0, gallery.indexOf(current));
        return gallery[(currentIndex + 1) % gallery.length];
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [galleryInterval, galleryKey, product?.id]);

  useEffect(() => {
    if (!product || !baseImageRef.current || !incomingImageRef.current) return undefined;
    const nextImage = activeImage || product.image;
    const base = baseImageRef.current;
    const incoming = incomingImageRef.current;
    galleryAnimationsRef.current.forEach((animation) => animation.cancel());
    base.src = previousImageRef.current || nextImage;
    incoming.src = nextImage;
    incoming.style.opacity = "0";
    incoming.style.transform = "none";
    incoming.style.filter = "none";
    incoming.style.clipPath = "none";
    base.style.opacity = "1";
    base.style.transform = "none";
    if (!previousImageRef.current || previousImageRef.current === nextImage) {
      previousImageRef.current = nextImage;
      return undefined;
    }
    const frames = galleryKeyframes(galleryVariant);
    const options = { duration: Math.max(200, Number(galleryDuration) || 480), easing: galleryEasing, fill: "forwards" };
    const incomingAnimation = incoming.animate(frames.top, options);
    const baseAnimation = frames.base ? base.animate(frames.base, options) : null;
    galleryAnimationsRef.current = [incomingAnimation, baseAnimation].filter(Boolean);
    incomingAnimation.onfinish = () => {
      base.src = nextImage;
      base.style.opacity = "1";
      base.style.transform = "none";
      incoming.style.opacity = "0";
      incoming.style.transform = "none";
      incoming.style.filter = "none";
      incoming.style.clipPath = "none";
      previousImageRef.current = nextImage;
    };
    return () => galleryAnimationsRef.current.forEach((animation) => animation.cancel());
  }, [activeImage, galleryKey, galleryVariant, galleryDuration, galleryEasing, product?.id]);

  if (!product) return <ProductDetailState loading={loading} onBack={onBack} />;

  const savings = Math.max(0, product.oldPrice - product.price);
  const stockKnown = Number.isInteger(product.stock);
  const stock = stockKnown ? product.stock : 99;
  const policyText =
    product.policyText || "Trả góp 0% • Bảo hành 36 tháng";
  const productDescription = product.description?.trim() ||
    `${product.name} là sản phẩm chính hãng từ ${product.brand}, phù hợp cho nhu cầu thuộc nhóm ${product.category.toLowerCase()}. Sản phẩm được QuadPro kiểm tra ngoại quan và chức năng trước khi bàn giao.`;
  const relatedProducts = getRelatedProducts(product, products);
  const basicSpecificationRows = [
    ["Mã sản phẩm", `QP-${String(product.id).padStart(5, "0")}`],
    ["Thương hiệu / hãng sản xuất", product.brand],
    ["Danh mục", product.category],
    ["Giá niêm yết", formatPrice(product.oldPrice)],
    ["Giá bán", formatPrice(product.price)],
    ["Tồn kho", stockKnown ? `${stock} sản phẩm` : "Đang cập nhật"],
    ["Đánh giá", `${product.rating}/5 từ ${product.reviews} lượt đánh giá`],
    ["Chính sách", policyText],
  ];
  const technicalSpecifications = Array.isArray(product.specifications)
    ? product.specifications.filter((item) => item?.description)
    : [];
  const upgradeOptions = Array.isArray(product.upgradeOptions)
    ? product.upgradeOptions.filter((group) => group?.name && Array.isArray(group.options) && group.options.length)
    : [];
  const promotions = Array.isArray(product.promotions)
    ? product.promotions.filter((promotion) => typeof promotion === "string" && promotion.trim())
    : [];
  const canBuy = stock > 0;

  function changeQuantity(change) {
    setQuantity((current) =>
      Math.min(Math.max(current + change, 1), Math.max(stock, 1)),
    );
  }

  function moveImage(direction) {
    if (gallery.length < 2) return;
    const currentIndex = Math.max(0, gallery.indexOf(activeImage || product.image));
    setActiveImage(gallery[(currentIndex + direction + gallery.length) % gallery.length]);
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        <nav className="product-breadcrumb" aria-label="Điều hướng sản phẩm">
          <button type="button" onClick={onBack}>
            Trang chủ
          </button>
          <ChevronRight size={15} aria-hidden="true" />
          <button
            type="button"
            className="breadcrumb-category"
            onClick={() => onOpenCategory?.(product.category)}
          >
            {product.category}
          </button>
          <ChevronRight size={15} aria-hidden="true" />
          <strong>{product.name}</strong>
        </nav>

        <section className="product-detail-hero" aria-labelledby="product-title">
          <div className="product-detail-gallery" data-depth="3">
            <div className="product-image-stage">
              <span className="product-image-grid" aria-hidden="true" />
              <span className="product-image-glow" aria-hidden="true" />
              {product.discount > 0 && (
                <span className="detail-discount">-{product.discount}%</span>
              )}
              {gallery.length > 1 && (
                <span className="product-image-counter" aria-live="polite">
                  {Math.max(0, gallery.indexOf(activeImage || product.image)) + 1} / {gallery.length}
                </span>
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="product-gallery-arrow previous"
                    onClick={() => moveImage(-1)}
                    aria-label="Xem ảnh trước"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    className="product-gallery-arrow next"
                    onClick={() => moveImage(1)}
                    aria-label="Xem ảnh tiếp theo"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
              <img ref={baseImageRef} className="product-gallery-layer base" src={product.image} alt={product.name} />
              <img ref={incomingImageRef} className="product-gallery-layer incoming" src={product.image} alt="" aria-hidden="true" />
            </div>
            <div className="product-thumbnails" aria-label="Hình ảnh sản phẩm">
              {gallery.map((image, index) => (
                <button
                  type="button"
                  className={image === (activeImage || product.image) ? "active" : ""}
                  onClick={() => setActiveImage(image)}
                  key={image}
                  aria-label={`Xem hình ${index + 1}`}
                  aria-pressed={image === (activeImage || product.image)}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
            {gallery.length > 1 && (
              <div className="product-gallery-meta">
                <span>Vuốt hoặc bấm mũi tên để xem ảnh</span>
                <small>Tự động chuyển ảnh</small>
              </div>
            )}
            <p>
              <BadgeCheck size={17} /> Hình ảnh sản phẩm được kiểm tra trước khi
              đăng bán
            </p>
          </div>

          <div className="product-detail-summary" data-depth="4">
            <div className="detail-kicker">
              <span>{product.category}</span>
              <b>{product.badge}</b>
            </div>
            <h1 id="product-title">{product.name}</h1>
            <div className="detail-rating-row">
              <span>
                <Star size={17} fill="currentColor" /> {product.rating}/5
              </span>
              <small>{product.reviews} lượt đánh giá</small>
              <i aria-hidden="true" />
              <small>Mã: QP-{String(product.id).padStart(5, "0")}</small>
            </div>

            <div className="detail-price-panel">
              <small>GIÁ QUADPRO</small>
              <div>
                <strong>{formatPrice(product.price)}</strong>
                {product.oldPrice > product.price && (
                  <del>{formatPrice(product.oldPrice)}</del>
                )}
              </div>
              {savings > 0 && <span>Tiết kiệm {formatPrice(savings)}</span>}
            </div>

            <div className="detail-policy">
              <ShieldCheck size={21} />
              <div>
                <small>CHÍNH SÁCH SẢN PHẨM</small>
                <b>{policyText}</b>
              </div>
            </div>

            <div className="detail-description">
              <h2>Mô tả sản phẩm</h2>
              <p>{productDescription}</p>
            </div>

            {upgradeOptions.length > 0 && (
              <section className="detail-upgrades" aria-labelledby="detail-upgrades-title">
                <header>
                  <Settings size={20} /> <b id="detail-upgrades-title">Nâng cấp</b>
                </header>
                <div className="detail-upgrade-groups">
                  {upgradeOptions.map((group, groupIndex) => (
                    <div className="detail-upgrade-group" key={`${group.name}-${groupIndex}`}>
                      <strong>{group.name}</strong>
                      <div role="group" aria-label={`Chọn ${group.name}`}>
                        {group.options.map((option, optionIndex) => {
                          const selected = selectedUpgrades[groupIndex] === option;
                          return <button
                            type="button"
                            className={selected ? "active" : ""}
                            onClick={() => setSelectedUpgrades((current) => ({ ...current, [groupIndex]: option }))}
                            aria-pressed={selected}
                            key={`${option}-${optionIndex}`}
                          >
                            {option}
                            {selected && <span aria-hidden="true"><BadgeCheck size={14}/></span>}
                          </button>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {promotions.length > 0 && (
              <section className="detail-promotion" aria-labelledby="detail-promotions-title">
                <header>
                  <Gift size={20} /> <b id="detail-promotions-title">Khuyến mãi</b>
                </header>
                <ul>
                  {promotions.map((promotion, index) => (
                    <li key={`${promotion}-${index}`}>
                      <Gift size={16} /> <span>{promotion}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="detail-stock-row">
              <span className={canBuy ? "in-stock" : "sold-out"}>
                {canBuy
                  ? stockKnown
                    ? `Còn ${stock} sản phẩm`
                    : "Còn hàng"
                  : "Tạm hết hàng"}
              </span>
              <div className="detail-quantity" aria-label="Số lượng sản phẩm">
                <button
                  type="button"
                  onClick={() => changeQuantity(-1)}
                  disabled={quantity <= 1}
                  aria-label="Giảm số lượng"
                >
                  <Minus size={16} />
                </button>
                <output aria-live="polite">{quantity}</output>
                <button
                  type="button"
                  onClick={() => changeQuantity(1)}
                  disabled={!canBuy || quantity >= stock}
                  aria-label="Tăng số lượng"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="detail-actions">
              <button
                type="button"
                className="detail-add-cart"
                onClick={() => onAdd(product, quantity)}
                disabled={!canBuy}
              >
                <ShoppingCart size={20} />
                <span>
                  THÊM VÀO GIỎ <small>Giao hàng toàn quốc</small>
                </span>
              </button>
              <button
                type="button"
                className="detail-buy-now"
                onClick={() => onBuyNow(product, quantity)}
                disabled={!canBuy}
              >
                MUA NGAY <small>Mở giỏ hàng để thanh toán</small>
              </button>
            </div>
          </div>
        </section>

        <section className="detail-services" aria-label="Quyền lợi mua hàng">
          <article>
            <Truck />
            <span>
              <b>Giao hàng toàn quốc</b>
              <small>Miễn phí cho đơn từ 500K</small>
            </span>
          </article>
          <article>
            <RefreshCcw />
            <span>
              <b>Đổi trả linh hoạt</b>
              <small>Miễn phí trong 7 ngày</small>
            </span>
          </article>
          <article>
            <ShieldCheck />
            <span>
              <b>Hàng chính hãng</b>
              <small>Đầy đủ hóa đơn và bảo hành</small>
            </span>
          </article>
          <article>
            <Wrench />
            <span>
              <b>Hỗ trợ kỹ thuật</b>
              <small>Đồng hành trong suốt sử dụng</small>
            </span>
          </article>
        </section>

        <section className="product-information-grid has-component-specs">
          <article className="product-specification-panel">
            <span className="detail-section-label">THÔNG TIN SẢN PHẨM</span>
            <h2>Thông số kỹ thuật</h2>
            {technicalSpecifications.length ? (
              <div className="component-specification-table">
                <table>
                  <colgroup>
                    <col className="component-specification-index" />
                    <col />
                    <col className="component-specification-quantity" />
                    <col className="component-specification-warranty" />
                  </colgroup>
                  <thead>
                    <tr><th>STT</th><th>Mô tả thiết bị</th><th>SL</th><th>BH</th></tr>
                  </thead>
                  <tbody>
                    {technicalSpecifications.map((item, index) => (
                      <tr key={`${item.description}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{item.warranty || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="specification-table">
                {basicSpecificationRows.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        {relatedProducts.length > 0 && (
          <section className="related-products-section">
            <header>
              <div>
                <span>GỢI Ý CHO BẠN</span>
                <h2>Sản phẩm tương tự</h2>
              </div>
              <button type="button" onClick={onBack}>
                Xem tất cả <ChevronRight size={17} />
              </button>
            </header>
            <div className="related-products-grid">
              {relatedProducts.map((item) => (
                <RelatedProduct
                  key={item.id}
                  product={item}
                  onOpen={onOpenProduct}
                  onAdd={onAdd}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
