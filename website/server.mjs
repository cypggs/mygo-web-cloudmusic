import http from 'node:http'
import { createHash, createCipheriv, randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist', 'client')
const port = Number(process.env.PORT || 3000)
const API = 'https://music.163.com'
const EAPI = 'https://interfacepc.music.163.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const EAPI_UA = 'NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)'
const deviceId = randomBytes(26).toString('hex').toUpperCase()
const publicCache = new Map()

function parseCookies(req) {
  const out = {}
  for (const part of (req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=')
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim()
  }
  return out
}

function readSession(req) {
  try {
    const value = parseCookies(req).mygo_session
    if (!value) return {}
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function sessionCookie(req, value) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production'
  return `mygo_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? '; Secure' : ''}`
}

function cookieHeader(session) {
  return Object.entries(session)
    .filter(([key, value]) => ['MUSIC_U', '__csrf', 'NMTID'].includes(key) && typeof value === 'string')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

async function request(url, { method = 'GET', form, session = {}, eapi = false } = {}) {
  const headers = {
    'User-Agent': eapi ? EAPI_UA : UA,
    Referer: `${API}/`,
  }
  const cookie = cookieHeader(session)
  if (cookie) headers.Cookie = cookie
  let body
  if (form) {
    body = new URLSearchParams(form).toString()
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20000) })
  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`网易云接口返回了无法识别的内容 (${response.status})`)
  }
  const setCookies = response.headers.getSetCookie?.() || []
  return { data, setCookies, status: response.status }
}

async function get(apiPath, query = {}, session = {}) {
  const url = new URL(apiPath, API)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))
  const { data } = await request(url, { session })
  if (data.code && data.code !== 200) throw new Error(data.message || data.msg || `网易云接口错误 (${data.code})`)
  return data
}

function eapiEncrypt(apiPath, data) {
  const text = JSON.stringify(data)
  const digest = createHash('md5').update(`nobody${apiPath}use${text}md5forencrypt`).digest('hex')
  const plain = Buffer.from(`${apiPath}-36cd479b6b5-${text}-36cd479b6b5-${digest}`)
  const pad = 16 - (plain.length % 16)
  const padded = Buffer.concat([plain, Buffer.alloc(pad, pad)])
  const cipher = createCipheriv('aes-128-ecb', Buffer.from('e82ckenh8dichen8'), null)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('hex').toUpperCase()
}

async function eapiPost(apiPath, values, session = {}) {
  const now = Date.now()
  const header = {
    osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
    deviceId,
    os: 'pc',
    appver: '3.1.17.204416',
    versioncode: '140',
    mobilename: '',
    buildver: String(Math.floor(now / 1000)),
    resolution: '1920x1080',
    channel: 'netease',
    requestId: `${now}_${String(now % 1000).padStart(4, '0')}`,
    __csrf: session.__csrf || '',
    ...(session.MUSIC_U ? { MUSIC_U: session.MUSIC_U } : {}),
    ...(session.NMTID ? { NMTID: session.NMTID } : {}),
  }
  const params = eapiEncrypt(apiPath, { ...values, header, e_r: false })
  const url = `${EAPI}/eapi/${apiPath.replace(/^\/api\//, '')}`
  return request(url, { method: 'POST', form: { params }, session, eapi: true })
}

function track(t) {
  if (!t) return t
  return {
    ...t,
    ar: t.ar || t.artists || [],
    al: t.al || t.album || {},
    dt: t.dt ?? t.duration ?? 0,
    alia: t.alia || t.alias || [],
  }
}

function tracks(list) {
  return (list || []).map(track)
}

function sized(url, size = 600) {
  return (url || '').replace(/^http:/, 'https:') + (url ? `?param=${size}y${size}` : '')
}

function rememberCookies(setCookies) {
  const next = {}
  for (const line of setCookies) {
    const [pair] = line.split(';')
    const at = pair.indexOf('=')
    if (at < 1) continue
    const key = pair.slice(0, at).trim()
    const value = pair.slice(at + 1).trim()
    if (['MUSIC_U', '__csrf', 'NMTID'].includes(key) && value) next[key] = value
  }
  return next
}

async function cached(key, seconds, fn) {
  const hit = publicCache.get(key)
  if (hit && hit.until > Date.now()) return hit.value
  const value = await fn()
  publicCache.set(key, { value, until: Date.now() + seconds * 1000 })
  return value
}

async function api(req, res, url) {
  const session = readSession(req)
  const p = url.pathname
  let out
  let newSession

  if (p === '/api/health') {
    out = { ok: true, name: 'MyGo Cloud Music Web' }
  } else if (p === '/api/home') {
    const [featured, charts, daily, recommended] = await Promise.all([
      cached('featured', 300, () => get('/api/personalized/playlist', { limit: 30 })),
      cached('charts', 300, () => get('/api/toplist/detail')),
      get('/api/v3/discovery/recommend/songs', {}, session).catch(() => ({ data: { dailySongs: [] } })),
      session.MUSIC_U
        ? get('/api/v1/discovery/recommend/resource', {}, session).catch(() => ({ recommend: [] }))
        : Promise.resolve({ recommend: [] }),
    ])
    out = {
      code: 200,
      featured: featured.result || [],
      charts: (charts.list || []).map((item) => ({ ...item, preview: item.tracks || [], tracks: undefined })),
      daily: tracks(daily.data?.dailySongs),
      recommended: (recommended.recommend || []).map((item) => ({ ...item, playCount: item.playcount ?? item.playCount })),
    }
  } else if (p === '/api/playlist') {
    const data = await get('/api/v6/playlist/detail', { id: url.searchParams.get('id'), n: 1000 }, session)
    if (data.playlist) data.playlist.tracks = tracks(data.playlist.tracks)
    out = data
  } else if (p === '/api/search') {
    out = await get('/api/cloudsearch/pc', {
      s: url.searchParams.get('q') || '',
      type: url.searchParams.get('type') || 1,
      limit: Math.min(Number(url.searchParams.get('limit')) || 60, 100),
      offset: Number(url.searchParams.get('offset')) || 0,
      total: 'true',
    }, session)
    if (out.result?.songs) out.result.songs = tracks(out.result.songs)
  } else if (p === '/api/suggest') {
    out = await get('/api/search/suggest/web', { s: url.searchParams.get('q') || '' }, session)
    if (out.result?.songs) out.result.songs = tracks(out.result.songs)
  } else if (p === '/api/stream') {
    const level = url.searchParams.get('level') || 'exhigh'
    const encodeType = ['lossless', 'hires'].includes(level) ? 'flac' : 'mp3'
    const { data } = await eapiPost('/api/song/enhance/player/url/v1', {
      ids: `[${Number(url.searchParams.get('id'))}]`,
      level,
      encodeType,
    }, session)
    const stream = data.data?.[0]
    if (!stream?.url) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ code: 404, message: '这首歌曲暂时无法播放，可能需要会员或存在版权限制' }))
      return
    }
    out = { code: 200, stream: { ...stream, url: stream.url.replace(/^http:/, 'https:') } }
  } else if (p === '/api/lyrics') {
    out = await get('/api/song/lyric', { id: url.searchParams.get('id'), lv: 1, tv: -1 }, session)
  } else if (p === '/api/comments') {
    out = await get(`/api/v1/resource/comments/R_SO_4_${Number(url.searchParams.get('id'))}`, {
      limit: 30,
      offset: Number(url.searchParams.get('offset')) || 0,
    }, session)
  } else if (p === '/api/artist') {
    out = await get(`/api/v1/artist/${Number(url.searchParams.get('id'))}`, {}, session)
    out.hotSongs = tracks(out.hotSongs)
  } else if (p === '/api/album') {
    out = await get(`/api/v1/album/${Number(url.searchParams.get('id'))}`, {}, session)
    out.songs = tracks(out.songs)
  } else if (p === '/api/account') {
    out = session.MUSIC_U ? await get('/api/nuser/account/get', {}, session) : { code: 200, profile: null }
  } else if (p === '/api/user-playlists') {
    out = await get('/api/user/playlist', { uid: Number(url.searchParams.get('uid')), limit: 200, offset: 0 }, session)
  } else if (p === '/api/fm') {
    const { data } = await eapiPost('/api/v1/radio/get', { mode: url.searchParams.get('mode') || 'DEFAULT', limit: 3 }, session)
    const ids = (data.data || []).map((item) => ({ id: item.id }))
    const detail = await eapiPost('/api/v3/song/detail', { c: JSON.stringify(ids) }, session)
    out = { code: 200, data: tracks(detail.data.songs) }
  } else if (p === '/api/login/qr' && req.method === 'POST') {
    const { data } = await eapiPost('/api/login/qrcode/unikey', { type: 3 })
    if (!data.unikey) throw new Error('无法获取登录二维码，请稍后重试')
    const loginUrl = `${API}/login?codekey=${encodeURIComponent(data.unikey)}`
    out = { code: 200, key: data.unikey, url: loginUrl, qr: await QRCode.toDataURL(loginUrl, { width: 320, margin: 2, color: { dark: '#1d1d1f', light: '#ffffff' } }) }
  } else if (p === '/api/login/qr/check') {
    const { data, setCookies } = await eapiPost('/api/login/qrcode/client/login', { key: url.searchParams.get('key'), type: 3 }, session)
    if (data.code === 803) newSession = rememberCookies(setCookies)
    out = data
  } else if (p === '/api/logout' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': sessionCookie(req, '') })
    res.end(JSON.stringify({ code: 200 }))
    return
  } else if (p === '/api/like' && req.method === 'POST') {
    const { data } = await eapiPost('/api/radio/like', {
      alg: 'itembased',
      trackId: String(Number(url.searchParams.get('id'))),
      like: String(url.searchParams.get('like') === 'true'),
      time: '3',
    }, session)
    out = data
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ code: 404, message: '接口不存在' }))
    return
  }

  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  if (newSession && Object.keys(newSession).length) {
    headers['Set-Cookie'] = sessionCookie(req, Buffer.from(JSON.stringify(newSession)).toString('base64url'))
  }
  res.writeHead(200, headers)
  res.end(JSON.stringify(out))
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
}

async function staticFile(req, res, url) {
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { pathname = '/' }
  let file = path.resolve(dist, `.${pathname}`)
  if (!file.startsWith(dist + path.sep) && file !== dist) file = path.join(dist, 'index.html')
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html')
    const info = await stat(file)
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size }
    if (path.extname(file) !== '.html') headers['Cache-Control'] = 'public, max-age=3600'
    res.writeHead(200, headers)
    if (req.method === 'HEAD') return res.end()
    res.end(await readFile(file))
  } catch {
    file = path.join(dist, 'index.html')
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length })
      res.end(body)
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('网站尚未构建，请先运行 npm run build')
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url)
    else await staticFile(req, res, url)
  } catch (error) {
    console.error(`${req.method} ${url.pathname}:`, error.message)
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ code: 502, message: error.message || '服务暂时不可用，请稍后重试' }))
  }
})

server.listen(port, '0.0.0.0', () => console.log(`MyGo Cloud Music Web: http://0.0.0.0:${port}`))
