# MyGo 云音乐 Web

原桌面客户端的 Web 版本，使用 TanStack Start、Solid 与 Node.js。界面复刻原生客户端，并通过同源服务端访问网易云音乐数据。

## 功能

- 默认「免费畅听」首页：亦歌风格随机列表，服务端逐首验证匿名完整播放，支持自动连播与换一批
- 每日推荐、推荐歌单、官方榜单与完整排行榜
- 歌单、歌手、专辑页面
- 搜索单曲、歌手、专辑、歌单、用户与播客，带搜索建议和本地历史
- 真实音频播放、播放队列、进度拖动、随机、循环、音量与喜欢
- 全屏播放页、同步滚动歌词与翻译、歌曲评论
- 私人 FM、扫码登录、我的歌单、浅色/深色/跟随系统
- 桌面与手机响应式布局

## 构建与部署

在仓库根目录执行：

```bash
npm install
npm run build
npm run start       # http://localhost:3000
```

`PORT` 可以修改监听端口。例如 `PORT=8080 npm run start`。

Node 服务同时提供静态页面和 `/api/*` 接口，因此不能只部署 `dist/client` 静态目录；播放、搜索和扫码登录需要 `server.mjs`。网易云音乐的版权与会员限制仍然适用。

## 验证

```bash
./node_modules/.bin/tsc -p website/tsconfig.json
```
