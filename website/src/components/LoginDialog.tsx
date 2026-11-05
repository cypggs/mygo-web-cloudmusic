import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { api } from '../api'
import type { Profile } from '../types'
import { Icon } from './Icon'

export function LoginDialog(props: { onClose: () => void; onLogged: (profile: Profile) => void }) {
  const [qr, setQr] = createSignal('')
  const [status, setStatus] = createSignal('正在获取二维码…')
  const [key, setKey] = createSignal('')
  const [error, setError] = createSignal('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  async function begin() {
    stopped = false
    setError('')
    setQr('')
    setStatus('正在获取二维码…')
    try {
      const data = await api<{ key: string; qr: string }>('/api/login/qr', { method: 'POST' })
      if (stopped) return
      setKey(data.key)
      setQr(data.qr)
      setStatus('请使用网易云音乐 App 扫码')
      poll(data.key)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '二维码加载失败')
    }
  }

  async function poll(value: string) {
    if (stopped) return
    try {
      const response = await fetch(`/api/login/qr/check?key=${encodeURIComponent(value)}`, { credentials: 'same-origin' })
      const data = await response.json()
      if (stopped) return
      if (data.code === 803) {
        setStatus('登录成功')
        const account = await api<{ profile: Profile }>('/api/account')
        if (account.profile) props.onLogged(account.profile)
        props.onClose()
        return
      }
      if (data.code === 800) {
        setStatus('二维码已过期')
        setQr('')
        return
      }
      setStatus(data.code === 802 ? `${data.nickname || '账号'}，请在手机上确认登录` : '请使用网易云音乐 App 扫码')
    } catch {}
    timer = setTimeout(() => poll(value), 1600)
  }

  onMount(begin)
  onCleanup(() => { stopped = true; if (timer) clearTimeout(timer) })

  return (
    <div class="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="login-dialog" role="dialog" aria-modal="true" aria-label="扫码登录">
        <button type="button" class="modal-close" aria-label="关闭" onClick={props.onClose}><Icon name="close" size={20} /></button>
        <div class="login-logo"><Icon name="qr" size={28} /></div>
        <h2>扫码登录</h2>
        <p>登录后，每日推荐与歌单将根据你的口味生成</p>
        <div class="qr-frame">
          <Show when={qr()} fallback={<div class="qr-loading"><span class="spinner dark" /></div>}>
            <img src={qr()} alt="网易云音乐登录二维码" />
          </Show>
        </div>
        <div class="login-status">{status()}</div>
        <Show when={error()}><div class="login-error">{error()}<button type="button" onClick={begin}>重试</button></div></Show>
        <small>登录态仅保存在当前浏览器的安全 Cookie 中</small>
      </section>
    </div>
  )
}
