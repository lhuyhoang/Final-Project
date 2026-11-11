import { useEffect, useMemo, useState } from 'react'
import { priceStorefrontProducts } from '../flash-sale-pricing.mjs'

export default function useFlashSaleProducts(products, sale) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let timer
    function update() {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const boundary = [Date.parse(sale.startsAt), Date.parse(sale.endsAt)].filter(value => value > time).sort((a, b) => a - b)[0]
      if (boundary) timer = setTimeout(update, Math.min(boundary - time + 1, 2147483647))
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update) }
  }, [sale])
  return useMemo(() => priceStorefrontProducts(products, sale, now), [products, sale, now])
}
