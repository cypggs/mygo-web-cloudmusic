import { Show, createSignal } from 'solid-js'
import { Icon, Transport } from './Icon'
import { Artwork } from './Artwork'
import {
  current, playing, loading, position, duration, volume, shuffle, repeat,
  toggle, previous, next, seek, setVolume, toggleShuffle, cycleRepeat, isLiked, toggleLike,
} from '../player'
import { clock, coverUrl } from '../types'

export function PlayingBars() {
  return <span class="playing-bars" classList={{ active: playing() }} aria-hidden="true"><i /><i /><i /><i /></span>
}

export function LikeButton(props: { track: { id: number; name: string; ar: any[]; al: any; dt: number }; light?: boolean }) {
  return (
    <button
      type="button"
      class={`like-button ${props.light ? 'light' : ''}`}
      classList={{ on: isLiked(props.track.id) }}
      aria-label={isLiked(props.track.id) ? '取消喜欢' : '喜欢'}
      title={isLiked(props.track.id) ? '取消喜欢' : '喜欢'}
      onClick={(event) => { event.stopPropagation(); toggleLike(props.track) }}
    >
      <Icon name="heart" size={18} />
    </button>
  )
}

export function Progress(props: { light?: boolean }) {
  let el!: HTMLDivElement
  const at = (event: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    seek(((event.clientX - rect.left) / rect.width) * duration())
  }
  return (
    <div
      ref={el}
      class={`app-progress ${props.light ? 'light' : ''}`}
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration())}
      aria-valuenow={Math.round(position())}
      aria-valuetext={clock(position())}
      tabindex="0"
      onPointerDown={(event) => { event.preventDefault(); el.setPointerCapture(event.pointerId); at(event) }}
      onPointerMove={(event) => el.hasPointerCapture(event.pointerId) && at(event)}
      onKeyDown={(event) => {
        const step = event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0
        if (step) { event.preventDefault(); seek(position() + step) }
      }}
    >
      <div class="app-progress-fill" style={{ width: `${Math.min(100, (position() / Math.max(duration(), 1)) * 100)}%` }} />
    </div>
  )
}

export function TransportControls(props: { light?: boolean; large?: boolean }) {
  return (
    <div class={`transport-controls ${props.light ? 'light' : ''} ${props.large ? 'large' : ''}`}>
      <button type="button" class="icon-button" classList={{ on: shuffle() }} aria-label="随机播放" title="随机播放" onClick={toggleShuffle}>
        <Icon name="shuffle" size={16} />
      </button>
      <button type="button" class="icon-button" aria-label="上一首" onClick={previous}><Transport name="prev" size={18} /></button>
      <button type="button" class="main-play" aria-label={playing() ? '暂停' : '播放'} onClick={toggle}>
        <Show when={!loading()} fallback={<span class="spinner" />}><Transport name={playing() ? 'pause' : 'play'} size={props.large ? 26 : 21} /></Show>
      </button>
      <button type="button" class="icon-button" aria-label="下一首" onClick={() => next()}><Transport name="next" size={18} /></button>
      <button type="button" class={`icon-button repeat-${repeat()}`} classList={{ on: repeat() !== 'off' }} aria-label="循环模式" title={repeat() === 'one' ? '单曲循环' : repeat() === 'list' ? '列表循环' : '顺序播放'} onClick={cycleRepeat}>
        <Icon name="repeat" size={16} />{repeat() === 'one' && <span class="repeat-one">1</span>}
      </button>
    </div>
  )
}

export function PlayerBar(props: { openNow: (tab?: string) => void }) {
  const [volumeOpen, setVolumeOpen] = createSignal(false)
  return (
    <footer class="player-bar">
      <Show when={current()} fallback={<div class="empty-player">选择一首歌曲，开始聆听</div>}>
        {(track) => <>
          <button type="button" class="player-song" onClick={() => props.openNow()} aria-label="打开正在播放">
            <Artwork src={coverUrl(track(), 160)} alt={track().name} eager />
            <span class="player-song-text"><b>{track().name}</b><span>{track().ar.map((a) => a.name).join(' / ')}</span></span>
          </button>
          <LikeButton track={track()} />
          <div class="player-center">
            <TransportControls />
            <div class="player-progress"><span>{clock(position())}</span><Progress /><span>{clock(duration())}</span></div>
          </div>
          <div class="player-actions">
            <button type="button" class="icon-button" aria-label="歌词" title="歌词" onClick={() => props.openNow('lyrics')}><Icon name="lyrics" size={18} /></button>
            <button type="button" class="icon-button" aria-label="待播清单" title="待播清单" onClick={() => props.openNow('queue')}><Icon name="queue" size={18} /></button>
            <div class="volume-control">
              <button type="button" class="icon-button" aria-label="音量" onClick={() => setVolumeOpen(!volumeOpen())}><Icon name={volume() === 0 ? 'mute' : 'volume'} size={18} /></button>
              <Show when={volumeOpen()}>
                <div class="volume-popover">
                  <input aria-label="音量" type="range" min="0" max="1" step="0.01" value={volume()} onInput={(e) => setVolume(Number(e.currentTarget.value))} />
                  <span>{Math.round(volume() * 100)}</span>
                </div>
              </Show>
            </div>
          </div>
        </>}
      </Show>
    </footer>
  )
}
