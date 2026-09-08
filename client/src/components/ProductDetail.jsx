import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Gift,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";

const formatPrice = (value) =>
  new Intl.NumberFormat("vi-VN").format(value || 0) + "₫";

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
  highlights,
  onBack,
  onOpenProduct,
  onAdd,
  onBuyNow,
}) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState("");

  useEffect(() => {
    if (!product) return undefined;
    setQuantity(1);
    setActiveImage(product.image);
    window.scrollTo({ top: 0, behavior: "auto" });
    const previousTitle = document.title;
    document.title = `${product.name} | QuadPro`;
    return () => {
      document.title = previousTitle;
    };
  }, [product?.id]);

  if (!product) return <ProductDetailState loading={loading} onBack={onBack} />;

  const gallery = [
    product.image,
    ...(Array.isArray(product.gallery) ? product.gallery : []),
  ].filter((image, index, images) => image && images.indexOf(image) === index);
  const savings = Math.max(0, product.oldPrice - product.price);
  const stockKnown = Number.isInteger(product.stock);
  const stock = stockKnown ? product.stock : 99;
  const policyText =
    product.policyText || "Trả góp 0% • Bảo hành 36 tháng";
  const relatedProducts = [
    ...products.filter(
      (item) => item.id !== product.id && item.category === product.category,
    ),
    ...products.filter(
      (item) => item.id !== product.id && item.category !== product.category,
    ),
  ].slice(0, 4);
  const specificationRows = [
    ["Mã sản phẩm", `QP-${String(product.id).padStart(5, "0")}`],
    ["Thương hiệu", product.brand],
    ["Danh mục", product.category],
    ["Giá niêm yết", formatPrice(product.oldPrice)],
    ["Giá bán", formatPrice(product.price)],
    ["Tồn kho", stockKnown ? `${stock} sản phẩm` : "Đang cập nhật"],
    ["Đánh giá", `${product.rating}/5 từ ${product.reviews} lượt đánh giá`],
    ["Chính sách", policyText],
  ];
  const canBuy = stock > 0;

  function changeQuantity(change) {
    setQuantity((current) =>
      Math.min(Math.max(current + change, 1), Math.max(stock, 1)),
    );
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        <nav className="product-breadcrumb" aria-label="Điều hướng sản phẩm">
          <button type="button" onClick={onBack}>
            Trang chủ
          </button>
          <ChevronRight size={15} aria-hidden="true" />
          <span>{product.category}</span>
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
              <img src={activeImage || product.image} alt={product.name} />
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

            <div className="detail-highlights">
              <h2>Mô tả sản phẩm</h2>
              <ul>
                {highlights.map((highlight) => (
                  <li key={highlight}>
                    <CheckCircle2 size={17} /> <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="detail-promotion">
              <header>
                <Gift size={20} /> <b>Ưu đãi khi mua hàng</b>
              </header>
              <ul>
                {savings > 0 && (
                  <li>
                    <Zap size={16} /> Giảm trực tiếp {formatPrice(savings)}
                  </li>
                )}
                <li>
                  <Gift size={16} /> Miễn phí giao hàng cho đơn từ 500.000₫
                </li>
                <li>
                  <Wrench size={16} /> Hỗ trợ kiểm tra và tối ưu trước khi giao
                </li>
              </ul>
            </div>

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

        <section className="product-information-grid">
          <article className="product-description-panel">
            <span className="detail-section-label">QUADPRO REVIEW</span>
            <h2>Điểm nổi bật của {product.name}</h2>
            <p>
              {product.name} là sản phẩm chính hãng từ {product.brand}, phù hợp
              cho nhu cầu thuộc nhóm {product.category.toLowerCase()}. Sản phẩm
              được QuadPro kiểm tra ngoại quan và chức năng trước khi bàn giao.
            </p>
            <ul>
              {highlights.map((highlight) => (
                <li key={highlight}>
                  <CheckCircle2 size={18} /> {highlight}
                </li>
              ))}
            </ul>
          </article>

          <article className="product-specification-panel">
            <span className="detail-section-label">THÔNG TIN SẢN PHẨM</span>
            <h2>Thông số kỹ thuật</h2>
            <div className="specification-table">
              {specificationRows.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
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
