import { createContext, useContext, useEffect, useState } from 'react'
import { defaultStoreAppearance } from '../../../shared/storeAppearance.mjs'
import './product-hover.css'

const AppearanceContext = createContext({ appearance: defaultStoreAppearance, setAppearance: () => {} })
export const useStoreAppearance = () => useContext(AppearanceContext)

export function StoreAppearanceProvider({ children }) {
  const [appearance, setAppearance] = useState(defaultStoreAppearance)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.productHover = appearance.hoverEffect
    root.style.setProperty('--product-hover-duration', `${appearance.hoverDurationMs}ms`)
    let favicon = document.querySelector('link[rel="icon"]')
    if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon) }
    favicon.removeAttribute('type')
    favicon.href = appearance.logoUrl
  }, [appearance])
  return <AppearanceContext.Provider value={{ appearance, setAppearance }}>{children}</AppearanceContext.Provider>
}
