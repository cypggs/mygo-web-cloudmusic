export const repo = 'https://github.com/cypggs/mygo-web-cloudmusic'

export type Asset = { name: string; size: number; browser_download_url: string }
export type Release = { tag_name: string; published_at: string; assets: Asset[] }

declare const __RELEASE__: Release
// The latest release, as it was when the site was built (see vite.config.ts).
export const release = __RELEASE__
export const mygo = 'https://mygo.egoist.dev'

export const site = {
  name: 'MyGo 云音乐',
  title: 'MyGo 云音乐 — 网易云音乐 Web 客户端',
  description:
    'MyGo 云音乐的 Web 版本：每日推荐、排行榜、歌单、搜索、私人 FM、逐行歌词与完整的网页播放器。',
}
