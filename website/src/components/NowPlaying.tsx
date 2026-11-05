import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { api } from '../api'
import { current, duration, playing, position, queue, index, jump, seek, volume, setVolume } from '../player'
import { artistNames, clock, coverUrl, type Comment, type Track } from '../types'
import { Artwork } from './Artwork'
import { Icon } from './Icon'
import { LikeButton, Progress, TransportControls } from './PlayerBar'

interface LyricLine { time: number; text: string; translation?: string }

function parseLyrics(source = '', translated = ''): LyricLine[] {
  const parse = (text: string) => {
    const rows: { time: number; text: string }[] = []
    const regex = /\[(\d+):(\d+(?:\.\d+)?)\]([^\n\r]*)/g
    let match
    while ((match = regex.exec(text))) {
      const value = match[3].trim()
      if (value) rows.push({ time: Number(match[1]) * 60 + Number(match[2]), text: value })
    }
    return rows
  }
  const lines = parse(source)
  const translations = new Map(parse(translated).map((line) => [line.time.toFixed(2), line.text]))
  return lines.map((line) => ({ ...line, translation: translations.get(line.time.toFixed(2)) }))
}

export function NowPlaying(props: { onClose: () => void; tab?: string }) {
  const [pane, setPane] = createSignal(props.tab || 'lyrics')
  const [lyrics, setLyrics] = createSignal<LyricLine[]>([])
  const [lyricsLoaded, setLyricsLoaded] = createSignal(false)
  const [comments, setComments] = createSignal<Comment[]>([])
  const [hotComments, setHotComments] = createSignal<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = createSignal(false)
  let lyricList: HTMLDivElement | undefined

  createEffect(() => {
    const id = current()?.id
    if (!id) return
    setLyrics([])
    setLyricsLoaded(false)
    setComments([])
    setHotComments([])
    void api<{ lrc?: { lyric: string }; tlyric?: { lyric: string } }>(`/api/lyrics?id=${id}`)
      .then((data) => { if (current()?.id === id) setLyrics(parseLyrics(data.lrc?.lyric, data.tlyric?.lyric)) })
      .catch(() => {})
      .finally(() => { if (current()?.id === id) setLyricsLoaded(true) })
  })

  createEffect(() => {
    const id = current()?.id
    if (!id || pane() !== 'comments') return
    setCommentsLoading(true)
    void api<{ comments: Comment[]; hotComments: Comment[] }>(`/api/comments?id=${id}`)
      .then((data) => { if (current()?.id === id) { setComments(data.comments || []); setHotComments(data.hotComments || []) } })
      .catch(() => {})
      .finally(() => setCommentsLoading(false))
  })

  const activeLyric = createMemo(() => {
    let found = -1
    const lines = lyrics()
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= position() + 0.08) found = i
      else break
    }
    return found
  })

  createEffect(() => {
    const active = activeLyric()
    if (active < 0 || pane() !== 'lyrics' || !lyricList) return
    requestAnimationFrame(() => {
      const row = lyricList?.querySelector<HTMLElement>('.lyric-line.active')
      if (row && lyricList) lyricList.scrollTo({ top: Math.max(0, row.offsetTop - lyricList.clientHeight * 0.3), behavior: 'smooth' })
    })
  })

  return (
    <Show when={current()}>
      {(track) => (
        <section class="now-playing" role="dialog" aria-label="正在播放" style={{ '--np-cover': `url("${coverUrl(track(), 1000)}")` }}>
          <div class="np-backdrop" aria-hidden="true" />
          <header class="np-header">
            <button type="button" class="np-close" aria-label="关闭正在播放" onClick={props.onClose}><Icon name="down" size={24} /></button>
            <div class="np-brand"><Icon name="music" size={16} />正在播放</div>
            <a class="np-source" href={`https://music.163.com/song?id=${track().id}`} target="_blank" rel="noreferrer">网易云音乐<Icon name="external" size={13} /></a>
          </header>
          <nav class="np-tabs" aria-label="正在播放视图">
            <For each={[['lyrics', '歌词'], ['stage', '律动'], ['queue', '待播清单'], ['comments', '评论']]}>
              {([id, label]) => <button type="button" classList={{ on: pane() === id }} onClick={() => setPane(id)}>{label}</button>}
            </For>
          </nav>

          <Show when={pane() !== 'stage'} fallback={<Stage track={track()} lyrics={lyrics()} active={activeLyric()} />}>
            <div class="np-body">
              <div class="np-player-column">
                <div class="np-cover-wrap" classList={{ playing: playing() }}>
                  <div class="np-vinyl" aria-hidden="true" />
                  <Artwork src={coverUrl(track(), 800)} alt={track().name} class="np-cover" eager />
                </div>
                <div class="np-title-row">
                  <div><h2>{track().name}</h2><p>{artistNames(track())} · {track().al?.name}</p></div>
                  <LikeButton track={track()} light />
                </div>
                <Progress light />
                <div class="np-times"><span>{clock(position())}</span><span>-{clock(Math.max(0, duration() - position()))}</span></div>
                <TransportControls light large />
                <div class="np-volume"><Icon name={volume() === 0 ? 'mute' : 'volume'} size={16} /><input aria-label="音量" type="range" min="0" max="1" step="0.01" value={volume()} onInput={(e) => setVolume(Number(e.currentTarget.value))} /></div>
              </div>
              <div class="np-pane">
                <Show when={pane() === 'lyrics'}>
                  <div class="lyrics-list" ref={lyricList}>
                    <Show when={lyrics().length} fallback={<div class="lyrics-empty">{lyricsLoaded() ? '纯音乐，请欣赏' : '歌词加载中…'}</div>}>
                      <For each={lyrics()}>
                        {(line, i) => (
                          <button type="button" class="lyric-line" classList={{ active: activeLyric() === i() }} onClick={() => seek(line.time)}>
                            <span>{line.text}</span><Show when={line.translation}><small>{line.translation}</small></Show>
                          </button>
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
                <Show when={pane() === 'queue'}><QueuePane /></Show>
                <Show when={pane() === 'comments'}>
                  <div class="comments-pane">
                    <Show when={!commentsLoading()} fallback={<div class="lyrics-empty">评论加载中…</div>}>
                      <Show when={hotComments().length}><h3>热门评论</h3><For each={hotComments()}>{CommentRow}</For><h3>最新评论</h3></Show>
                      <For each={comments()}>{CommentRow}</For>
                      <Show when={!comments().length && !hotComments().length}><div class="lyrics-empty">还没有评论</div></Show>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </section>
      )}
    </Show>
  )
}

function QueuePane() {
  return (
    <div class="queue-pane">
      <div class="queue-heading"><h3>待播清单</h3><span>{queue().length} 首</span></div>
      <For each={queue()}>
        {(track, i) => (
          <button type="button" class="queue-row" classList={{ active: index() === i() }} onClick={() => jump(i())}>
            <Artwork src={coverUrl(track, 100)} alt="" />
            <span><b>{track.name}</b><small>{artistNames(track)}</small></span>
            <time>{clock(track.dt / 1000)}</time>
          </button>
        )}
      </For>
    </div>
  )
}

function CommentRow(comment: Comment) {
  return (
    <article class="comment-row">
      <Artwork src={coverUrl(comment.user, 100)} alt="" round />
      <div><p><b>{comment.user.nickname}</b><time>{new Date(comment.time).toLocaleDateString('zh-CN')}</time></p><div class="comment-content">{comment.content}</div><span class="comment-meta">♡ {comment.likedCount}{comment.ipLocation?.location ? ` · IP 属地 ${comment.ipLocation.location}` : ''}</span></div>
    </article>
  )
}

function Stage(props: { track: Track; lyrics: LyricLine[]; active: number }) {
  const line = () => props.lyrics[props.active]
  return (
    <div class="lyric-stage">
      <div class="stage-words">
        <Show when={line()} fallback={<p>{props.track.name}<small>{artistNames(props.track)}</small></p>}>
          {(currentLine) => <p>{currentLine().text}<Show when={currentLine().translation}><small>{currentLine().translation}</small></Show></p>}
        </Show>
      </div>
      <div class="stage-controls"><Progress light /><div><span>{clock(position())} / {clock(duration())}</span><TransportControls light /><span>{props.track.name}</span></div></div>
    </div>
  )
}
