import { Mail, MapPin, Phone } from 'lucide-react'
import './footer-contact.css'

function showroomMapUrl(showroom) {
  try {
    const url = new URL(showroom.mapUrl)
    if (['https:', 'http:'].includes(url.protocol)) return url.href
  } catch { /* Use the address when no map link has been entered. */ }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(showroom.address || showroom.name)}`
}

export default function FooterContact({ showrooms = [] }) {
  const visibleShowrooms = showrooms.filter(showroom => showroom.isActive !== false)
  return <div className="footer-contact">
    <h3>Thông tin liên hệ</h3>
    <ul className="footer-contact-list">
      {visibleShowrooms.length ? visibleShowrooms.map(showroom => <li key={showroom.id}>
        <MapPin size={17} aria-hidden="true"/>
        <a href={showroomMapUrl(showroom)} target="_blank" rel="noopener noreferrer" aria-label={`Xem bản đồ ${showroom.name}`}>
          <b>{showroom.name}</b><span>{showroom.address}</span>
        </a>
      </li>) : <li><MapPin size={17} aria-hidden="true"/><span>Địa chỉ showroom đang được cập nhật.</span></li>}
      <li><Phone size={17} aria-hidden="true"/><a href="tel:0812077051" aria-label="Gọi 0812077051">0812077051</a></li>
      <li><Mail size={17} aria-hidden="true"/><a href="mailto:quadprosupport@gmail.com">quadprosupport@gmail.com</a></li>
    </ul>
  </div>
}
