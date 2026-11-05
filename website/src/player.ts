import { createSignal } from 'solid-js'
import { api, loadJSON, saveJSON } from './api'
import type { Track } from './types'

const demo: Track = {
  id: 2097486090,
  name: '春日影',
  ar: [{ id: 54743836, name: 'MyGO!!!!!' }],
  al: {
    id: 178518010,
    name: '迷跡波',
    picUrl: 'https://p1.music.126.net/_0rz5AVl1HMq0_FBnRHSbA==/109951170225711695.jpg',
  },
  dt: 281000,
  localSrc: '/haruhikage.m4a',
}

type Repeat = 'list' | 'one' | 'off'

const restored = typeof window !== 'undefined' ? loadJSON<{ queue: Track[]; index: number }>('mygo-player', { queue: [demo], index: 0 }) : { queue: [demo], index: 0 }
const initialQueue = restored.queue?.length ? restored.queue : [demo]
const initialIndex = Math.max(0, Math.min(restored.index || 0, initialQueue.length - 1))

const [queue, setQueue] = createSignal<Track[]>(initialQueue)
const [index, setIndex] = createSignal(initialIndex)
const [playing, setPlaying] = createSignal(false)
const [loading, setLoading] = createSignal(false)
const [position, setPosition] = createSignal(0)
const [duration, setDuration] = createSignal(initialQueue[initialIndex].dt / 1000)
const [volume, setVolumeSignal] = createSignal(typeof window !== 'undefined' ? loadJSON('mygo-volume', 0.8) : 0.8)
const [shuffle, setShuffle] = createSignal(false)
const [repeat, setRepeat] = createSignal<Repeat>('list')
const [liked, setLiked] = createSignal<number[]>(typeof window !== 'undefined' ? loadJSON('mygo-liked', []) : [])
const [playerError, setPlayerError] = createSignal('')

export { queue, index, playing, loading, position, duration, volume, shuffle, repeat, liked, playerError }
export const current = () => queue()[index()] as Track | undefined

let audio: HTMLAudioElement | undefined
let loadID = 0
let frame = 0

function persist() {
  saveJSON('mygo-player', { queue: queue().map(({ localSrc, ...track }) => track), index: index() })
}

function tick() {
  if (audio) setPosition(audio.currentTime || 0)
  if (playing()) frame = requestAnimationFrame(tick)
}

function mediaSession(track: Track) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: track.ar.map((a) => a.name).join(' / '),
    album: track.al?.name || '',
    artwork: track.al?.picUrl ? [{ src: track.al.picUrl.replace(/^http:/, 'https:'), sizes: '512x512' }] : [],
  })
  navigator.mediaSession.setActionHandler('play', play)
  navigator.mediaSession.setActionHandler('pause', pause)
  navigator.mediaSession.setActionHandler('previoustrack', previous)
  navigator.mediaSession.setActionHandler('nexttrack', () => next())
}

function element() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'metadata'
  audio.volume = volume()
  audio.addEventListener('timeupdate', () => setPosition(audio?.currentTime || 0))
  audio.addEventListener('durationchange', () => {
    if (audio && Number.isFinite(audio.duration)) setDuration(audio.duration)
  })
  audio.addEventListener('play', () => {
    setPlaying(true)
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(tick)
  })
  audio.addEventListener('pause', () => {
    setPlaying(false)
    cancelAnimationFrame(frame)
  })
  audio.addEventListener('waiting', () => setLoading(true))
  audio.addEventListener('canplay', () => setLoading(false))
  audio.addEventListener('error', () => {
    setLoading(false)
    setPlaying(false)
    setPlayerError('音频加载失败，请检查网络后重试')
  })
  audio.addEventListener('ended', () => {
    if (repeat() === 'one') {
      if (audio) audio.currentTime = 0
      void play()
    } else {
      next(true)
    }
  })
  return audio
}

async function loadCurrent(autoplay: boolean) {
  const track = current()
  if (!track || typeof window === 'undefined') return
  const id = ++loadID
  const el = element()
  el.pause()
  setPosition(0)
  setDuration(track.dt / 1000)
  setPlayerError('')
  setLoading(true)
  mediaSession(track)
  try {
    let src = track.localSrc
    if (!src) {
      const quality = loadJSON('mygo-quality', 'exhigh')
      const result = await api<{ stream: { url: string } }>(`/api/stream?id=${track.id}&level=${quality}`)
      if (id !== loadID) return
      src = result.stream.url
    }
    if (id !== loadID) return
    el.src = src
    el.load()
    if (autoplay) await el.play()
    setLoading(false)
  } catch (error) {
    if (id !== loadID) return
    setLoading(false)
    setPlaying(false)
    setPlayerError(error instanceof Error ? error.message : '这首歌曲暂时无法播放')
  }
}

export function playQueue(tracks: Track[], at = 0) {
  if (!tracks.length) return
  setQueue(tracks)
  setIndex(Math.max(0, Math.min(at, tracks.length - 1)))
  persist()
  void loadCurrent(true)
}

export function jump(to: number) {
  if (to < 0 || to >= queue().length) return
  setIndex(to)
  persist()
  void loadCurrent(true)
}

export function play() {
  if (!audio?.src) {
    void loadCurrent(true)
    return
  }
  void element().play().catch((error) => setPlayerError(error instanceof Error ? error.message : '播放失败'))
}

export function pause() {
  audio?.pause()
}

export function toggle() {
  playing() ? pause() : play()
}

export function next(automatic = false) {
  const count = queue().length
  if (!count) return
  if (shuffle() && count > 1) {
    let to = index()
    while (to === index()) to = Math.floor(Math.random() * count)
    jump(to)
    return
  }
  if (index() >= count - 1 && repeat() === 'off' && automatic) {
    pause()
    if (audio) audio.currentTime = 0
    return
  }
  jump((index() + 1) % count)
}

export function previous() {
  if (position() > 4) {
    seek(0)
    return
  }
  if (!queue().length) return
  jump((index() - 1 + queue().length) % queue().length)
}

export function seek(seconds: number) {
  const to = Math.max(0, Math.min(duration(), seconds))
  setPosition(to)
  if (audio) audio.currentTime = to
}

export function setVolume(value: number) {
  const to = Math.max(0, Math.min(1, value))
  setVolumeSignal(to)
  if (audio) audio.volume = to
  saveJSON('mygo-volume', to)
}

export function toggleShuffle() {
  setShuffle(!shuffle())
}

export function cycleRepeat() {
  setRepeat(repeat() === 'list' ? 'one' : repeat() === 'one' ? 'off' : 'list')
}

export function isLiked(id: number) {
  return liked().includes(id)
}

export function toggleLike(track: Track) {
  const on = !isLiked(track.id)
  setLiked(on ? [...liked(), track.id] : liked().filter((id) => id !== track.id))
  saveJSON('mygo-liked', liked())
  void api(`/api/like?id=${track.id}&like=${on}`, { method: 'POST' }).catch(() => {})
}

export function restorePosition(seconds: number) {
  if (seconds > 0 && seconds < duration()) seek(seconds)
}

export { clock } from './types'
