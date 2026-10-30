import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import "./home-banners.css";

const banners = [
  { image: "build-pc-gaming.jpg", label: "Build PC Gaming giá tốt tại QuadShop" },
  { image: "pc-delta-force.jpg", label: "Cấu hình PC chiến Delta Force và quà tặng" },
  { image: "halloween-pc.jpg", label: "Halloween săn deal, build PC cực chill" },
];

export default function HomeBanners() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % banners.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [active, paused, hovered, focused, reducedMotion]);

  const move = (offset) => setActive((index) => (index + offset + banners.length) % banners.length);

  return (
    <section className="home-banners container" aria-label="Chương trình nổi bật">
      <div
        className="home-banners-carousel"
        role="region"
        aria-roledescription="trình chiếu"
        aria-label="Banner cửa hàng"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <div className="home-banners-stage">
          {banners.map((banner, index) => (
            <a
              className={`home-banners-slide${index === active ? " is-active" : ""}`}
              href="#products"
              key={banner.image}
              aria-hidden={index !== active}
              tabIndex={index === active ? 0 : -1}
            >
              <img
                src={`/images/banners/${banner.image}`}
                alt={banner.label}
                width="1024"
                height="389"
                fetchPriority={index === 0 ? "high" : "auto"}
              />
            </a>
          ))}
        </div>
        <button className="home-banners-arrow is-previous" type="button" onClick={() => move(-1)} aria-label="Banner trước">
          <ChevronLeft size={21} />
        </button>
        <button className="home-banners-arrow is-next" type="button" onClick={() => move(1)} aria-label="Banner tiếp theo">
          <ChevronRight size={21} />
        </button>
        <div className="home-banners-controls">
          <div className="home-banners-pagination" aria-label="Chọn banner">
            {banners.map((banner, index) => (
              <button
                type="button"
                key={banner.image}
                aria-label={`Xem banner ${index + 1}: ${banner.label}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => setActive(index)}
              ><span /></button>
            ))}
          </div>
          {!reducedMotion && (
            <button className="home-banners-play" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Tự động chuyển banner" : "Tạm dừng chuyển banner"}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      </div>
      <div className="home-banners-promos">
        <a href="#products" aria-label="Xem sản phẩm PC khuyến mãi Halloween">
          <img src="/images/banners/halloween-pc.jpg" alt="Halloween săn deal, build PC cực chill" width="2856" height="1087" />
        </a>
        <a href="#products" aria-label="Xem các sản phẩm đang ưu đãi">
          <img src="/images/banners/halloween-deals.jpg" alt="Ưu đãi Halloween và miễn phí vận chuyển toàn quốc" width="2051" height="1123" />
        </a>
      </div>
    </section>
  );
}
