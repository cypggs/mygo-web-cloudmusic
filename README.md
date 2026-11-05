# MyGo 云音乐 Web

将 [MyGo 云音乐桌面客户端](https://github.com/cypggs/mygo-cloudmusic) 复刻为可在浏览器中使用的 Web 应用。使用 Solid、TanStack Start 与 Node.js，保留原生客户端的侧边栏、推荐、歌单、播放栏和全屏歌词体验。

## 功能

- 每日推荐、推荐歌单、官方榜单与完整排行榜
- 歌单、歌手和专辑详情
- 搜索单曲、歌手、专辑、歌单、用户与播客，带搜索建议和本地历史
- 真实音频播放、播放队列、进度拖动、随机、循环、音量与喜欢
- 全屏播放页、同步滚动歌词与翻译、歌曲评论
- 私人 FM、扫码登录、我的歌单
- 浅色、深色、跟随系统，以及桌面和手机响应式布局

网易云音乐的版权、地区和会员限制仍然适用。

## 本地运行

需要 Node.js 22+：

```bash
git clone https://github.com/cypggs/mygo-web-cloudmusic.git
cd mygo-web-cloudmusic
npm ci
npm run build
npm run start
```

访问 `http://localhost:3000`。可通过 `PORT` 修改端口：

```bash
PORT=8080 NODE_ENV=production npm run start
```

## Docker 部署

```bash
docker compose up -d --build
```

健康检查：`http://localhost:3000/api/health`。

支持普通 Linux 云服务器、Docker Compose、systemd、Nginx/Caddy，以及 Railway、Render、Fly.io 等 Dockerfile 平台。完整步骤见 **[部署指南](DEPLOYMENT.md)**。

> 应用包含同源 Node.js API，不能只部署静态文件或纯静态 Pages。

## 项目结构

```text
website/
├── src/            # Solid 页面、组件、播放器与样式
├── public/         # 图标和示例音频
├── server.mjs      # 静态页面与网易云同源 API 服务
└── dist/client/    # 构建产物
Dockerfile          # 通用生产镜像
compose.yaml        # Docker Compose 部署
DEPLOYMENT.md       # 云服务器与 PaaS 部署指南
```

## 验证

```bash
npm run build
./node_modules/.bin/tsc -p website/tsconfig.json
docker build -t mygo-web-cloudmusic .
```

## 桌面版

仓库保留了原 Go/MyGo 桌面客户端源代码。桌面版需要 Go 1.27+：

```bash
go tool mygo dev
go tool mygo build
go test ./...
```

## 致谢

- [MyGo](https://github.com/egoist/mygo)：原生 UI 与应用框架
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)：eapi 加密与登录流程的参考
- [folia-major](https://github.com/chthollyphile/folia-major)：歌词动画效果的参考
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)、[Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) 与 [Silero VAD](https://github.com/snakers4/silero-vad)：原桌面客户端的本地语音识别

本项目与网易云音乐官方无关，音乐版权归各权利人所有。

## 许可证

[AGPL-3.0](LICENSE)
