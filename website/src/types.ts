export interface Artist {
  id: number
  name: string
  img1v1Url?: string
  picUrl?: string
  briefDesc?: string
  musicSize?: number
  albumSize?: number
  followed?: boolean
}

export interface Album {
  id: number
  name: string
  picUrl?: string
  artists?: Artist[]
  artist?: Artist
  publishTime?: number
  size?: number
  description?: string
}

export interface Track {
  id: number
  name: string
  ar: Artist[]
  al: Album
  dt: number
  fee?: number
  alia?: string[]
  reason?: string
  privilege?: { st: number; pl: number }
  localSrc?: string
}

export interface Playlist {
  id: number
  name: string
  coverImgUrl?: string
  picUrl?: string
  description?: string
  playCount?: number
  trackCount?: number
  updateFrequency?: string
  specialType?: number
  subscribed?: boolean
  creator?: { userId: number; nickname: string; avatarUrl?: string }
  tracks?: Track[]
  trackIds?: { id: number }[]
  preview?: { first: string; second: string }[]
}

export interface Profile {
  userId: number
  nickname: string
  avatarUrl: string
  signature?: string
}

export interface HomeData {
  featured: Playlist[]
  charts: Playlist[]
  daily: Track[]
  recommended: Playlist[]
}

export interface Comment {
  commentId: number
  user: { userId: number; nickname: string; avatarUrl: string }
  content: string
  time: number
  likedCount: number
  liked: boolean
  ipLocation?: { location: string }
  beReplied?: { user: { nickname: string }; content: string }[]
}

export type Page =
  | { name: 'home' | 'daily' | 'fm' | 'charts' | 'podcasts' }
  | { name: 'playlist' | 'artist' | 'album'; id: number }
  | { name: 'search'; query: string; kind: number }

export function artistNames(track: Track) {
  return (track.ar || []).map((artist) => artist.name).join(' / ') || '未知歌手'
}

export function coverUrl(item?: { picUrl?: string; coverImgUrl?: string; avatarUrl?: string; img1v1Url?: string; al?: Album }, size = 600) {
  const url = item?.al?.picUrl || item?.picUrl || item?.coverImgUrl || item?.avatarUrl || item?.img1v1Url || ''
  if (!url) return ''
  return `${url.replace(/^http:/, 'https:')}${url.includes('?') ? '&' : '?'}param=${size}y${size}`
}

export function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function plays(count = 0) {
  if (count >= 1e8) return `${(count / 1e8).toFixed(1)}亿`
  if (count >= 1e4) return `${Math.round(count / 1e4)}万`
  return String(Math.round(count))
}
