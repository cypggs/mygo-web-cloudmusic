import { For, Show, createSignal } from 'solid-js'
import { api, loadJSON, saveJSON } from '../api'
import { ThemeSwitch } from '../theme'
import type { Profile } from '../types'
import { Icon } from './Icon'

const qualities = [
  { value: 'standard', label: '标准', detail: '128 kbps · MP3' },
  { value: 'higher', label: '较高', detail: '192 kbps · MP3' },
  { value: 'exhigh', label: '极高', detail: '320 kbps · MP3' },
  { value: 'lossless', label: '无损', detail: '最高 48 kHz / 16 bit · FLAC' },
  { value: 'hires', label: 'Hi-Res', detail: '最高 192 kHz / 24 bit · FLAC' },
]

export function SettingsDialog(props: { profile?: Profile; onLogin: () => void; onLogout: () => void; onClose: () => void }) {
  const [quality, setQuality] = createSignal(loadJSON('mygo-quality', 'exhigh'))
  const [normalise, setNormalise] = createSignal(loadJSON('mygo-normalise', true))
  const [hotComments, setHotComments] = createSignal(loadJSON('mygo-hot-comments', true))
  return (
    <div class="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="settings-dialog" role="dialog" aria-modal="true" aria-label="设置">
        <header><h2>设置</h2><button type="button" class="modal-close" aria-label="关闭" onClick={props.onClose}><Icon name="close" size={20} /></button></header>
        <div class="settings-scroll">
          <h3>播放</h3>
          <div class="settings-group">
            <div class="setting-row quality-row"><div><b>音质</b><p>无损与 Hi-Res 需要黑胶 VIP；下一首歌曲开始生效</p></div><select aria-label="音质" value={quality()} onChange={(e) => { setQuality(e.currentTarget.value); saveJSON('mygo-quality', quality()) }}><For each={qualities}>{(q) => <option value={q.value}>{q.label}</option>}</For></select></div>
            <div class="setting-row"><div><b>间奏时显示热评</b><p>前奏、间奏与尾奏时，歌词处换成热门评论</p></div><button type="button" role="switch" aria-checked={hotComments()} class="switch" classList={{ on: hotComments() }} onClick={() => { setHotComments(!hotComments()); saveJSON('mygo-hot-comments', hotComments()) }}><i /></button></div>
            <div class="setting-row"><div><b>音量均衡</b><p>让不同歌曲听起来一样响</p></div><button type="button" role="switch" aria-checked={normalise()} class="switch" classList={{ on: normalise() }} onClick={() => { setNormalise(!normalise()); saveJSON('mygo-normalise', normalise()) }}><i /></button></div>
          </div>
          <h3>外观</h3>
          <div class="settings-group"><div class="setting-row"><div><b>外观</b><p>跟随系统，或固定使用浅色与深色</p></div><ThemeSwitch labels /></div></div>
          <h3>缓存与隐私</h3>
          <div class="settings-group"><div class="setting-row"><div><b>浏览器存储</b><p>播放队列、搜索历史、偏好与喜欢的歌曲仅保存在此浏览器</p></div><span class="setting-badge">本地</span></div></div>
          <h3>账号</h3>
          <div class="settings-group account-setting">
            <Show when={props.profile} fallback={<div class="setting-row"><div><b>未登录</b><p>登录后，每日推荐与歌单将根据你的口味生成</p></div><button type="button" class="pill primary" onClick={props.onLogin}><Icon name="qr" size={14} />扫码登录</button></div>}>
              {(profile) => <div class="account-profile"><img src={profile().avatarUrl} alt="" /><div><b>{profile().nickname}</b><p>已登录网易云音乐</p></div><button type="button" class="pill" onClick={() => { void api('/api/logout', { method: 'POST' }).catch(() => {}); props.onLogout() }}>退出登录</button></div>}
            </Show>
          </div>
          <p class="settings-about">MyGo 云音乐 Web · 第三方客户端，与网易云音乐官方无关<br />音乐版权归各权利人所有 · AGPL-3.0</p>
        </div>
      </section>
    </div>
  )
}
