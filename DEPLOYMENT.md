# MyGo 云音乐 Web 部署指南

## 架构

应用由同一 Node.js 进程提供两部分：

1. `website/dist/client/`：Solid/TanStack Start 构建的 Web 页面。
2. `website/server.mjs`：同源 `/api/*` 接口，负责推荐、搜索、歌单、歌词、播放地址和扫码登录。

因此**不能只部署静态目录或纯静态 Pages**。可以使用任何支持 Node.js 22+ 或 Docker 的云服务器、容器平台或 PaaS。音频文件由网易云 CDN 直接提供给浏览器，服务器不中转整首音频。

- 默认端口：`3000`
- 健康检查：`GET /api/health`，正常返回 `{"ok":true,...}`
- 环境变量：`PORT`（监听端口）、`NODE_ENV=production`
- 无需数据库或网易云密钥
- 播放队列、设置和搜索历史保存在浏览器；网易云会话保存在 HttpOnly Cookie 中

## 方案一：Docker Compose（推荐）

适用于 Ubuntu、Debian、CentOS、Rocky Linux 等云服务器。

### 1. 安装 Docker

以 Ubuntu/Debian 为例：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

其他系统请使用 Docker 官方安装文档。

### 2. 获取代码并启动

```bash
git clone https://github.com/YOUR_ACCOUNT/mygo-web-cloudmusic.git
cd mygo-web-cloudmusic
docker compose up -d --build
```

将 `YOUR_ACCOUNT` 替换为实际 GitHub 账号。服务默认监听服务器的 `3000` 端口：

```bash
curl http://127.0.0.1:3000/api/health
```

更新版本：

```bash
git pull
docker compose up -d --build
```

查看日志或停止：

```bash
docker compose logs -f web
docker compose down
```

### 3. 直接使用端口访问

在云厂商安全组/防火墙中放行 TCP 3000，然后访问：

```text
http://SERVER_IP:3000
```

生产环境更推荐仅通过下方 Nginx/Caddy 的 443 端口访问，不向公众开放 3000。

## 方案二：普通 Linux + Node.js + systemd

### 1. 准备 Node.js 22+

```bash
node --version
npm --version
```

如果版本较低，请通过 [NodeSource](https://github.com/nodesource/distributions) 或 nvm 安装 Node.js 22 LTS。

### 2. 构建应用

```bash
git clone https://github.com/YOUR_ACCOUNT/mygo-web-cloudmusic.git
cd mygo-web-cloudmusic
npm ci
npm run build
npm run start
```

默认访问 `http://SERVER_IP:3000`。修改端口：

```bash
PORT=8080 NODE_ENV=production npm run start
```

### 3. 使用 systemd 保持运行

以下示例假设代码位于 `/opt/mygo-web-cloudmusic`，Node 和 npm 位于 `/usr/bin`。请按实际路径调整。

```ini
# /etc/systemd/system/mygo-web.service
[Unit]
Description=MyGo Cloud Music Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/mygo-web-cloudmusic
ExecStart=/usr/bin/node /opt/mygo-web-cloudmusic/website/server.mjs
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3000
User=www-data
Group=www-data
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mygo-web
sudo systemctl status mygo-web
journalctl -u mygo-web -f
```

更新代码时：

```bash
cd /opt/mygo-web-cloudmusic
git pull
npm ci
npm run build
sudo systemctl restart mygo-web
```

确保运行用户对目录有读取权限；构建建议由普通部署用户完成后，再由 systemd 启动。

## 配置域名与 HTTPS

### Nginx

```nginx
server {
    listen 80;
    server_name music.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

启用配置后，使用 Certbot 获取证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d music.example.com
```

### Caddy（自动 HTTPS）

```caddyfile
music.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

无论使用哪种反向代理，都应传递 `X-Forwarded-Proto`，让 HTTPS 部署正确设置安全 Cookie。

## 方案三：容器/PaaS 平台

仓库根目录包含可直接使用的 `Dockerfile`，适用于 Railway、Render、Fly.io、Zeabur、Sealos 以及云厂商容器服务。

通用配置：

| 配置项 | 值 |
| --- | --- |
| 构建方式 | Dockerfile |
| 启动命令 | 使用镜像默认 `CMD`，无需覆盖 |
| 容器端口 | `3000` |
| 健康检查 | `/api/health` |
| `NODE_ENV` | `production` |
| 持久化磁盘 | 不需要 |

如果平台自动注入 `PORT`，应用会自动使用。平台若只支持静态网站，则不适合当前完整版本，因为扫码登录和同源 API 需要 Node.js 服务。

## 验证与故障排查

```bash
# 容器或服务器本地检查
curl -f http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/

# Docker 构建验证
docker build -t mygo-web-cloudmusic .
docker run --rm -p 3000:3000 mygo-web-cloudmusic
```

- **页面能打开但推荐/搜索失败**：检查服务器能否访问 `music.163.com` 与 `interfacepc.music.163.com`，以及 20 秒上游超时是否过短。
- **歌曲无法播放**：通常是网易云版权、地区或会员限制，不是部署故障；登录有权限的账号后再试。
- **扫码后登录未保持**：确认外部访问使用 HTTPS，反向代理传递了 `X-Forwarded-Proto: https`，浏览器允许 Cookie。
- **部署后接口 404**：说明只部署了静态文件；请启动 `website/server.mjs` 或使用仓库 Dockerfile。

## 安全说明

不要把 GitHub Token、网易云 Cookie 或其他凭证写入仓库、Dockerfile、Compose 文件或日志。公开部署时应启用 HTTPS，并及时更新依赖。该项目为第三方客户端，与网易云音乐官方无关，音乐版权与访问权限仍归各权利人及平台规则约束。
