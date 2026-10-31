import './contact-buttons.css'

function MessengerIcon() {
  return <svg viewBox="0 0 32 32" width="31" height="31" aria-hidden="true"><path fill="currentColor" d="M16 2C8.27 2 2 7.8 2 15c0 4.13 2.07 7.82 5.3 10.2V30l4.64-2.56c1.29.35 2.65.54 4.06.54 7.73 0 14-5.8 14-12.98S23.73 2 16 2Z"/><path fill="#1682ff" d="m7.5 19.5 7.1-7.6 4.2 3.2 5.7-3.2-7.1 7.6-4.2-3.2-5.7 3.2Z"/></svg>
}

function ZaloIcon() {
  return <svg viewBox="0 0 40 40" width="39" height="39" aria-hidden="true"><path fill="white" d="M20 4C10.6 4 3 10.4 3 18.4c0 4.4 2.3 8.4 6 11l-1.2 5.4 6.7-3.2c1.8.6 3.6.9 5.5.9 9.4 0 17-6.4 17-14.1S29.4 4 20 4Z"/><text x="20" y="23" textAnchor="middle" fill="#0068ff" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" letterSpacing="-.7">Zalo</text></svg>
}

export default function ContactButtons({ messengerUrl = '', zaloUrl = '' }) {
  if (!messengerUrl && !zaloUrl) return null
  return <div className="contact-buttons" role="group" aria-label="Liên hệ tư vấn">
    {messengerUrl && <a className="contact-button contact-button-messenger" href={messengerUrl} target="_blank" rel="noopener noreferrer" aria-label="Chat với QuadPro qua Messenger"><span className="contact-button-label">Chat Messenger</span><MessengerIcon/></a>}
    {zaloUrl && <a className="contact-button contact-button-zalo" href={zaloUrl} target="_blank" rel="noopener noreferrer" aria-label="Chat với QuadPro qua Zalo"><span className="contact-button-label">Chat Zalo</span><ZaloIcon/></a>}
  </div>
}
