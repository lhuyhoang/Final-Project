import app from '../server/src/index.js'

export default function handler(req, res) {
  const requestUrl = new URL(req.url, 'http://localhost')
  const pathParameter = req.query?.path ?? requestUrl.searchParams.get('path')
  const rawPath = Array.isArray(pathParameter)
    ? pathParameter.join('/')
    : String(pathParameter || '')

  requestUrl.pathname = `/api/${rawPath}`
  requestUrl.searchParams.delete('path')
  req.url = `${requestUrl.pathname}${requestUrl.search}`

  return app(req, res)
}
