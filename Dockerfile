# Next.js 15 多阶段构建
#
# 为什么不用 Dokploy 默认的 nixpacks？（2026-08-23 实地排查结论）
#   1. 会 OOM：nixpacks 解压整个 nix store，在这台 8GB 的机器上被内核杀掉
#      （exit code 137），构建随机失败，而失败会让服务停在 0 副本 → 停服
#   2. 泄露密钥：nixpacks 把 DB_PASSWORD / JWT_SECRET 写进生成的 Dockerfile 的
#      ARG/ENV，密钥被烘焙进镜像层，docker history 就能看到
#   3. 慢：十几分钟起步
#
# 本文件用多阶段构建解决 2（构建参数只存在于 builder 阶段，不进最终镜像），
# 并且不碰 nix，解决 1 和 3。

# ── 依赖安装阶段 ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# 只复制依赖清单，这一层能被 Docker 缓存：
# 改业务代码时不会重新装依赖
# corepack 会读 package.json 的 packageManager 字段自动装对应版本的 pnpm。
# 不要写 pnpm@latest——那会让构建结果随时间漂移，今天能过明天可能就挂了。
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile

# ── 构建阶段 ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建期需要连数据库做预渲染（见 CLAUDE.md「渲染模型」）。
# 这些值由 Dokploy 以 --build-arg 传入。
# 关键：它们只存在于这个 builder 阶段，最终镜像里不会有——
# 这正是多阶段构建相比 nixpacks 的安全优势。
ARG DB_HOST
ARG DB_PORT
ARG DB_NAME
ARG DB_USER
ARG DB_PASSWORD
ARG JWT_SECRET
ARG ADMIN_USER_IDS
ARG BACKEND_URL
ENV DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_NAME=$DB_NAME \
    DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD \
    JWT_SECRET=$JWT_SECRET ADMIN_USER_IDS=$ADMIN_USER_IDS \
    BACKEND_URL=$BACKEND_URL

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable && pnpm build

# 构建后自检：如果构建期没连上数据库，Next.js 会静默烘焙
# lib/projects-data.ts 里的 fallback 假数据，页面看起来正常但内容是错的。
# 这里用静态路由数量兜底校验：正常应有 18 条（首页 + /login + /dashboard + 15 个项目页）。
# 数量对不上就让构建失败，而不是把假数据发到线上。
# 注意写成一行：Dockerfile 的 RUN 不支持跨行字符串，
# 换行必须用反斜杠续行，否则解析器会把第二行当成新指令报
# "unknown instruction: const"。
RUN node -e "const m=require('./.next/prerender-manifest.json');const n=Object.keys(m.routes).length;console.log('静态预渲染路由数: '+n);if(n<10){console.error('静态路由过少，构建期很可能没连上数据库');process.exit(1)}"

# ── 运行阶段 ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata

# 不用 root 跑应用。
# 这是 2026-06 那次入侵的直接教训：当时 Next.js 以 root + pm2 运行，
# 框架层 RCE（CVE-2025-66478）直接变成了服务器 root 权限。
RUN addgroup -g 1001 nodejs && adduser -D -u 1001 -G nodejs nextjs

# standalone 产物已经包含了精简后的 node_modules 和 server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 注意：本项目没有 public/ 目录，所以这里不 COPY 它。
# 将来如果添加了 public/（放 favicon、图片等静态资源），
# 要在这里补上：COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 否则那些资源不会进镜像，线上会 404。

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
