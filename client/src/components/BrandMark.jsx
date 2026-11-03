import './brand-mark.css'
import { useStoreAppearance } from './StoreAppearance'
import { defaultStoreAppearance } from '../../../shared/storeAppearance.mjs'

export default function BrandMark() {
  const { appearance } = useStoreAppearance()
  return <img className="quadpro-brand-mark" src={appearance.logoUrl} width="45" height="45" alt="" decoding="async" onError={event => { if (event.currentTarget.getAttribute('src') !== defaultStoreAppearance.logoUrl) event.currentTarget.src = defaultStoreAppearance.logoUrl }}/>
}
