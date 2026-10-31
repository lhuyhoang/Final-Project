import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Zap } from 'lucide-react'
import { isFlashSaleActive } from '../../../shared/promotions.mjs'

export default function FlashSale({ sale, products, renderProduct }) {
  const [now, setNow] = useState(Date.now)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { if (!sale?.productIds?.length) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [sale])
  useEffect(() => { setNow(Date.now()); setExpanded(false) }, [sale])
  const chosen = useMemo(() => { const byId = new Map(products.map(product => [product.id, product])); return (sale?.productIds || []).map(id => byId.get(id)).filter(Boolean) }, [products, sale])
  if (!isFlashSaleActive(sale, now) || !chosen.length) return null
  const seconds = Math.max(0, Math.ceil((Date.parse(sale.endsAt) - now) / 1000))
  const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0'))
  return <section className="deal-section" id="deals" aria-label="Flash Sale"><div className="container"><div className="deal-header"><div><span className="flash"><Zap fill="currentColor"/> FLASH SALE</span><p>Kết thúc sau</p><div className="countdown" role="timer" aria-label={`Còn ${clock[0]} giờ ${clock[1]} phút ${clock[2]} giây`}><b>{clock[0]}</b>:<b>{clock[1]}</b>:<b>{clock[2]}</b></div></div>{chosen.length > 5 && <button onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn' : 'Xem tất cả'}<ArrowRight size={17}/></button>}</div><div className="products-grid">{(expanded ? chosen : chosen.slice(0, 5)).map(renderProduct)}</div></div></section>
}
