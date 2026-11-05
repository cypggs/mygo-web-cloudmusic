FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY website/package.json website/package.json
RUN npm ci

COPY website ./website
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY package.json package-lock.json ./
COPY website/package.json website/package.json
RUN npm ci --omit=dev --workspace website && npm cache clean --force

COPY --from=build /app/website/dist/client ./website/dist/client
COPY website/server.mjs ./website/server.mjs

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "website/server.mjs"]
