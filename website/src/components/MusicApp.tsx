import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { api, loadJSON, saveJSON } from '../api'
import {
  current, queue, playing, position, playerError, playQueue, toggle,
} from '../player'
import {
  artistNames, clock, coverUrl, plays,
  type Album, type Artist, type HomeData, type Page, type Playlist, type Profile, type Track,
} from '../types'
import { AppIcon } from './AppIcon'
import { Artwork } from './Artwork'
import { Icon, GitHubMark, type IconName } from './Icon'
import { LikeButton, PlayerBar, PlayingBars } from './PlayerBar'
import { NowPlaying } from './NowPlaying'
import { LoginDialog } from './LoginDialog'
import { SettingsDialog } from './SettingsDialog'

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const emptyHome: HomeData = { featured: [], charts: [], daily: [], recommended: [] }
const nav: { icon: IconName; label: string; page: Page['name'] }[] = [
  { icon: 'home', label: '为你推荐', page: 'home' },
  { icon: 'calendar', label: '每日推荐', page: 'daily' },
  { icon: 'radio', label: '私人 FM', page: 'fm' },
  { icon: 'chart', label: '排行榜', page: 'charts' },
  { icon: 'podcast', label: '播客', page: 'podcasts' },
]
const searchKinds = [
  { kind: 1, label: '单曲', unit: '首单曲' }, { kind: 100, label: '歌手', unit: '位歌手' },
  { kind: 10, label: '专辑', unit: '张专辑' }, { kind: 1000, label: '歌单', unit: '个歌单' },
  { kind: 1002, label: '用户', unit: '位用户' }, { kind: 1009, label: '播客', unit: '个播客' },
]

function greeting(hour: number) {
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function MusicApp() {
  const [now, setNow] = createSignal(new Date(2026, 0, 1, 12))
  const [route, setRoute] = createSignal<Page>({ name: 'home' })
  const [history, setHistory] = createSignal<Page[]>([])
  const [forward, setForward] = createSignal<Page[]>([])
  const [home, setHome] = createSignal<HomeData>(emptyHome)
  const [homeLoading, setHomeLoading] = createSignal(true)
  const [homeError, setHomeError] = createSignal('')
  const [playlist, setPlaylist] = createSignal<Playlist>()
  const [artist, setArtist] = createSignal<Artist & { hotSongs?: Track[] }>()
  const [album, setAlbum] = createSignal<Album & { songs?: Track[] }>()
  const [pageLoading, setPageLoading] = createSignal(false)
  const [pageError, setPageError] = createSignal('')
  const [profile, setProfile] = createSignal<Profile>()
  const [mine, setMine] = createSignal<Playlist[]>([])
  const [saved, setSaved] = createSignal<Playlist[]>([])
  const [query, setQuery] = createSignal('')
  const [searchData, setSearchData] = createSignal<any>()
  const [searchHistory, setSearchHistory] = createSignal<string[]>([])
  const [suggestions, setSuggestions] = createSignal<any>()
  const [searchFocused, setSearchFocused] = createSignal(false)
  const [nowPlaying, setNowPlaying] = createSignal(false)
  const [nowTab, setNowTab] = createSignal('lyrics')
  const [loginOpen, setLoginOpen] = createSignal(false)
  const [settingsOpen, setSettingsOpen] = createSignal(false)
  const [mobileOpen, setMobileOpen] = createSignal(false)
  const [toast, setToast] = createSignal('')
  const [fmMode, setFmMode] = createSignal('DEFAULT')
  const [fmLoading, setFmLoading] = createSignal(false)
  const [fmStarted, setFmStarted] = createSignal(false)
  const [podcasts, setPodcasts] = createSignal<Playlist[]>([])
  let searchInput: HTMLInputElement | undefined
  let pageScroll: HTMLDivElement | undefined
  let suggestTimer: ReturnType<typeof setTimeout> | undefined
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const date = () => `${now().getMonth() + 1}月${now().getDate()}日 ${weekdays[now().getDay()]}`
  const notify = (message: string) => {
    setToast(message)
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => setToast(''), 3200)
  }

  async function loadHome() {
    setHomeLoading(true)
    setHomeError('')
    try { setHome(await api<HomeData>('/api/home')) }
    catch (error) { setHomeError(error instanceof Error ? error.message : '无法连接网易云音乐，请检查网络') }
    finally { setHomeLoading(false) }
  }

  async function loadAccount() {
    try {
      const data = await api<{ profile?: Profile }>('/api/account')
      setProfile(data.profile)
      if (data.profile) await loadUserPlaylists(data.profile.userId)
    } catch {}
  }

  async function loadUserPlaylists(uid: number) {
    try {
      const data = await api<{ playlist: Playlist[] }>(`/api/user-playlists?uid=${uid}`)
      setMine((data.playlist || []).filter((item) => !item.subscribed))
      setSaved((data.playlist || []).filter((item) => item.subscribed))
    } catch {}
  }

  async function loadFor(page: Page) {
    setPageError('')
    if (page.name === 'playlist') {
      setPageLoading(true); setPlaylist(undefined)
      try {
        const data = await api<{ playlist: Playlist }>(`/api/playlist?id=${page.id}`)
        const currentRoute = route()
        if (currentRoute.name === 'playlist' && currentRoute.id === page.id) setPlaylist(data.playlist)
      } catch (error) { setPageError(error instanceof Error ? error.message : '歌单加载失败') }
      finally { setPageLoading(false) }
    } else if (page.name === 'artist') {
      setPageLoading(true); setArtist(undefined)
      try {
        const data = await api<{ artist: Artist; hotSongs: Track[] }>(`/api/artist?id=${page.id}`)
        setArtist({ ...data.artist, hotSongs: data.hotSongs })
      } catch (error) { setPageError(error instanceof Error ? error.message : '歌手加载失败') }
      finally { setPageLoading(false) }
    } else if (page.name === 'album') {
      setPageLoading(true); setAlbum(undefined)
      try { const data = await api<{ album: Album; songs: Track[] }>(`/api/album?id=${page.id}`); setAlbum({ ...data.album, songs: data.songs }) }
      catch (error) { setPageError(error instanceof Error ? error.message : '专辑加载失败') }
      finally { setPageLoading(false) }
    } else if (page.name === 'search') {
      setPageLoading(true); setSearchData(undefined)
      try { setSearchData(await api(`/api/search?q=${encodeURIComponent(page.query)}&type=${page.kind}&limit=60&offset=0`)) }
      catch (error) { setPageError(error instanceof Error ? error.message : '搜索失败，请稍后再试') }
      finally { setPageLoading(false) }
    } else if (page.name === 'podcasts' && !podcasts().length) {
      setPageLoading(true)
      try { const data = await api<any>('/api/search?q=%E9%9F%B3%E4%B9%90&type=1009&limit=30'); setPodcasts(data.result?.djRadios || []) }
      catch (error) { setPageError(error instanceof Error ? error.message : '播客加载失败') }
      finally { setPageLoading(false) }
    }
  }

  function show(page: Page) {
    setRoute(page)
    setNowPlaying(false)
    setMobileOpen(false)
    setSearchFocused(false)
    if (page.name === 'search') setQuery(page.query)
    requestAnimationFrame(() => pageScroll?.scrollTo({ top: 0 }))
    void loadFor(page)
  }

  function open(page: Page) {
    setHistory([...history(), route()])
    setForward([])
    show(page)
  }

  function back() {
    const previous = history().at(-1)
    if (!previous) return
    setForward([route(), ...forward()])
    setHistory(history().slice(0, -1))
    show(previous)
  }

  function goForward() {
    const next = forward()[0]
    if (!next) return
    setHistory([...history(), route()])
    setForward(forward().slice(1))
    show(next)
  }

  function submitSearch(value = query()) {
    const q = value.trim()
    if (!q) return
    setQuery(q)
    setSuggestions(undefined)
    setSearchFocused(false)
    const nextHistory = [q, ...searchHistory().filter((item) => item !== q)].slice(0, 20)
    setSearchHistory(nextHistory); saveJSON('mygo-search-history', nextHistory)
    const currentRoute = route()
    open({ name: 'search', query: q, kind: currentRoute.name === 'search' ? currentRoute.kind : 1 })
  }

  function queryChanged(value: string) {
    setQuery(value)
    if (suggestTimer) clearTimeout(suggestTimer)
    if (!value.trim()) { setSuggestions(undefined); return }
    suggestTimer = setTimeout(async () => {
      try { setSuggestions(await api(`/api/suggest?q=${encodeURIComponent(value.trim())}`)) } catch {}
    }, 220)
  }

  async function playPlaylist(id: number) {
    try {
      const data = await api<{ playlist: Playlist }>(`/api/playlist?id=${id}`)
      if (data.playlist.tracks?.length) playQueue(data.playlist.tracks, 0)
    } catch (error) { notify(error instanceof Error ? error.message : '歌单播放失败') }
  }

  async function startFM() {
    setFmLoading(true)
    try {
      const data = await api<{ data: Track[] }>(`/api/fm?mode=${fmMode()}`)
      if (!data.data.length) throw new Error('暂时没有可播放的推荐')
      playQueue(data.data, 0); setFmStarted(true)
    } catch (error) { notify(error instanceof Error ? error.message : '私人 FM 暂时无法播放') }
    finally { setFmLoading(false) }
  }

  async function startHeart() {
    if (!profile()) { setLoginOpen(true); return }
    const liked = mine().find((item) => item.specialType === 5) || mine()[0]
    if (!liked) { notify('喜欢一些歌曲后，即可开启心动模式'); return }
    await playPlaylist(liked.id)
    notify('已从喜欢的音乐开始播放')
  }

  function openNow(tab = 'lyrics') { setNowTab(tab); setNowPlaying(true) }

  onMount(() => {
    setNow(new Date())
    setSearchHistory(loadJSON('mygo-search-history', []))
    void loadHome()
    void loadAccount()
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (event.code === 'Space' && !editing) { event.preventDefault(); toggle() }
      if (event.key === 'Escape') {
        if (nowPlaying()) setNowPlaying(false)
        else if (settingsOpen()) setSettingsOpen(false)
        else if (loginOpen()) setLoginOpen(false)
        else setMobileOpen(false)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); setNowPlaying(false); searchInput?.focus() }
      if ((event.metaKey || event.ctrlKey) && event.key === '[') back()
    }
    window.addEventListener('keydown', keys)
    onCleanup(() => window.removeEventListener('keydown', keys))
  })

  createEffect(() => { if (playerError()) notify(playerError()) })

  return (
    <div class="music-app" classList={{ 'np-open': nowPlaying() }}>
      <Show when={mobileOpen()}><button type="button" class="mobile-scrim" aria-label="关闭导航" onClick={() => setMobileOpen(false)} /></Show>
      <aside class="app-sidebar" classList={{ 'mobile-open': mobileOpen() }}>
        <div class="sidebar-top">
          <div class="desktop-lights" aria-hidden="true"><i /><i /><i /></div>
          <a class="app-brand" href="https://github.com/cypggs/mygo-web-cloudmusic" target="_blank" rel="noreferrer" title="查看源代码"><AppIcon size={30} /><span>MyGo 云音乐</span></a>
          <button type="button" class="mobile-close icon-button" aria-label="关闭导航" onClick={() => setMobileOpen(false)}><Icon name="close" size={19} /></button>
        </div>
        <div class="search-wrap">
          <div class="app-search" classList={{ focused: searchFocused() }}>
            <Icon name="search" size={14} />
            <input
              ref={searchInput}
              value={query()}
              placeholder="搜索歌曲、歌手"
              aria-label="搜索歌曲、歌手"
              onInput={(e) => queryChanged(e.currentTarget.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            />
            <Show when={query()}><button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); setSuggestions(undefined); searchInput?.focus() }}><Icon name="close" size={12} /></button></Show>
          </div>
          <Show when={searchFocused()}>
            <SearchSuggestions
              query={query()} data={suggestions()} history={searchHistory()}
              select={(value) => submitSearch(value)}
              open={open}
              clear={() => { setSearchHistory([]); saveJSON('mygo-search-history', []) }}
            />
          </Show>
        </div>
        <nav class="sidebar-nav">
          <For each={nav}>{(item) => <button type="button" class="side-nav-item" classList={{ on: route().name === item.page }} onClick={() => open({ name: item.page } as Page)}><Icon name={item.icon} size={17} /><span>{item.label}</span></button>}</For>
          <Show when={route().name === 'search'}><button type="button" class="side-nav-item on"><Icon name="search" size={17} /><span>搜索结果</span></button></Show>
          <PlaylistGroup title="我的歌单" items={mine()} open={open} fallback="登录后显示你的歌单" />
          <PlaylistGroup title="收藏的歌单" items={saved()} open={open} />
        </nav>
        <div class="sidebar-bottom">
          <Show when={current()}>
            {(track) => <button type="button" class="sidebar-now" onClick={() => openNow()}><Artwork src={coverUrl(track(), 100)} alt="" /><span><b>{track().name}</b><small>{artistNames(track())}</small></span><PlayingBars /></button>}
          </Show>
          <div class="account-row">
            <button type="button" class="account-button" onClick={() => profile() ? setSettingsOpen(true) : setLoginOpen(true)}>
              <Show when={profile()} fallback={<span class="avatar-placeholder"><Icon name="user" size={18} /></span>}>
                {(user) => <><img class="account-avatar" src={user().avatarUrl} alt="" /><span><b>{user().nickname}</b><small>已登录</small></span></>}
              </Show>
              <Show when={!profile()}><span><b>未登录</b><small>点击扫码登录</small></span></Show>
            </button>
            <button type="button" class="icon-button" aria-label="设置" title="设置" onClick={() => setSettingsOpen(true)}><Icon name="settings" size={17} /></button>
          </div>
        </div>
      </aside>

      <main class="app-main">
        <header class="app-topbar">
          <button type="button" class="mobile-menu icon-button" aria-label="打开导航" onClick={() => setMobileOpen(true)}><Icon name="queue" size={20} /></button>
          <div class="history-buttons"><button type="button" class="icon-button" disabled={!history().length} aria-label="返回" onClick={back}><Icon name="back" size={19} /></button><button type="button" class="icon-button" disabled={!forward().length} aria-label="前进" onClick={goForward}><Icon name="forward" size={19} /></button></div>
          <span class="topbar-title">{nav.find((item) => item.page === route().name)?.label || (route().name === 'playlist' ? '歌单' : route().name === 'search' ? '搜索' : 'MyGo 云音乐')}</span>
          <a href="https://github.com/cypggs/mygo-web-cloudmusic" target="_blank" rel="noreferrer" class="icon-button github-link" aria-label="GitHub 源代码"><GitHubMark size={17} /></a>
        </header>
        <div class="page-scroll" ref={pageScroll}>
          <Show when={route().name === 'home'}><HomePage now={now()} data={home()} loading={homeLoading()} error={homeError()} retry={loadHome} open={open} playPlaylist={playPlaylist} login={() => setLoginOpen(true)} /></Show>
          <Show when={route().name === 'daily'}><DailyPage data={home()} loading={homeLoading()} retry={loadHome} /></Show>
          <Show when={route().name === 'charts'}><ChartsPage charts={home().charts} loading={homeLoading()} open={open} playPlaylist={playPlaylist} /></Show>
          <Show when={route().name === 'fm'}><FMPage mode={fmMode()} setMode={setFmMode} loading={fmLoading()} started={fmStarted()} start={startFM} heart={startHeart} /></Show>
          <Show when={route().name === 'podcasts'}><PodcastsPage items={podcasts()} loading={pageLoading()} error={pageError()} /></Show>
          <Show when={route().name === 'playlist'}><PlaylistPage playlist={playlist()} loading={pageLoading()} error={pageError()} retry={() => loadFor(route())} open={open} /></Show>
          <Show when={route().name === 'artist'}><ArtistPage artist={artist()} loading={pageLoading()} error={pageError()} open={open} /></Show>
          <Show when={route().name === 'album'}><AlbumPage album={album()} loading={pageLoading()} error={pageError()} open={open} /></Show>
          <Show when={route().name === 'search'}><SearchPage route={route() as Extract<Page, { name: 'search' }>} data={searchData()} loading={pageLoading()} error={pageError()} open={open} changeKind={(kind) => show({ ...route() as Extract<Page, { name: 'search' }>, kind })} playPlaylist={playPlaylist} /></Show>
        </div>
        <PlayerBar openNow={openNow} />
      </main>

      <Show when={nowPlaying()}><NowPlaying tab={nowTab()} onClose={() => setNowPlaying(false)} /></Show>
      <Show when={loginOpen()}><LoginDialog onClose={() => setLoginOpen(false)} onLogged={(user) => { setProfile(user); void loadUserPlaylists(user.userId); void loadHome(); notify(`欢迎回来，${user.nickname}`) }} /></Show>
      <Show when={settingsOpen()}><SettingsDialog profile={profile()} onLogin={() => { setSettingsOpen(false); setLoginOpen(true) }} onLogout={() => { setProfile(undefined); setMine([]); setSaved([]); notify('已退出登录') }} onClose={() => setSettingsOpen(false)} /></Show>
      <Show when={toast()}><div class="app-toast" role="status">{toast()}</div></Show>
    </div>
  )
}

function Heading(props: { title: string; sub?: string }) {
  return <div class="page-heading"><Show when={props.sub}><p>{props.sub}</p></Show><h1>{props.title}</h1></div>
}

function LoadingPage() {
  return <div class="page-content"><div class="skeleton-heading" /><div class="skeleton-hero" /><div class="skeleton-grid"><For each={Array(12)}>{() => <div><i /><span /></div>}</For></div></div>
}

function ErrorState(props: { message: string; retry?: () => void }) {
  return <div class="center-state"><Icon name="music" size={36} /><p>{props.message}</p><Show when={props.retry}><button type="button" class="pill" onClick={props.retry}>重试</button></Show></div>
}

function HomePage(props: { now: Date; data: HomeData; loading: boolean; error: string; retry: () => void; open: (page: Page) => void; playPlaylist: (id: number) => void; login: () => void }) {
  return (
    <div class="page-content home-page">
      <Heading title={greeting(props.now.getHours())} sub={`${props.now.getMonth() + 1}月${props.now.getDate()}日 ${weekdays[props.now.getDay()]}`} />
      <Show when={!props.loading || props.data.charts.length} fallback={<LoadingPage />}>
        <Show when={props.data.charts.length || props.data.daily.length} fallback={<ErrorState message={props.error || '暂时没有推荐'} retry={props.retry} />}>
          <DailyCard now={props.now} songs={props.data.daily} open={props.open} login={props.login} />
          <Show when={props.data.recommended.length}><h2 class="section-title">今日为你推荐</h2><div class="cover-grid"><For each={props.data.recommended.slice(0, 12)}>{(item) => <PlaylistCard playlist={item} open={props.open} play={props.playPlaylist} />}</For></div></Show>
          <h2 class="section-title">官方榜单</h2>
          <div class="chart-grid"><For each={props.data.charts.slice(0, 4)}>{(item) => <ChartCard playlist={item} open={props.open} />}</For></div>
          <h2 class="section-title">推荐歌单</h2>
          <div class="cover-grid"><For each={props.data.featured}>{(item) => <PlaylistCard playlist={item} open={props.open} play={props.playPlaylist} />}</For></div>
        </Show>
      </Show>
    </div>
  )
}

function DailyCard(props: { now: Date; songs: Track[]; open: (page: Page) => void; login: () => void }) {
  const songs = () => props.songs.length ? props.songs : []
  const artists = () => [...new Set(songs().flatMap((song) => song.ar.slice(0, 1).map((a) => a.name)))].slice(0, 3).join('、')
  return (
    <article class="daily-card" onClick={() => props.open({ name: 'daily' })} style={{ '--daily-cover': `url("${coverUrl(songs()[0], 800)}")` }}>
      <div class="daily-bg" aria-hidden="true" />
      <span class="daily-big-day" aria-hidden="true">{props.now.getDate()}</span>
      <div class="daily-copy">
        <p>{props.now.getMonth() + 1}月{props.now.getDate()}日 {weekdays[props.now.getDay()]} · 每天 6:00 更新</p>
        <h2>每日推荐</h2>
        <span>{artists() ? `${artists()} 等 ${songs().length} 首` : '大家都在听的好歌，登录后为你专属生成'}</span>
        <div class="daily-actions"><button type="button" class="daily-play" disabled={!songs().length} onClick={(e) => { e.stopPropagation(); playQueue(songs(), 0) }}><Icon name="music" size={14} />播放</button><button type="button" class="daily-login" onClick={(e) => { e.stopPropagation(); props.login() }}><Icon name="user" size={13} />登录</button></div>
      </div>
      <div class="daily-covers" aria-hidden="true">
        <For each={songs().slice(1, 3).reverse()}>{(song, i) => <Artwork src={coverUrl(song, 300)} class={`daily-sleeve back-${i()}`} />}</For>
        <div class="daily-record"><div class="vinyl" /></div>
        <Artwork src={coverUrl(songs()[0], 500)} class="daily-sleeve front" />
      </div>
    </article>
  )
}

function PlaylistCard(props: { playlist: Playlist; open: (page: Page) => void; play: (id: number) => void }) {
  return (
    <article class="playlist-card">
      <button type="button" class="cover-button" onClick={() => props.open({ name: 'playlist', id: props.playlist.id })} aria-label={props.playlist.name}>
        <Artwork src={coverUrl(props.playlist, 500)} alt={props.playlist.name} />
        <Show when={props.playlist.playCount}><span class="play-count"><Icon name="headset" size={10} />{plays(props.playlist.playCount)}</span></Show>
        <span class="cover-play" role="button" tabindex="0" aria-label={`播放 ${props.playlist.name}`} onClick={(e) => { e.stopPropagation(); props.play(props.playlist.id) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); props.play(props.playlist.id) } }}><Icon name="music" size={16} /></span>
      </button>
      <button type="button" class="cover-name" onClick={() => props.open({ name: 'playlist', id: props.playlist.id })}>{props.playlist.name}</button>
      <Show when={props.playlist.updateFrequency}><small>{props.playlist.updateFrequency}</small></Show>
    </article>
  )
}

function ChartCard(props: { playlist: Playlist; open: (page: Page) => void }) {
  return (
    <button type="button" class="chart-card" onClick={() => props.open({ name: 'playlist', id: props.playlist.id })}>
      <Artwork src={coverUrl(props.playlist, 240)} alt="" />
      <span class="chart-copy"><span class="chart-name"><b>{props.playlist.name}</b><small>{props.playlist.updateFrequency}</small></span><For each={props.playlist.preview?.slice(0, 3)}>{(line, i) => <span class="chart-line"><i>{i() + 1}</i><span>{line.first}<small>　{line.second}</small></span></span>}</For></span>
    </button>
  )
}

function DailyPage(props: { data: HomeData; loading: boolean; retry: () => void }) {
  return (
    <div class="page-content track-page">
      <Show when={!props.loading || props.data.daily.length} fallback={<LoadingPage />}>
        <div class="detail-header daily-detail"><div class="date-art" style={{ 'background-image': `url("${coverUrl(props.data.daily[0], 600)}")` }}><div><b>{new Date().getDate()}</b><span>{new Date().getMonth() + 1}月 · {weekdays[new Date().getDay()]}</span></div></div><div class="detail-copy"><p class="detail-kind">每日推荐</p><h1>每日歌曲推荐</h1><p>{props.data.daily.length} 首 · 根据你的音乐口味生成，每天 6:00 更新</p><div class="detail-actions"><button type="button" class="pill primary" onClick={() => playQueue(props.data.daily, 0)}><Icon name="music" size={14} />播放全部</button></div></div></div>
        <TrackRows tracks={props.data.daily} />
      </Show>
    </div>
  )
}

function ChartsPage(props: { charts: Playlist[]; loading: boolean; open: (page: Page) => void; playPlaylist: (id: number) => void }) {
  return <div class="page-content"><Heading title="排行榜" sub="每日更新" /><Show when={!props.loading || props.charts.length} fallback={<LoadingPage />}><div class="chart-grid"><For each={props.charts.slice(0, 4)}>{(item) => <ChartCard playlist={item} open={props.open} />}</For></div><h2 class="section-title">全部榜单</h2><div class="cover-grid"><For each={props.charts.slice(4)}>{(item) => <PlaylistCard playlist={item} open={props.open} play={props.playPlaylist} />}</For></div></Show></div>
}

function PlaylistPage(props: { playlist?: Playlist; loading: boolean; error: string; retry: () => void; open: (page: Page) => void }) {
  return <div class="page-content track-page"><Show when={props.playlist} fallback={props.error ? <ErrorState message={props.error} retry={props.retry} /> : <LoadingPage />}><For each={[props.playlist!]}>{(pl) => <><div class="detail-header"><Artwork src={coverUrl(pl, 700)} alt={pl.name} class="detail-cover" eager /><div class="detail-copy"><p class="detail-kind">{pl.updateFrequency ? `榜单 · ${pl.updateFrequency}` : '歌单'}</p><h1>{pl.name}</h1><p>{pl.creator?.nickname ? `${pl.creator.nickname} · ` : ''}{pl.tracks?.length || pl.trackCount || 0} 首{pl.playCount ? ` · ${plays(pl.playCount)} 次播放` : ''}</p><Show when={pl.description}><p class="detail-description">{pl.description}</p></Show><div class="detail-actions"><button type="button" class="pill primary" onClick={() => playQueue(pl.tracks || [], 0)}><Icon name="music" size={14} />播放</button><button type="button" class="pill" onClick={() => playQueue([...(pl.tracks || [])].sort(() => Math.random() - 0.5), 0)}><Icon name="shuffle" size={14} />随机播放</button></div></div></div><TrackRows tracks={pl.tracks || []} open={props.open} /></>}</For></Show></div>
}

function TrackRows(props: { tracks: Track[]; open?: (page: Page) => void }) {
  return (
    <div class="track-list">
      <For each={props.tracks}>
        {(track, i) => (
          <div class="track-row" classList={{ active: current()?.id === track.id }} role="button" tabindex="0" aria-label={`播放 ${track.name}`} onClick={() => playQueue(props.tracks, i())} onKeyDown={(e) => { if (e.key === 'Enter') playQueue(props.tracks, i()) }}>
            <span class="track-index"><Show when={current()?.id === track.id} fallback={<span>{i() + 1}</span>}><PlayingBars /></Show></span>
            <Artwork src={coverUrl(track, 120)} alt="" />
            <span class="track-main"><span class="track-name">{track.name}<Show when={track.alia?.[0]}><small>（{track.alia![0]}）</small></Show></span><span class="track-artists"><Show when={track.fee === 1 || track.fee === 4}><i>VIP</i></Show><For each={track.ar}>{(artist, j) => <><Show when={j() > 0}> / </Show><button type="button" onClick={(e) => { e.stopPropagation(); props.open?.({ name: 'artist', id: artist.id }) }}>{artist.name}</button></>}</For><Show when={track.reason}><em>{track.reason}</em></Show></span></span>
            <button type="button" class="track-album" onClick={(e) => { e.stopPropagation(); if (track.al?.id) props.open?.({ name: 'album', id: track.al.id }) }}>{track.al?.name}</button>
            <LikeButton track={track} />
            <time>{clock(track.dt / 1000)}</time>
          </div>
        )}
      </For>
      <Show when={!props.tracks.length}><div class="center-state"><p>这里没有歌曲</p></div></Show>
    </div>
  )
}

function SearchPage(props: { route: Extract<Page, { name: 'search' }>; data?: any; loading: boolean; error: string; open: (page: Page) => void; changeKind: (kind: number) => void; playPlaylist: (id: number) => void }) {
  const result = () => props.data?.result || {}
  const kind = () => searchKinds.find((item) => item.kind === props.route.kind)!
  const total = () => result().songCount ?? result().artistCount ?? result().albumCount ?? result().playlistCount ?? result().userprofileCount ?? result().djRadiosCount ?? 0
  return (
    <div class="page-content search-page"><Heading title={`“${props.route.query}”`} sub={props.data ? `搜索 · 找到 ${total()} ${kind().unit}` : '搜索'} /><div class="segmented search-tabs"><For each={searchKinds}>{(item) => <button type="button" classList={{ on: props.route.kind === item.kind }} onClick={() => props.changeKind(item.kind)}>{item.label}</button>}</For></div>
      <Show when={!props.loading || props.data} fallback={<LoadingPage />}><Show when={!props.error} fallback={<ErrorState message={props.error} />}>
        <Show when={props.route.kind === 1}><TrackRows tracks={result().songs || []} open={props.open} /></Show>
        <Show when={props.route.kind === 100}><div class="artist-grid"><For each={result().artists || []}>{(item: Artist) => <button type="button" class="artist-card" onClick={() => props.open({ name: 'artist', id: item.id })}><Artwork src={coverUrl(item, 400)} alt="" round /><b>{item.name}</b></button>}</For></div></Show>
        <Show when={props.route.kind === 10}><div class="cover-grid"><For each={result().albums || []}>{(item: Album) => <article class="playlist-card"><button type="button" class="cover-button" onClick={() => props.open({ name: 'album', id: item.id })}><Artwork src={coverUrl(item, 500)} alt="" /></button><button type="button" class="cover-name" onClick={() => props.open({ name: 'album', id: item.id })}>{item.name}</button><small>{item.artist?.name || item.artists?.map((a) => a.name).join(' / ')}</small></article>}</For></div></Show>
        <Show when={props.route.kind === 1000}><div class="cover-grid"><For each={result().playlists || []}>{(item: Playlist) => <PlaylistCard playlist={item} open={props.open} play={props.playPlaylist} />}</For></div></Show>
        <Show when={props.route.kind === 1002}><div class="user-results"><For each={result().userprofiles || []}>{(item: Profile) => <div class="user-result"><Artwork src={coverUrl(item, 160)} round /><div><b>{item.nickname}</b><p>{item.signature || '这个人很懒，什么都没有留下'}</p></div></div>}</For></div></Show>
        <Show when={props.route.kind === 1009}><PodcastGrid items={result().djRadios || []} /></Show>
        <Show when={props.data && total() === 0}><div class="center-state">没有找到相关结果</div></Show>
      </Show></Show>
    </div>
  )
}

function ArtistPage(props: { artist?: Artist & { hotSongs?: Track[] }; loading: boolean; error: string; open: (page: Page) => void }) {
  return <div class="page-content track-page"><Show when={props.artist} fallback={props.error ? <ErrorState message={props.error} /> : <LoadingPage />}><For each={[props.artist!]}>{(artist) => <><div class="detail-header artist-header"><Artwork src={coverUrl(artist, 700)} class="detail-cover artist-photo" round eager /><div class="detail-copy"><p class="detail-kind">歌手</p><h1>{artist.name}</h1><p>{artist.musicSize || 0} 首歌曲 · {artist.albumSize || 0} 张专辑</p><Show when={artist.briefDesc}><p class="detail-description">{artist.briefDesc}</p></Show><div class="detail-actions"><button type="button" class="pill primary" onClick={() => playQueue(artist.hotSongs || [], 0)}><Icon name="music" size={14} />播放热门歌曲</button></div></div></div><h2 class="section-title">热门歌曲</h2><TrackRows tracks={artist.hotSongs || []} open={props.open} /></>}</For></Show></div>
}

function AlbumPage(props: { album?: Album & { songs?: Track[] }; loading: boolean; error: string; open: (page: Page) => void }) {
  return <div class="page-content track-page"><Show when={props.album} fallback={props.error ? <ErrorState message={props.error} /> : <LoadingPage />}><For each={[props.album!]}>{(album) => <><div class="detail-header"><Artwork src={coverUrl(album, 700)} class="detail-cover" eager /><div class="detail-copy"><p class="detail-kind">专辑</p><h1>{album.name}</h1><p>{album.artist?.name || album.artists?.map((a) => a.name).join(' / ')} · {album.songs?.length || 0} 首</p><Show when={album.publishTime}><p>{new Date(album.publishTime!).toLocaleDateString('zh-CN')} 发行</p></Show><Show when={album.description}><p class="detail-description">{album.description}</p></Show><div class="detail-actions"><button type="button" class="pill primary" onClick={() => playQueue(album.songs || [], 0)}><Icon name="music" size={14} />播放</button></div></div></div><TrackRows tracks={album.songs || []} open={props.open} /></>}</For></Show></div>
}

function FMPage(props: { mode: string; setMode: (mode: string) => void; loading: boolean; started: boolean; start: () => void; heart: () => void }) {
  return <div class="page-content fm-page"><div class="fm-heading"><Heading title="私人 FM" sub="无尽推荐" /><div class="segmented"><For each={[['DEFAULT', '推荐'], ['FAMILIAR', '熟悉'], ['EXPLORE', '探索']]}>{([mode, label]) => <button type="button" classList={{ on: props.mode === mode }} onClick={() => props.setMode(mode)}>{label}</button>}</For></div></div><div class="fm-card" style={{ '--fm-cover': props.started && current() ? `url("${coverUrl(current(), 900)}")` : undefined }}><div class="fm-art"><Artwork src={props.started ? coverUrl(current(), 700) : ''} class="fm-cover" /><Show when={!props.started}><Icon name="radio" size={64} /></Show></div><div class="fm-copy"><p><Icon name="radio" size={14} />私人 FM · {props.mode === 'FAMILIAR' ? '熟悉' : props.mode === 'EXPLORE' ? '探索' : '推荐'}</p><Show when={props.started && current()} fallback={<><h2>听见更多好音乐</h2><span>根据你的口味，一首接一首，不停推荐</span></>}>{(track) => <><h2>{track().name}</h2><span>{artistNames(track())}</span></>}</Show><div class="fm-actions"><Show when={props.started}><LikeButton track={current()!} light /><button type="button" class="fm-play" onClick={toggle}><Icon name="music" size={20} />{playing() ? '暂停' : '继续'}</button></Show><button type="button" class="pill fm-start" disabled={props.loading} onClick={props.start}><Icon name="music" size={14} />{props.loading ? '正在调频…' : props.started ? '换一批' : '开始收听'}</button></div></div></div><h2 class="section-title">心动模式</h2><div class="heart-card"><span class="heart-icon"><Icon name="heart" size={26} /></span><div><b>从你喜欢的音乐出发</b><p>根据你红心过的歌曲，推荐风格相似的音乐，与你的喜欢穿插播放</p></div><button type="button" class="pill primary" onClick={props.heart}><Icon name="heart" size={14} />开启心动模式</button></div></div>
}

function PodcastsPage(props: { items: Playlist[]; loading: boolean; error: string }) {
  return <div class="page-content"><Heading title="播客" sub="发现好节目" /><Show when={!props.loading || props.items.length} fallback={<LoadingPage />}><Show when={!props.error} fallback={<ErrorState message={props.error} />}><PodcastGrid items={props.items} /></Show></Show></div>
}

function PodcastGrid(props: { items: any[] }) {
  return <div class="cover-grid podcast-grid"><For each={props.items}>{(item) => <article class="playlist-card"><a class="cover-button" href={`https://music.163.com/#/djradio?id=${item.id}`} target="_blank" rel="noreferrer"><Artwork src={coverUrl(item, 500)} alt="" /><span class="podcast-open"><Icon name="external" size={17} /></span></a><a class="cover-name" href={`https://music.163.com/#/djradio?id=${item.id}`} target="_blank" rel="noreferrer">{item.name}</a><small>{item.dj?.nickname || item.category || '播客'}</small></article>}</For><Show when={!props.items.length}><div class="center-state">暂时没有推荐节目</div></Show></div>
}

function PlaylistGroup(props: { title: string; items: Playlist[]; open: (page: Page) => void; fallback?: string }) {
  const [collapsed, setCollapsed] = createSignal(false)
  return <section class="playlist-group"><button type="button" class="playlist-group-title" onClick={() => setCollapsed(!collapsed())}><Icon name="down" size={11} class={collapsed() ? 'collapsed' : ''} />{props.title}</button><Show when={!collapsed()}><For each={props.items}>{(item) => <button type="button" class="side-playlist" classList={{ on: routeIsPlaylist(item.id) }} onClick={() => props.open({ name: 'playlist', id: item.id })}><Artwork src={coverUrl(item, 80)} alt="" /><span>{item.name}</span></button>}</For><Show when={!props.items.length && props.fallback}><p class="playlist-empty">{props.fallback}</p></Show></Show></section>
}

// Kept outside the app state: a selected sidebar row is only a visual hint.
let selectedPlaylist = 0
function routeIsPlaylist(id: number) { return selectedPlaylist === id }

function SearchSuggestions(props: { query: string; data?: any; history: string[]; select: (q: string) => void; open: (page: Page) => void; clear: () => void }) {
  const result = () => props.data?.result || {}
  return <div class="search-suggestions"><Show when={props.query.trim()} fallback={<><div class="suggest-title">搜索历史<Show when={props.history.length}><button type="button" onClick={props.clear}>清空</button></Show></div><Show when={props.history.length} fallback={<p class="suggest-empty">搜索喜欢的歌曲、歌手或歌单</p>}><div class="history-tags"><For each={props.history}>{(item) => <button type="button" onClick={() => props.select(item)}>{item}</button>}</For></div></Show></>}>
    <Show when={result().songs?.length}><div class="suggest-title">单曲</div><For each={(result().songs || []).slice(0, 6)}>{(song: Track) => <button type="button" class="suggest-row" onClick={() => props.select(song.name)}><Icon name="music" size={14} /><span>{song.name}<small>{artistNames(song)}</small></span></button>}</For></Show>
    <Show when={result().artists?.length}><div class="suggest-title">歌手</div><For each={(result().artists || []).slice(0, 3)}>{(artist: Artist) => <button type="button" class="suggest-row" onClick={() => props.open({ name: 'artist', id: artist.id })}><Icon name="user" size={14} /><span>{artist.name}</span></button>}</For></Show>
    <button type="button" class="suggest-all" onClick={() => props.select(props.query)}>查看“{props.query}”的全部结果<Icon name="arrow" size={13} /></button>
  </Show></div>
}
