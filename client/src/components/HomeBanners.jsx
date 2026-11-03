import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import "./home-banners.css";
import { useStoreAppearance } from './StoreAppearance';

export default function HomeBanners() {
  const { appearance } = useStoreAppearance();
  const banners = appearance.banners;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const activeIndex = Math.min(active, Math.max(0, banners.length - 1));
  useEffect(() => { setActive(0); }, [banners]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion || banners.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % banners.length);
    }, appearance.bannerIntervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [active, paused, hovered, focused, reducedMotion, banners, appearance.bannerIntervalSeconds]);

  const move = (offset) => setActive((index) => (Math.min(index, banners.length - 1) + offset + banners.length) % banners.length);
  if (!banners.length) return null;

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
              className={`home-banners-slide${index === activeIndex ? " is-active" : ""}`}
              href="#products"
              key={`${banner.image}-${index}`}
              aria-hidden={index !== activeIndex}
              tabIndex={index === activeIndex ? 0 : -1}
            >
              <img
                src={banner.image}
                alt={banner.label}
                width="1024"
                height="389"
                fetchPriority={index === 0 ? "high" : "auto"}
              />
            </a>
          ))}
        </div>
        {banners.length > 1 && <><button className="home-banners-arrow is-previous" type="button" onClick={() => move(-1)} aria-label="Banner trước">
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
                key={`${banner.image}-${index}`}
                aria-label={`Xem banner ${index + 1}: ${banner.label}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => setActive(index)}
              ><span /></button>
            ))}
          </div>
          {!reducedMotion && (
            <button className="home-banners-play" type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Tự động chuyển banner" : "Tạm dừng chuyển banner"}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div></>}
      </div>
    </section>
  );
}
