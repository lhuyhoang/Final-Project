import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Code2, Copy, Layers, Pause, Play, RotateCcw, Save, SlidersHorizontal } from 'lucide-react'
import { api } from '../api'

const categories = [
  { id: 'fade', title: 'Fade & Crossfade', subtitle: 'Mờ dần / Đè hình mượt', icon: '✦', variants: [['crossfade', 'Standard Crossfade', 'Mờ chồng hình cổ điển'], ['fade-black', 'Fade Through Black', 'Mờ qua nền tối điện ảnh'], ['fade-zoom', 'Fade with Subtle Zoom', 'Mờ kết hợp phóng nhẹ']] },
  { id: 'scale', title: 'Scale & Ken Burns', subtitle: 'Phóng to / Thu nhỏ điện ảnh', icon: '◌', variants: [['kenburns-in', 'Ken Burns Zoom In', 'Phóng từ từ chuẩn phim'], ['kenburns-out', 'Ken Burns Zoom Out', 'Thu nhỏ tầm nhìn'], ['scale-pulse', 'Pulse Pop Reveal', 'Bật nhẹ thu hút thị giác']] },
  { id: 'slide', title: 'Slide & Gliding', subtitle: 'Trượt ngang / Trượt dọc / Push', icon: '↔', variants: [['slide-right', 'Slide Right to Left', 'Trượt từ phải sang trái'], ['slide-up', 'Slide Up Reveal', 'Trượt đẩy từ dưới lên'], ['slide-push', 'Push Shift Swap', 'Đẩy cả hai lớp ảnh']] },
  { id: 'flip3d', title: '3D Flip & Rotation', subtitle: 'Lật thẻ 3D / Xoay không gian', icon: '◇', variants: [['flip-y', '3D Flip Y-Axis', 'Lật ngang 180 độ'], ['flip-x', '3D Flip X-Axis', 'Lật dọc từ trên xuống'], ['cube-rot', 'Cube Perspective Roll', 'Xoay khối lập phương']] },
  { id: 'clippath', title: 'Clip-Path & Reveal Mask', subtitle: 'Cắt hình Circle / Spline / Venetian', icon: '◆', variants: [['clip-circle', 'Circle Radial Wipe', 'Mở rộng hình tròn từ tâm'], ['clip-diagonal', 'Diagonal Split Wipe', 'Cắt chéo màn hình'], ['clip-diamond', 'Diamond Center Mask', 'Mở rộng hình kim cương']] },
  { id: 'blur', title: 'Blur & Glassmorphism', subtitle: 'Làm mờ ảo / Frost focus', icon: '◒', variants: [['gaussian-dissolve', 'Gaussian Blur Focus', 'Mờ nhòe hóa rõ nét'], ['frost-glass', 'Frost Glass Shift', 'Lớp kính mờ nghệ thuật']] }
]

const easings = [
  ['ease-in-out', 'ease-in-out (Mượt hai đầu)'],
  ['cubic-bezier(0.25, 1, 0.5, 1)', 'cubic-bezier (Mượt điện ảnh)'],
  ['cubic-bezier(0.68, -0.55, 0.27, 1.55)', 'bounce (Đàn hồi nhẹ)'],
  ['cubic-bezier(0.16, 1, 0.3, 1)', 'ease-out-expo (Dừng siêu mượt)'],
  ['linear', 'linear (Tuyến tính đều)']
]

const ratios = [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['21/9', '21:9']]

function keyframesFor(variant) {
  const fade = [{ opacity: 0 }, { opacity: 1 }]
  switch (variant) {
    case 'fade-black': return { base: [{ opacity: 1 }, { opacity: 0 }], top: fade }
    case 'fade-zoom': return { top: [{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'scale(1)' }] }
    case 'kenburns-in': return { top: [{ opacity: 0, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.12)' }] }
    case 'kenburns-out': return { top: [{ opacity: 0, transform: 'scale(1.2)' }, { opacity: 1, transform: 'scale(1)' }] }
    case 'scale-pulse': return { top: [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }] }
    case 'slide-right': return { top: [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }] }
    case 'slide-up': return { top: [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }] }
    case 'slide-push': return { base: [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], top: [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }] }
    case 'flip-y': return { base: [{ opacity: 1, transform: 'perspective(1000px) rotateY(0)' }, { opacity: 0, transform: 'perspective(1000px) rotateY(90deg)' }], top: [{ opacity: 0, transform: 'perspective(1000px) rotateY(-90deg)' }, { opacity: 1, transform: 'perspective(1000px) rotateY(0)' }] }
    case 'flip-x': return { top: [{ opacity: 0, transform: 'perspective(1000px) rotateX(90deg)' }, { opacity: 1, transform: 'perspective(1000px) rotateX(0)' }] }
    case 'cube-rot': return { base: [{ transform: 'perspective(1000px) rotateY(0) translateZ(0)' }, { transform: 'perspective(1000px) rotateY(-90deg) translateZ(200px)' }], top: [{ opacity: 0, transform: 'perspective(1000px) rotateY(90deg) translateZ(200px)' }, { opacity: 1, transform: 'perspective(1000px) rotateY(0) translateZ(0)' }] }
    case 'clip-circle': return { top: [{ clipPath: 'circle(0% at 50% 50%)', opacity: 1 }, { clipPath: 'circle(100% at 50% 50%)', opacity: 1 }] }
    case 'clip-diagonal': return { top: [{ clipPath: 'polygon(0 0,0 0,0 100%,0 100%)', opacity: 1 }, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', opacity: 1 }] }
    case 'clip-diamond': return { top: [{ clipPath: 'polygon(50% 50%,50% 50%,50% 50%,50% 50%)', opacity: 1 }, { clipPath: 'polygon(50% -50%,150% 50%,50% 150%,-50% 50%)', opacity: 1 }] }
    case 'gaussian-dissolve': return { top: [{ filter: 'blur(20px)', opacity: 0, transform: 'scale(1.08)' }, { filter: 'blur(0)', opacity: 1, transform: 'scale(1)' }] }
    case 'frost-glass': return { top: [{ filter: 'blur(15px) grayscale(100%)', opacity: 0 }, { filter: 'blur(0) grayscale(0%)', opacity: 1 }] }
    default: return { top: fade }
  }
}

function flattenImages(products) {
  return products.flatMap(product => [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])]).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).slice(0, 8)
}

function codeFor(variant, duration, easing, tab) {
  const frames = keyframesFor(variant)
  const top = frames.top || [{ opacity: 0 }, { opacity: 1 }]
  const serialize = frame => Object.entries(frame).map(([key, value]) => `    ${key}: ${value};`).join('\n')
  if (tab === 'html') return `<div class="image-slider-container">\n  <img src="photo-current.jpg" class="slider-img base" alt="Ảnh hiện tại">\n  <img src="photo-next.jpg" class="slider-img incoming" alt="Ảnh tiếp theo">\n</div>`
  return `/* ${variant} · Web Animations API */\n.image-slider-container {\n  position: relative;\n  overflow: hidden;\n  perspective: 1200px;\n}\n\n.slider-img {\n  position: absolute; inset: 0; width: 100%; height: 100%;\n  object-fit: cover; will-change: transform, opacity, filter, clip-path;\n}\n\n/* ${duration.toFixed(1)}s · ${easing} */\n@keyframes ${variant}-in {\n  from {\n${serialize(top[0])}\n  }\n  to {\n${serialize(top[1])}\n  }\n}`
}

export default function TransitionPlayground({ products, settings, onSaved }) {
  const sourceImages = useMemo(() => flattenImages(products || []), [products])
  const images = sourceImages.length > 1 ? sourceImages : ['https://images.unsplash.com/photo-1517336714739-489689fd1ca8?q=80&w=1200&auto=format&fit=crop', 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=1200&auto=format&fit=crop']
  const configuredCategory = categories.find(category => category.variants.some(([id]) => id === settings?.productGalleryVariant)) || categories[2]
  const [categoryId, setCategoryId] = useState(configuredCategory.id)
  const category = categories.find(item => item.id === categoryId) || categories[2]
  const [variant, setVariant] = useState(settings?.productGalleryVariant || category.variants[0][0])
  const [duration, setDuration] = useState(Math.max(.3, Math.min(2.5, Number(settings?.productGalleryDurationMs || 800) / 1000)))
  const [easing, setEasing] = useState(settings?.productGalleryEasing || easings[1][0])
  const [interval, setIntervalSeconds] = useState(Number(settings?.productGalleryIntervalSeconds || 5))
  const [ratio, setRatio] = useState('16/9')
  const [imageIndex, setImageIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [codeTab, setCodeTab] = useState('css')
  const [carouselTransition, setCarouselTransition] = useState(settings?.productCarouselTransition || 'slide')
  const [carouselDuration, setCarouselDuration] = useState(Number(settings?.productCarouselDurationMs || 860))
  const [carouselEasing, setCarouselEasing] = useState(settings?.productCarouselEasing || 'smooth')
  const [notice, setNotice] = useState('')
  const baseRef = useRef(null)
  const topRef = useRef(null)
  const animationRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    setVariant(category.variants.some(([id]) => id === variant) ? variant : category.variants[0][0])
  }, [categoryId])

  useEffect(() => {
    if (!baseRef.current || !topRef.current) return
    baseRef.current.src = images[imageIndex]
    topRef.current.src = images[imageIndex]
    topRef.current.style.opacity = '0'
    topRef.current.style.transform = 'none'
    topRef.current.style.filter = 'none'
    topRef.current.style.clipPath = 'none'
  }, [images, imageIndex])

  useEffect(() => {
    if (!playing) return undefined
    timerRef.current = window.setInterval(() => runTransition((imageIndex + 1) % images.length), duration * 1000 + 1500)
    return () => window.clearInterval(timerRef.current)
  }, [playing, imageIndex, duration, images.length, variant, easing])

  useEffect(() => () => animationRef.current.forEach(animation => animation.cancel()), [])

  function runTransition(targetIndex) {
    if (animating || targetIndex === imageIndex || !baseRef.current || !topRef.current) return
    const base = baseRef.current
    const top = topRef.current
    animationRef.current.forEach(animation => animation.cancel())
    top.src = images[targetIndex]
    top.style.opacity = '0'
    top.style.transform = 'none'
    top.style.filter = 'none'
    top.style.clipPath = 'none'
    base.style.opacity = '1'
    base.style.transform = 'none'
    setAnimating(true)
    const frames = keyframesFor(variant)
    const options = { duration: duration * 1000, easing, fill: 'forwards' }
    const topAnimation = top.animate(frames.top || [{ opacity: 0 }, { opacity: 1 }], options)
    const baseAnimation = frames.base ? base.animate(frames.base, options) : null
    animationRef.current = [topAnimation, baseAnimation].filter(Boolean)
    topAnimation.onfinish = () => {
      base.src = images[targetIndex]
      base.style.opacity = '1'
      base.style.transform = 'none'
      top.style.opacity = '0'
      top.style.transform = 'none'
      top.style.filter = 'none'
      top.style.clipPath = 'none'
      setImageIndex(targetIndex)
      setAnimating(false)
    }
  }

  function selectCategory(nextCategory) {
    setCategoryId(nextCategory.id)
    setVariant(nextCategory.variants[0][0])
  }

  async function save() {
    const coarseTransition = categoryId === 'slide' ? 'slide' : categoryId === 'scale' ? 'zoom' : categoryId === 'fade' ? 'fade' : 'fade'
    const payload = {
      productGalleryTransition: coarseTransition,
      productGalleryVariant: variant,
      productGalleryDurationMs: Math.round(duration * 1000),
      productGalleryEasing: easing,
      productGalleryIntervalSeconds: Number(interval),
      productCarouselTransition: carouselTransition,
      productCarouselDurationMs: Number(carouselDuration),
      productCarouselEasing: carouselEasing
    }
    try {
      const updated = await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) })
      onSaved(updated)
      setNotice('Đã lưu cấu hình hiệu ứng cho toàn bộ cửa hàng')
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const variantInfo = category.variants.find(item => item[0] === variant) || category.variants[0]
  const code = codeFor(variant, duration, easing, codeTab)

  return <section className="transition-playground">
    <header className="transition-playground-header">
      <div className="transition-playground-brand"><span className="transition-brand-icon">✣</span><div><h2>VisualTransitions <b>HTML &amp; CSS Pro</b></h2><p>Bộ sưu tập &amp; Playground hiệu ứng chuyển ảnh mượt mà</p></div></div>
      <div className="transition-playground-header-actions"><button type="button" className="transition-help">? Hướng dẫn</button><span>⚡ Hiệu ứng Hover</span></div>
    </header>
    <div className="transition-playground-workspace">
      <aside className="transition-playground-categories panel-glass">
        <div className="transition-panel-title"><span><Layers size={15}/> DANH MỤC HIỆU ỨNG</span><b>{categories.length} Loại</b></div>
        <div className="transition-category-list">{categories.map(item => <button key={item.id} type="button" className={item.id === categoryId ? 'active' : ''} onClick={() => selectCategory(item)}><span className="transition-category-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><i>{item.id === categoryId ? '⌄' : '›'}</i></button>)}</div>
      </aside>
      <main className="transition-playground-preview">
        <div className="transition-stage-header panel-glass"><span><i/> {category.title}</span><div className="transition-ratios"><em>Tỷ lệ:</em>{ratios.map(([value, label]) => <button key={value} type="button" className={ratio === value ? 'active' : ''} onClick={() => setRatio(value)}>{label}</button>)}</div></div>
        <div className="transition-stage-card panel-glass">
          <div className="transition-stage-viewport" style={{ aspectRatio: ratio }}><img ref={baseRef} className="transition-stage-layer base" src={images[imageIndex]} alt="Ảnh hiện tại"/><img ref={topRef} className="transition-stage-layer top" src={images[imageIndex]} alt="Ảnh tiếp theo"/><span className="transition-effect-chip"><Play size={11}/> {variantInfo[1]}</span><span className="transition-index">{imageIndex + 1} / {images.length}</span></div>
          <div className="transition-stage-controls"><button type="button" onClick={() => runTransition((imageIndex - 1 + images.length) % images.length)} disabled={animating}>← <span>Ảnh trước</span></button><button type="button" className={playing ? 'playing' : ''} onClick={() => setPlaying(current => !current)}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Tạm dừng' : 'Tự động chạy'}</button><button type="button" onClick={() => runTransition((imageIndex + 1) % images.length)} disabled={animating}><span>Ảnh tiếp</span> →</button></div>
        </div>
        <div className="transition-thumbnails panel-glass"><div className="transition-panel-title"><span>▣ THƯ VIỆN ẢNH SẢN PHẨM</span><small>{images.length} ảnh</small></div><div className="transition-thumb-grid">{images.map((image, index) => <button type="button" className={index === imageIndex ? 'active' : ''} key={`${image}-${index}`} onClick={() => runTransition(index)}><img src={image} alt=""/></button>)}</div></div>
      </main>
      <aside className="transition-playground-controls">
        <div className="panel-glass transition-control-card"><div className="transition-panel-title"><span><SlidersHorizontal size={15}/> TÙY CHỈNH THÔNG SỐ</span><button type="button" onClick={() => { setDuration(.8); setEasing(easings[1][0]) }}><RotateCcw size={12}/> Mặc định</button></div><label><span>Thời gian (Duration): <b>{duration.toFixed(1)}s</b></span><input type="range" min=".3" max="2.5" step=".1" value={duration} onChange={event => setDuration(Number(event.target.value))}/></label><label><span>Đường cong Easing (Timing):</span><select value={easing} onChange={event => setEasing(event.target.value)}>{easings.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Kiểu biến thể (Sub-Variant):</span><select value={variant} onChange={event => { setVariant(event.target.value); runTransition((imageIndex + 1) % images.length) }}>{category.variants.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Tự động chuyển ảnh: <b>{interval}s</b></span><input type="range" min="2" max="60" step="1" value={interval} onChange={event => setIntervalSeconds(Number(event.target.value))}/></label><div className="transition-divider"/><label><span>Hiệu ứng dải sản phẩm:</span><select value={carouselTransition} onChange={event => setCarouselTransition(event.target.value)}><option value="slide">Slide trượt ngang</option><option value="fade">Fade khi trượt</option></select></label><label><span>Đường cong dải sản phẩm:</span><select value={carouselEasing} onChange={event => setCarouselEasing(event.target.value)}><option value="smooth">Smooth mềm</option><option value="soft">Soft chậm</option><option value="linear">Linear đều</option></select></label><label><span>Thời lượng dải sản phẩm: <b>{carouselDuration}ms</b></span><input type="range" min="400" max="1800" step="40" value={carouselDuration} onChange={event => setCarouselDuration(Number(event.target.value))}/></label><button type="button" className="transition-save-button" onClick={save}><Save size={16}/> Lưu hiệu ứng cửa hàng</button>{notice && <div className="transition-save-notice"><Check size={15}/> {notice}</div>}</div>
        <div className="panel-glass transition-code-card"><div className="transition-panel-title"><span><Code2 size={15}/> MÃ NGUỒN CSS &amp; HTML</span><button type="button" onClick={() => navigator.clipboard?.writeText(code)}><Copy size={13}/> Sao chép</button></div><div className="transition-code-tabs"><button type="button" className={codeTab === 'css' ? 'active' : ''} onClick={() => setCodeTab('css')}>CSS Keyframes</button><button type="button" className={codeTab === 'html' ? 'active' : ''} onClick={() => setCodeTab('html')}>Cấu trúc HTML</button></div><pre><code>{code}</code></pre></div>
      </aside>
    </div>
    <section className="transition-hover-showcase panel-glass">
      <div className="transition-hover-heading"><div><h3>✦ Hiệu Ứng Hover Ảnh Siêu Mượt</h3><p>Rê chuột vào các thẻ để xem các micro-interaction bằng CSS.</p></div><span>60 FPS · tối ưu performance</span></div>
      <div className="transition-hover-grid">{[
        ['transition-hover-zoom', 'Cinematic Rotate & Scale', 'Phóng to kết hợp xoay góc nhẹ tạo độ sâu sinh động.'],
        ['transition-hover-reveal', 'Circle Reveal Mask', 'Lớp phủ mở rộng từ tâm bằng clip-path.'],
        ['transition-hover-float', '3D Float Card', 'Nâng thẻ và nghiêng phối cảnh khi di chuột.'],
        ['transition-hover-shine', 'Shine Sweep', 'Vệt sáng quét ngang tạo cảm giác cao cấp.']
      ].map(([className, title, description], index) => <article className={`transition-hover-card ${className}`} key={title}><div><img src={images[index % images.length]} alt=""/><span className="transition-hover-overlay"/></div><h4>{index + 1}. {title}</h4><p>{description}</p></article>)}</div>
    </section>
  </section>
}
